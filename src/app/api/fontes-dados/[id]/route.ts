import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Buscar fonte de dados por ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const fonte = await db.fonteDados.findUnique({
      where: { id },
      include: {
        indicador: {
          include: {
            colaborador: {
              include: {
                setor: {
                  include: {
                    departamento: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!fonte) {
      return NextResponse.json(
        { error: 'Fonte de dados não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(fonte)
  } catch (error) {
    console.error('Erro ao buscar fonte de dados:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar fonte de dados' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar fonte de dados
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()

    const fonte = await db.fonteDados.update({
      where: { id },
      data: {
        nome: data.nome,
        descricao: data.descricao || null,
        url: data.url,
        metodo: data.metodo,
        headers: data.headers || null,
        body: data.body || null,
        tipoAutenticacao: data.tipoAutenticacao,
        tokenAutenticacao: data.tokenAutenticacao || null,
        headerAuthName: data.headerAuthName || null,
        mapeamento: data.mapeamento || null,
        campoValor: data.campoValor || 'valor',
        indicadorId: data.indicadorId || null,
        ativo: data.ativo !== false
      },
      include: {
        indicador: {
          include: {
            colaborador: true
          }
        }
      }
    })

    return NextResponse.json(fonte)
  } catch (error) {
    console.error('Erro ao atualizar fonte de dados:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar fonte de dados' },
      { status: 500 }
    )
  }
}

// DELETE - Excluir fonte de dados
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await db.fonteDados.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir fonte de dados:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir fonte de dados' },
      { status: 500 }
    )
  }
}
