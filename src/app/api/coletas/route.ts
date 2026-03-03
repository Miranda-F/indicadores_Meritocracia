import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const indicadorId = searchParams.get('indicadorId');
    const colaboradorId = searchParams.get('colaboradorId');
    const periodo = searchParams.get('periodo');
    const ano = searchParams.get('ano');
    
    const where: Record<string, unknown> = {};
    if (indicadorId) where.indicadorId = indicadorId;
    if (colaboradorId) where.colaboradorId = colaboradorId;
    if (periodo) where.periodo = periodo;
    if (ano) where.ano = parseInt(ano);
    
    const coletas = await db.coleta.findMany({
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
      orderBy: [
        { ano: 'desc' },
        { mes: 'desc' }
      ]
    });
    
    return NextResponse.json(coletas);
  } catch (error) {
    console.error('Erro ao buscar coletas:', error);
    return NextResponse.json({ error: 'Erro ao buscar coletas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { indicadorId, colaboradorId, periodo, mes, ano, valor, comentario } = body;
    
    const indicador = await db.indicador.findUnique({
      where: { id: indicadorId },
      include: { metas: { where: { periodo } } }
    });
    
    if (!indicador) {
      return NextResponse.json({ error: 'Indicador não encontrado' }, { status: 404 });
    }
    
    const metaRecord = indicador.metas[0];
    let atingiuMeta = false;
    let atingiuSupermeta = false;
    let bonusCalculado = 0;
    
    if (metaRecord) {
      const tipoMeta = indicador.tipoMeta || 'maior_que';
      
      if (tipoMeta === 'menor_que') {
        // Para custos/despesas: quanto menor, melhor
        atingiuMeta = valor <= metaRecord.meta;
        atingiuSupermeta = valor <= metaRecord.supermeta;
      } else {
        // Para receitas/vendas: quanto maior, melhor
        atingiuMeta = valor >= metaRecord.meta;
        atingiuSupermeta = valor >= metaRecord.supermeta;
      }
      
      if (atingiuSupermeta) {
        bonusCalculado = indicador.bonusSupermeta;
      } else if (atingiuMeta) {
        bonusCalculado = indicador.bonusMeta;
      }
    }
    
    const coleta = await db.coleta.upsert({
      where: {
        indicadorId_periodo: { indicadorId, periodo }
      },
      create: {
        indicadorId,
        colaboradorId,
        periodo,
        mes,
        ano,
        valor,
        comentario,
        atingiuMeta,
        atingiuSupermeta,
        bonusCalculado
      },
      update: {
        valor,
        comentario,
        atingiuMeta,
        atingiuSupermeta,
        bonusCalculado,
        dataColeta: new Date()
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
    
    return NextResponse.json(coleta);
  } catch (error) {
    console.error('Erro ao criar/atualizar coleta:', error);
    return NextResponse.json({ error: 'Erro ao criar/atualizar coleta' }, { status: 500 });
  }
}
