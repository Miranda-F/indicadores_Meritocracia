import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Listar todas as fontes de dados
export async function GET() {
  try {
    const fontes = await db.fonteDados.findMany({
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Mapear para garantir que indicador seja null-safe
    const result = fontes.map(f => ({
      ...f,
      indicador: f.indicador ? {
        ...f.indicador,
        colaborador: f.indicador.colaborador ? {
          ...f.indicador.colaborador,
          setor: f.indicador.colaborador.setor ? {
            ...f.indicador.colaborador.setor,
            departamento: f.indicador.colaborador.setor.departamento || null
          } : null
        } : null
      } : null
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao buscar fontes de dados:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar fontes de dados' },
      { status: 500 }
    )
  }
}

// POST - Criar nova fonte de dados
export async function POST(request: Request) {
  try {
    const data = await request.json()

    const fonte = await db.fonteDados.create({
      data: {
        nome: data.nome,
        descricao: data.descricao || null,
        url: data.url,
        metodo: data.metodo || 'GET',
        headers: data.headers || null,
        body: data.body || null,
        tipoAutenticacao: data.tipoAutenticacao || 'Nenhuma',
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
    console.error('Erro ao criar fonte de dados:', error)
    return NextResponse.json(
      { error: 'Erro ao criar fonte de dados' },
      { status: 500 }
    )
  }
}
