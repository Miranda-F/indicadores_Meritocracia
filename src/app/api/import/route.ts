import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }
    
    // Ler o arquivo Excel
    const buffer = await file.arrayBuffer();
    const xlsx = await import('xlsx');
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    
    // Processar planilha MATRIZ
    const matrizSheet = workbook.Sheets['MATRIZ'];
    if (!matrizSheet) {
      return NextResponse.json({ error: 'Planilha MATRIZ não encontrada' }, { status: 400 });
    }
    
    const matrizData = xlsx.utils.sheet_to_json(matrizSheet, { header: 1 });
    
    // Pular cabeçalho
    const dataRows = matrizData.slice(2);
    
    let departamentosCriados = 0;
    let setoresCriados = 0;
    let colaboradoresCriados = 0;
    let indicadoresCriados = 0;
    let metasCriadas = 0;
    
    // Mapas para evitar duplicatas
    const departamentosMap = new Map<string, string>();
    const setoresMap = new Map<string, string>();
    const colaboradoresMap = new Map<string, string>();
    
    // Períodos (colunas de meta)
    const periodos = ['2026-01', '2026-02', '2026-03', '2026-04'];
    
    for (const row of dataRows as Array<unknown>) {
      const rowData = row as Array<unknown>;
      if (!rowData || rowData.length < 10) continue;
      
      const depto = String(rowData[0] || '').trim();
      const setor = String(rowData[1] || '').trim();
      const colaboradorNome = String(rowData[2] || '').trim();
      const funcao = String(rowData[3] || '').trim();
      const status = String(rowData[4] || 'A').trim().toUpperCase();
      const indicadorNome = String(rowData[5] || '').trim();
      const nivel = parseInt(String(rowData[6] || '1'));
      const bonusM = parseCurrency(String(rowData[7] || '0'));
      const bonusSM = parseCurrency(String(rowData[8] || '0'));
      
      if (!depto || !setor || !colaboradorNome || !indicadorNome) continue;
      
      // Criar/obter departamento
      let deptoId = departamentosMap.get(depto);
      if (!deptoId) {
        const existing = await db.departamento.findUnique({ where: { nome: depto } });
        if (existing) {
          deptoId = existing.id;
        } else {
          const created = await db.departamento.create({ data: { nome: depto } });
          deptoId = created.id;
          departamentosCriados++;
        }
        departamentosMap.set(depto, deptoId);
      }
      
      // Criar/obter setor
      const setorKey = `${depto}-${setor}`;
      let setorId = setoresMap.get(setorKey);
      if (!setorId) {
        const existing = await db.setor.findFirst({
          where: { nome: setor, departamentoId: deptoId }
        });
        if (existing) {
          setorId = existing.id;
        } else {
          const created = await db.setor.create({
            data: { nome: setor, departamentoId: deptoId }
          });
          setorId = created.id;
          setoresCriados++;
        }
        setoresMap.set(setorKey, setorId);
      }
      
      // Criar/obter colaborador
      let colaboradorId = colaboradoresMap.get(colaboradorNome);
      if (!colaboradorId) {
        const existing = await db.colaborador.findUnique({ where: { nome: colaboradorNome } });
        if (existing) {
          colaboradorId = existing.id;
        } else {
          const created = await db.colaborador.create({
            data: {
              nome: colaboradorNome,
              funcao,
              status: status.startsWith('A') ? 'A' : 'I',
              nivel,
              ativo: status.startsWith('A'),
              setorId
            }
          });
          colaboradorId = created.id;
          colaboradoresCriados++;
        }
        colaboradoresMap.set(colaboradorNome, colaboradorId);
      }
      
      // Criar indicador
      const indicadorExistente = await db.indicador.findFirst({
        where: { nome: indicadorNome, colaboradorId }
      });
      
      let indicadorId;
      if (!indicadorExistente) {
        const created = await db.indicador.create({
          data: {
            nome: indicadorNome,
            medida: 'R$',
            frequencia: 'Mensal',
            nivel,
            bonusMeta: bonusM,
            bonusSupermeta: bonusSM,
            colaboradorId
          }
        });
        indicadorId = created.id;
        indicadoresCriados++;
      } else {
        indicadorId = indicadorExistente.id;
      }
      
      // Criar metas para cada período
      for (let i = 0; i < periodos.length; i++) {
        const metaIndex = 9 + i * 2;
        const supermetaIndex = 10 + i * 2;
        
        const metaValue = parseFloat(String(rowData[metaIndex] || ''));
        const supermetaValue = parseFloat(String(rowData[supermetaIndex] || ''));
        
        if (!isNaN(metaValue) && !isNaN(supermetaValue)) {
          const [ano, mes] = periodos[i].split('-').map(Number);
          
          await db.meta.upsert({
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
          });
          metasCriadas++;
        }
      }
    }
    
    // Processar coletas mensais
    const coletasSheet = workbook.Sheets['COLETAS MENSAIS'];
    if (coletasSheet) {
      const coletasData = xlsx.utils.sheet_to_json(coletasSheet) as Array<Record<string, unknown>>;
      
      for (const coleta of coletasData) {
        const identificador = String(coleta['IDENTIFICADOR'] || '');
        const valor = parseFloat(String(coleta['VALOR da COLETA'] || ''));
        const periodoRaw = String(coleta['PERIODO'] || '');
        const comentario = String(coleta['COMENTÁRIOS'] || '');
        
        if (isNaN(valor) || !identificador) continue;
        
        // Parse período
        const periodoMatch = periodoRaw.match(/(\d{4})-(\d{2})/);
        if (!periodoMatch) continue;
        
        const periodo = `${periodoMatch[1]}-${periodoMatch[2]}`;
        const ano = parseInt(periodoMatch[1]);
        const mes = parseInt(periodoMatch[2]);
        
        // Encontrar indicador pelo identificador
        const indicador = await db.indicador.findFirst({
          where: { identificador },
          include: { metas: { where: { periodo } } }
        });
        
        if (!indicador) continue;
        
        const metaRecord = indicador.metas[0];
        let atingiuMeta = false;
        let atingiuSupermeta = false;
        let bonusCalculado = 0;
        
        if (metaRecord) {
          atingiuMeta = valor >= metaRecord.meta;
          atingiuSupermeta = valor >= metaRecord.supermeta;
          
          if (atingiuSupermeta) {
            bonusCalculado = indicador.bonusSupermeta;
          } else if (atingiuMeta) {
            bonusCalculado = indicador.bonusMeta;
          }
        }
        
        await db.coleta.upsert({
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
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Importação concluída com sucesso',
      stats: {
        departamentosCriados,
        setoresCriados,
        colaboradoresCriados,
        indicadoresCriados,
        metasCriadas
      }
    });
  } catch (error) {
    console.error('Erro na importação:', error);
    return NextResponse.json({ error: 'Erro na importação' }, { status: 500 });
  }
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}
