import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const indicador = await db.indicador.findUnique({
      where: { id },
      include: {
        colaborador: {
          include: { setor: { include: { departamento: true } } }
        },
        metas: { orderBy: { periodo: 'desc' } },
        coletas: { orderBy: { periodo: 'desc' } }
      }
    });
    
    if (!indicador) {
      return NextResponse.json({ error: 'Indicador não encontrado' }, { status: 404 });
    }
    
    return NextResponse.json(indicador);
  } catch (error) {
    console.error('Erro ao buscar indicador:', error);
    return NextResponse.json({ error: 'Erro ao buscar indicador' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nome, medida, frequencia, nivel, tipoMeta, bonusMeta, bonusSupermeta } = body;
    
    const indicador = await db.indicador.update({
      where: { id },
      data: {
        nome,
        medida,
        frequencia,
        nivel,
        tipoMeta,
        bonusMeta,
        bonusSupermeta
      },
      include: {
        colaborador: { include: { setor: { include: { departamento: true } } } }
      }
    });
    
    return NextResponse.json(indicador);
  } catch (error) {
    console.error('Erro ao atualizar indicador:', error);
    return NextResponse.json({ error: 'Erro ao atualizar indicador' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.indicador.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir indicador:', error);
    return NextResponse.json({ error: 'Erro ao excluir indicador' }, { status: 500 });
  }
}
