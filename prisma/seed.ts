import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'

const prisma = new PrismaClient()

function parseCurrency(value: string): number {
  if (!value) return 0
  const cleaned = String(value).replace(/[R$\s.]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

// Normalizar nome do indicador para comparação
function normalizeIndicatorName(name: string): string {
  return name
    .replace('IM - ', '')
    .replace('IM – ', '')
    .toLowerCase()
    .trim()
}

async function main() {
  console.log('Iniciando importação de dados...')
  
  const filePath = path.join(process.cwd(), 'upload/BASE INDICADORES POWER BI.xlsx')
  const workbook = XLSX.readFile(filePath)
  
  // Processar planilha MATRIZ
  const matrizSheet = workbook.Sheets['MATRIZ']
  if (!matrizSheet) {
    console.error('Planilha MATRIZ não encontrada')
    return
  }
  
  const matrizData = XLSX.utils.sheet_to_json(matrizSheet, { header: 1 })
  const dataRows = matrizData.slice(2)
  
  // Mapas para evitar duplicatas
  const departamentosMap = new Map<string, string>()
  const setoresMap = new Map<string, string>()
  const colaboradoresMap = new Map<string, string>()
  
  // Períodos (colunas de meta)
  const periodos = ['2026-01', '2026-02', '2026-03', '2026-04']
  
  let stats = {
    departamentos: 0,
    setores: 0,
    colaboradores: 0,
    indicadores: 0,
    metas: 0,
    coletas: 0
  }
  
  console.log('Processando MATRIZ...')
  
  for (const row of dataRows as Array<unknown>) {
    const rowData = row as Array<unknown>
    if (!rowData || rowData.length < 10) continue
    
    const depto = String(rowData[0] || '').trim()
    const setor = String(rowData[1] || '').trim()
    const colaboradorNome = String(rowData[2] || '').trim()
    const funcao = String(rowData[3] || '').trim()
    const status = String(rowData[4] || 'A').trim().toUpperCase()
    const indicadorNome = String(rowData[5] || '').trim()
    const nivel = parseInt(String(rowData[6] || '1'))
    const bonusM = parseCurrency(String(rowData[7] || '0'))
    const bonusSM = parseCurrency(String(rowData[8] || '0'))
    
    if (!depto || !setor || !colaboradorNome || !indicadorNome) continue
    
    // Criar/obter departamento
    let deptoId = departamentosMap.get(depto)
    if (!deptoId) {
      const existing = await prisma.departamento.findUnique({ where: { nome: depto } })
      if (existing) {
        deptoId = existing.id
      } else {
        const created = await prisma.departamento.create({ data: { nome: depto } })
        deptoId = created.id
        stats.departamentos++
      }
      departamentosMap.set(depto, deptoId)
    }
    
    // Criar/obter setor
    const setorKey = `${depto}-${setor}`
    let setorId = setoresMap.get(setorKey)
    if (!setorId) {
      const existing = await prisma.setor.findFirst({
        where: { nome: setor, departamentoId: deptoId }
      })
      if (existing) {
        setorId = existing.id
      } else {
        const created = await prisma.setor.create({
          data: { nome: setor, departamentoId: deptoId }
        })
        setorId = created.id
        stats.setores++
      }
      setoresMap.set(setorKey, setorId)
    }
    
    // Criar/obter colaborador
    let colaboradorId = colaboradoresMap.get(colaboradorNome)
    if (!colaboradorId) {
      const existing = await prisma.colaborador.findUnique({ where: { nome: colaboradorNome } })
      if (existing) {
        colaboradorId = existing.id
      } else {
        const created = await prisma.colaborador.create({
          data: {
            nome: colaboradorNome,
            funcao,
            status: status.startsWith('A') ? 'A' : 'I',
            nivel,
            ativo: status.startsWith('A'),
            setorId
          }
        })
        colaboradorId = created.id
        stats.colaboradores++
      }
      colaboradoresMap.set(colaboradorNome, colaboradorId)
    }
    
    // Criar indicador
    const indicadorExistente = await prisma.indicador.findFirst({
      where: { nome: indicadorNome, colaboradorId }
    })
    
    let indicadorId
    if (!indicadorExistente) {
      const created = await prisma.indicador.create({
        data: {
          nome: indicadorNome,
          medida: 'R$',
          frequencia: 'Mensal',
          nivel,
          bonusMeta: bonusM,
          bonusSupermeta: bonusSM,
          colaboradorId
        }
      })
      indicadorId = created.id
      stats.indicadores++
    } else {
      indicadorId = indicadorExistente.id
    }
    
    // Criar metas para cada período
    for (let i = 0; i < periodos.length; i++) {
      const metaIndex = 9 + i * 2
      const supermetaIndex = 10 + i * 2
      
      const metaValue = parseFloat(String(rowData[metaIndex] || ''))
      const supermetaValue = parseFloat(String(rowData[supermetaIndex] || ''))
      
      if (!isNaN(metaValue) && !isNaN(supermetaValue)) {
        const [ano, mes] = periodos[i].split('-').map(Number)
        
        await prisma.meta.upsert({
          where: {
            indicadorId_periodo: { indicadorId, periodo: periodos[i] }
          },
          create: {
            indicadorId,
            periodo: periodos[i],
            mes,
            ano,
            meta: metaValue,
            supermeta: supermetaValue
          },
          update: {
            meta: metaValue,
            supermeta: supermetaValue
          }
        })
        stats.metas++
      }
    }
  }
  
  // Processar coletas mensais
  console.log('Processando COLETAS MENSAIS...')
  const coletasSheet = workbook.Sheets['COLETAS MENSAIS']
  if (coletasSheet) {
    const coletasData = XLSX.utils.sheet_to_json(coletasSheet) as Array<Record<string, unknown>>
    
    // Buscar todos os indicadores e criar mapa por nome normalizado
    const allIndicadores = await prisma.indicador.findMany({
      include: { colaborador: true }
    })
    
    const indicadoresMap = new Map<string, typeof allIndicadores[0][]>()
    
    for (const ind of allIndicadores) {
      const nomeNorm = normalizeIndicatorName(ind.nome)
      if (!indicadoresMap.has(nomeNorm)) {
        indicadoresMap.set(nomeNorm, [])
      }
      indicadoresMap.get(nomeNorm)!.push(ind)
    }
    
    console.log(`Indicadores mapeados: ${indicadoresMap.size}`)
    
    for (const coleta of coletasData) {
      const indicadorNomeRaw = String(coleta['INDICADOR'] || '')
      const valor = parseFloat(String(coleta['VALOR da COLETA'] || ''))
      const periodoRaw = coleta['PERIODO']
      const comentario = String(coleta['COMENTÁRIOS'] || '')
      
      if (isNaN(valor)) continue
      
      // Parse período - pode ser string ou datetime
      let periodo: string
      let ano: number
      let mes: number
      
      if (typeof periodoRaw === 'string') {
        const periodoMatch = String(periodoRaw).match(/(\d{4})-(\d{2})/)
        if (!periodoMatch) continue
        periodo = `${periodoMatch[1]}-${periodoMatch[2]}`
        ano = parseInt(periodoMatch[1])
        mes = parseInt(periodoMatch[2])
      } else if (periodoRaw instanceof Date) {
        ano = periodoRaw.getFullYear()
        mes = periodoRaw.getMonth() + 1
        periodo = `${ano}-${String(mes).padStart(2, '0')}`
      } else {
        // Tentar converter
        const d = new Date(String(periodoRaw))
        if (isNaN(d.getTime())) continue
        ano = d.getFullYear()
        mes = d.getMonth() + 1
        periodo = `${ano}-${String(mes).padStart(2, '0')}`
      }
      
      // Encontrar indicador pelo nome normalizado
      const nomeNorm = normalizeIndicatorName(indicadorNomeRaw)
      const indicadoresEncontrados = indicadoresMap.get(nomeNorm) || []
      
      // Se encontrou indicadores, criar coletas
      for (const indicador of indicadoresEncontrados) {
        const metaRecord = await prisma.meta.findFirst({
          where: { indicadorId: indicador.id, periodo }
        })
        
        let atingiuMeta = false
        let atingiuSupermeta = false
        let bonusCalculado = 0
        
        if (metaRecord) {
          atingiuMeta = valor >= metaRecord.meta
          atingiuSupermeta = valor >= metaRecord.supermeta
          
          if (atingiuSupermeta) {
            bonusCalculado = indicador.bonusSupermeta
          } else if (atingiuMeta) {
            bonusCalculado = indicador.bonusMeta
          }
        }
        
        try {
          await prisma.coleta.upsert({
            where: {
              indicadorId_periodo: { indicadorId: indicador.id, periodo }
            },
            create: {
              indicadorId: indicador.id,
              periodo,
              mes,
              ano,
              valor,
              comentario: comentario || null,
              atingiuMeta,
              atingiuSupermeta,
              bonusCalculado
            },
            update: {
              valor,
              comentario: comentario || null,
              atingiuMeta,
              atingiuSupermeta,
              bonusCalculado
            }
          })
          stats.coletas++
        } catch (e) {
          // Ignorar erros de duplicação
        }
      }
    }
  }
  
  console.log('\n=== Importação concluída ===')
  console.log(`Departamentos: ${stats.departamentos}`)
  console.log(`Setores: ${stats.setores}`)
  console.log(`Colaboradores: ${stats.colaboradores}`)
  console.log(`Indicadores: ${stats.indicadores}`)
  console.log(`Metas: ${stats.metas}`)
  console.log(`Coletas: ${stats.coletas}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
