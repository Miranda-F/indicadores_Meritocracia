import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Mapeamento de nomes de meses em português para números
const mesesMap: Record<string, string> = {
  'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04',
  'mai': '05', 'jun': '06', 'jul': '07', 'ago': '08',
  'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
}

// Função para converter interval_name (ex: "mar/25") para período (ex: "2025-03")
function parseIntervalName(intervalName: string): string | null {
  try {
    const parts = intervalName.toLowerCase().split('/')
    if (parts.length !== 2) return null
    
    const [mesAbrev, anoAbrev] = parts
    const mes = mesesMap[mesAbrev]
    if (!mes) return null
    
    // Converter ano de 2 dígitos para 4 dígitos
    // Assumindo que 25 = 2025, 99 = 1999, 00 = 2000
    const anoCompleto = parseInt(anoAbrev)
    const ano = anoCompleto >= 50 ? 1900 + anoCompleto : 2000 + anoCompleto
    
    return `${ano}-${mes}`
  } catch {
    return null
  }
}

// POST - Sincronizar dados da fonte e salvar coletas
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const modoSync = body.modo || 'periodo' // 'periodo' ou 'completo'
    const periodo = body.periodo // Formato: YYYY-MM (obrigatório se modo = 'periodo')

    const fonte = await db.fonteDados.findUnique({
      where: { id },
      include: {
        indicador: true
      }
    })

    if (!fonte) {
      return NextResponse.json(
        { error: 'Fonte de dados não encontrada' },
        { status: 404 }
      )
    }

    if (!fonte.indicador) {
      return NextResponse.json(
        { error: 'Fonte de dados não está vinculada a nenhum indicador' },
        { status: 400 }
      )
    }

    // Preparar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    // Adicionar headers customizados
    if (fonte.headers) {
      try {
        const customHeaders = JSON.parse(fonte.headers)
        Object.assign(headers, customHeaders)
      } catch (e) {
        console.error('Erro ao parsear headers customizados:', e)
      }
    }

    // Adicionar autenticação
    if (fonte.tipoAutenticacao !== 'Nenhuma' && fonte.tokenAutenticacao) {
      switch (fonte.tipoAutenticacao) {
        case 'Bearer':
          headers['Authorization'] = `Bearer ${fonte.tokenAutenticacao}`
          break
        case 'Basic':
          headers['Authorization'] = `Basic ${fonte.tokenAutenticacao}`
          break
        case 'ApiKey':
          if (fonte.headerAuthName) {
            headers[fonte.headerAuthName] = fonte.tokenAutenticacao
          }
          break
      }
    }

    // Substituir variáveis na URL
    let url = fonte.url
    if (periodo) {
      url = url.replace(/{periodo}/g, periodo)
      url = url.replace(/{mes}/g, periodo.split('-')[1])
      url = url.replace(/{ano}/g, periodo.split('-')[0])
    }

    // Fazer a requisição
    const fetchOptions: RequestInit = {
      method: fonte.metodo,
      headers
    }

    // Substituir variáveis no body
    if (fonte.metodo !== 'GET' && fonte.body) {
      let bodyStr = fonte.body
      if (periodo) {
        bodyStr = bodyStr.replace(/{periodo}/g, periodo)
        bodyStr = bodyStr.replace(/{mes}/g, periodo.split('-')[1])
        bodyStr = bodyStr.replace(/{ano}/g, periodo.split('-')[0])
      }
      fetchOptions.body = bodyStr
    }

    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const responseText = await response.text()
    let responseData: unknown = responseText

    // Tentar parsear como JSON
    try {
      responseData = JSON.parse(responseText)
    } catch {
      throw new Error('Resposta da API não é um JSON válido')
    }

    // Verificar se é um array (sincronização completa)
    if (Array.isArray(responseData)) {
      // Modo de sincronização completa - processar todos os períodos
      const resultados: Array<{
        intervalo: string
        periodo: string
        valor: number | null
        status: 'sucesso' | 'sem_valor' | 'erro'
        mensagem?: string
      }> = []

      for (const item of responseData) {
        // Extrair interval_name e value
        const intervalName = item.interval_name as string | undefined
        const valor = item.value

        if (!intervalName) {
          resultados.push({
            intervalo: 'desconhecido',
            periodo: '',
            valor: null,
            status: 'erro',
            mensagem: 'interval_name não encontrado'
          })
          continue
        }

        const periodoItem = parseIntervalName(intervalName)
        if (!periodoItem) {
          resultados.push({
            intervalo: intervalName,
            periodo: '',
            valor: null,
            status: 'erro',
            mensagem: 'Não foi possível converter o interval_name para período'
          })
          continue
        }

        // Se valor for null ou undefined, pular (período ainda sem dados)
        if (valor === null || valor === undefined) {
          resultados.push({
            intervalo: intervalName,
            periodo: periodoItem,
            valor: null,
            status: 'sem_valor'
          })
          continue
        }

        const valorNumerico = typeof valor === 'number' ? valor : parseFloat(String(valor))
        if (isNaN(valorNumerico)) {
          resultados.push({
            intervalo: intervalName,
            periodo: periodoItem,
            valor: null,
            status: 'erro',
            mensagem: 'Valor não é um número válido'
          })
          continue
        }

        // Buscar meta do período para calcular bônus
        const meta = await db.meta.findUnique({
          where: {
            indicadorId_periodo: {
              indicadorId: fonte.indicadorId!,
              periodo: periodoItem
            }
          }
        })

        // Calcular se atingiu meta/supermeta baseado no tipo de meta
        const tipoMeta = fonte.indicador?.tipoMeta || 'maior_que'
        let atingiuMeta = false
        let atingiuSupermeta = false

        if (meta) {
          if (tipoMeta === 'menor_que') {
            // Para custos/despesas: quanto menor, melhor
            atingiuMeta = valorNumerico <= meta.meta
            atingiuSupermeta = valorNumerico <= meta.supermeta
          } else {
            // Para receitas/vendas: quanto maior, melhor
            atingiuMeta = valorNumerico >= meta.meta
            atingiuSupermeta = valorNumerico >= meta.supermeta
          }
        }

        // Calcular bônus
        let bonusCalculado = 0
        if (atingiuSupermeta && fonte.indicador) {
          bonusCalculado = fonte.indicador.bonusSupermeta
        } else if (atingiuMeta && fonte.indicador) {
          bonusCalculado = fonte.indicador.bonusMeta
        }

        // Extrair mês e ano do período
        const [ano, mes] = periodoItem.split('-').map(Number)

        // Criar ou atualizar coleta
        await db.coleta.upsert({
          where: {
            indicadorId_periodo: {
              indicadorId: fonte.indicadorId!,
              periodo: periodoItem
            }
          },
          create: {
            indicadorId: fonte.indicadorId!,
            periodo: periodoItem,
            mes,
            ano,
            valor: valorNumerico,
            comentario: `Sincronizado automaticamente de ${fonte.nome}`,
            atingiuMeta,
            atingiuSupermeta,
            bonusCalculado
          },
          update: {
            valor: valorNumerico,
            comentario: `Sincronizado automaticamente de ${fonte.nome}`,
            atingiuMeta,
            atingiuSupermeta,
            bonusCalculado
          }
        })

        resultados.push({
          intervalo: intervalName,
          periodo: periodoItem,
          valor: valorNumerico,
          status: 'sucesso'
        })
      }

      // Atualizar status da fonte
      await db.fonteDados.update({
        where: { id },
        data: {
          ultimaSincronizacao: new Date(),
          statusUltimaSync: 'Sucesso',
          mensagemErro: null
        }
      })

      const sucessos = resultados.filter(r => r.status === 'sucesso').length
      const semValores = resultados.filter(r => r.status === 'sem_valor').length
      const erros = resultados.filter(r => r.status === 'erro').length

      return NextResponse.json({
        success: true,
        modo: 'completo',
        total: resultados.length,
        sucessos,
        semValores,
        erros,
        resultados
      })
    }

    // Modo de período único - lógica original
    if (!periodo) {
      return NextResponse.json(
        { error: 'Período é obrigatório quando a resposta não é um array' },
        { status: 400 }
      )
    }

    // Extrair valor do campo configurado
    let valorExtraido: number | null = null
    if (responseData && typeof responseData === 'object') {
      const campo = fonte.campoValor
      const campos = campo.split('.')
      let current: unknown = responseData
      for (const c of campos) {
        if (current && typeof current === 'object' && c in current) {
          current = (current as Record<string, unknown>)[c]
        } else {
          current = null
          break
        }
      }
      
      // Converter para número
      if (current !== null && current !== undefined) {
        valorExtraido = typeof current === 'number' ? current : parseFloat(String(current))
      }
    }

    if (valorExtraido === null || isNaN(valorExtraido)) {
      throw new Error(`Não foi possível extrair o valor do campo "${fonte.campoValor}"`)
    }

    // Buscar meta do período para calcular bônus
    const meta = await db.meta.findUnique({
      where: {
        indicadorId_periodo: {
          indicadorId: fonte.indicadorId!,
          periodo
        }
      }
    })

    // Calcular se atingiu meta/supermeta baseado no tipo de meta
    const tipoMeta = fonte.indicador?.tipoMeta || 'maior_que'
    let atingiuMeta = false
    let atingiuSupermeta = false

    if (meta) {
      if (tipoMeta === 'menor_que') {
        // Para custos/despesas: quanto menor, melhor
        atingiuMeta = valorExtraido <= meta.meta
        atingiuSupermeta = valorExtraido <= meta.supermeta
      } else {
        // Para receitas/vendas: quanto maior, melhor
        atingiuMeta = valorExtraido >= meta.meta
        atingiuSupermeta = valorExtraido >= meta.supermeta
      }
    }

    // Calcular bônus
    let bonusCalculado = 0
    if (atingiuSupermeta && fonte.indicador) {
      bonusCalculado = fonte.indicador.bonusSupermeta
    } else if (atingiuMeta && fonte.indicador) {
      bonusCalculado = fonte.indicador.bonusMeta
    }

    // Extrair mês e ano do período
    const [ano, mes] = periodo.split('-').map(Number)

    // Criar ou atualizar coleta
    const coleta = await db.coleta.upsert({
      where: {
        indicadorId_periodo: {
          indicadorId: fonte.indicadorId!,
          periodo
        }
      },
      create: {
        indicadorId: fonte.indicadorId!,
        periodo,
        mes,
        ano,
        valor: valorExtraido,
        comentario: `Sincronizado automaticamente de ${fonte.nome}`,
        atingiuMeta,
        atingiuSupermeta,
        bonusCalculado
      },
      update: {
        valor: valorExtraido,
        comentario: `Sincronizado automaticamente de ${fonte.nome}`,
        atingiuMeta,
        atingiuSupermeta,
        bonusCalculado
      }
    })

    // Atualizar status da fonte
    await db.fonteDados.update({
      where: { id },
      data: {
        ultimaSincronizacao: new Date(),
        statusUltimaSync: 'Sucesso',
        mensagemErro: null
      }
    })

    return NextResponse.json({
      success: true,
      modo: 'periodo',
      valor: valorExtraido,
      coleta,
      meta: meta ? {
        meta: meta.meta,
        supermeta: meta.supermeta,
        atingiuMeta,
        atingiuSupermeta
      } : null
    })
  } catch (error) {
    console.error('Erro ao sincronizar fonte de dados:', error)
    
    // Atualizar status de erro
    try {
      const { id } = await params
      await db.fonteDados.update({
        where: { id },
        data: {
          ultimaSincronizacao: new Date(),
          statusUltimaSync: 'Erro',
          mensagemErro: error instanceof Error ? error.message : 'Erro desconhecido'
        }
      })
    } catch (e) {
      console.error('Erro ao atualizar status:', e)
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao sincronizar fonte de dados' 
      },
      { status: 500 }
    )
  }
}
