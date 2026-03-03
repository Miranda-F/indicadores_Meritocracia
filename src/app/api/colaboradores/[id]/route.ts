import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const colaborador = await db.colaborador.findUnique({
      where: { id },
      include: {
        setor: { include: { departamento: true } },
        indicadores: {
          include: {
            metas: { orderBy: { periodo: 'desc' } },
            coletas: { orderBy: { periodo: 'desc' }, take: 12 }
          }
        }
      }
    });
    
    if (!colaborador) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }
    
    return NextResponse.json(colaborador);
  } catch (error) {
    console.error('Erro ao buscar colaborador:', error);
    return NextResponse.json({ error: 'Erro ao buscar colaborador' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nome, funcao, status, nivel, setorId } = body;
    
    const colaborador = await db.colaborador.update({
      where: { id },
      data: {
        nome,
        funcao,
        status,
        nivel,
        setorId,
        ativo: status === 'A'
      },
      include: {
        setor: { include: { departamento: true } }
      }
    });
    
    return NextResponse.json(colaborador);
  } catch (error) {
    console.error('Erro ao atualizar colaborador:', error);
    return NextResponse.json({ error: 'Erro ao atualizar colaborador' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.colaborador.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir colaborador:', error);
    return NextResponse.json({ error: 'Erro ao excluir colaborador' }, { status: 500 });
  }
}
