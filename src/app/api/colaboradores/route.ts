import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const setorId = searchParams.get('setorId');
    const ativo = searchParams.get('ativo');
    
    const where: Record<string, unknown> = {};
    if (setorId) where.setorId = setorId;
    if (ativo !== null) where.ativo = ativo === 'true';
    
    const colaboradores = await db.colaborador.findMany({
      where,
      include: {
        setor: {
          include: { departamento: true }
        },
        indicadores: {
          include: {
            metas: true,
            _count: { select: { coletas: true } }
          }
        }
      },
      orderBy: { nome: 'asc' }
    });
    
    return NextResponse.json(colaboradores);
  } catch (error) {
    console.error('Erro ao buscar colaboradores:', error);
    return NextResponse.json({ error: 'Erro ao buscar colaboradores' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, funcao, status, nivel, setorId } = body;
    
    const colaborador = await db.colaborador.create({
      data: {
        nome,
        funcao,
        status: status || 'A',
        nivel: nivel || 1,
        ativo: status === 'A',
        setorId
      },
      include: {
        setor: { include: { departamento: true } }
      }
    });
    
    return NextResponse.json(colaborador);
  } catch (error) {
    console.error('Erro ao criar colaborador:', error);
    return NextResponse.json({ error: 'Erro ao criar colaborador' }, { status: 500 });
  }
}
