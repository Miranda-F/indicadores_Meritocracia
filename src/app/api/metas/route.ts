import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const indicadorId = searchParams.get('indicadorId');
    const periodo = searchParams.get('periodo');
    
    const where: Record<string, unknown> = {};
    if (indicadorId) where.indicadorId = indicadorId;
    if (periodo) where.periodo = periodo;
    
    const metas = await db.meta.findMany({
      where,
      include: {
        indicador: {
          include: {
            colaborador: {
              include: { setor: { include: { departamento: true } } }
            }
          }
        }
      },
      orderBy: { periodo: 'desc' }
    });
    
    return NextResponse.json(metas);
  } catch (error) {
    console.error('Erro ao buscar metas:', error);
    return NextResponse.json({ error: 'Erro ao buscar metas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { indicadorId, periodo, mes, ano, meta, supermeta } = body;
    
    const metaRecord = await db.meta.upsert({
      where: {
        indicadorId_periodo: { indicadorId, periodo }
      },
      create: {
        indicadorId,
        periodo,
        mes,
        ano,
        meta,
        supermeta
      },
      update: {
        meta,
        supermeta,
        mes,
        ano
      },
      include: {
        indicador: {
          include: {
            colaborador: {
              include: { setor: { include: { departamento: true } } }
            }
          }
        }
      }
    });
    
    return NextResponse.json(metaRecord);
  } catch (error) {
    console.error('Erro ao criar/atualizar meta:', error);
    return NextResponse.json({ error: 'Erro ao criar/atualizar meta' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, meta, supermeta } = body;
    
    const metaRecord = await db.meta.update({
      where: { id },
      data: { meta, supermeta },
      include: {
        indicador: {
          include: {
            colaborador: {
              include: { setor: { include: { departamento: true } } }
            }
          }
        }
      }
    });
    
    return NextResponse.json(metaRecord);
  } catch (error) {
    console.error('Erro ao atualizar meta:', error);
    return NextResponse.json({ error: 'Erro ao atualizar meta' }, { status: 500 });
  }
}
