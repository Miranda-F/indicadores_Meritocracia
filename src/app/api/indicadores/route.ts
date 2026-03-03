import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const colaboradorId = searchParams.get('colaboradorId');
    
    const where: Record<string, unknown> = {};
    if (colaboradorId) where.colaboradorId = colaboradorId;
    
    const indicadores = await db.indicador.findMany({
      where,
      include: {
        colaborador: {
          include: {
            setor: { include: { departamento: true } }
          }
        },
        metas: { orderBy: { periodo: 'desc' } },
        coletas: { orderBy: { periodo: 'desc' }, take: 12 },
        _count: { select: { metas: true, coletas: true } }
      },
      orderBy: [
        { colaborador: { nome: 'asc' } },
        { nome: 'asc' }
      ]
    });
    
    return NextResponse.json(indicadores);
  } catch (error) {
    console.error('Erro ao buscar indicadores:', error);
    return NextResponse.json({ error: 'Erro ao buscar indicadores' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, medida, frequencia, nivel, tipoMeta, bonusMeta, bonusSupermeta, colaboradorId, identificador } = body;
    
    const indicador = await db.indicador.create({
      data: {
        nome,
        medida: medida || 'R$',
        frequencia: frequencia || 'Mensal',
        nivel: nivel || 1,
        tipoMeta: tipoMeta || 'maior_que',
        bonusMeta: bonusMeta || 0,
        bonusSupermeta: bonusSupermeta || 0,
        colaboradorId,
        identificador
      },
      include: {
        colaborador: { include: { setor: { include: { departamento: true } } } }
      }
    });
    
    return NextResponse.json(indicador);
  } catch (error) {
    console.error('Erro ao criar indicador:', error);
    return NextResponse.json({ error: 'Erro ao criar indicador' }, { status: 500 });
  }
}
