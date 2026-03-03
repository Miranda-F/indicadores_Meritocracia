import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST - Testar conexão com a fonte de dados
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
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

    // Fazer a requisição
    const fetchOptions: RequestInit = {
      method: fonte.metodo,
      headers
    }

    if (fonte.metodo !== 'GET' && fonte.body) {
      fetchOptions.body = fonte.body
    }

    const startTime = Date.now()
    const response = await fetch(fonte.url, fetchOptions)
    const responseTime = Date.now() - startTime

    const responseText = await response.text()
    let responseData: unknown = responseText

    // Tentar parsear como JSON
    try {
      responseData = JSON.parse(responseText)
    } catch {
      // Manter como texto se não for JSON
    }

    // Extrair valor do campo configurado
    let valorExtraido: unknown = null
    if (response.ok && responseData && typeof responseData === 'object') {
      const campo = fonte.campoValor
      // Suporta notação de ponto (ex: "data.valor")
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
      valorExtraido = current
    }

    // Atualizar status da última sincronização
    await db.fonteDados.update({
      where: { id },
      data: {
        ultimaSincronizacao: new Date(),
        statusUltimaSync: response.ok ? 'Sucesso' : 'Erro',
        mensagemErro: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
      }
    })

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      responseTime,
      data: responseData,
      valorExtraido,
      campoValor: fonte.campoValor
    })
  } catch (error) {
    console.error('Erro ao testar fonte de dados:', error)
    
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
        error: error instanceof Error ? error.message : 'Erro ao conectar com a fonte de dados' 
      },
      { status: 500 }
    )
  }
}
