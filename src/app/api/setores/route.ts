import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const setores = await db.setor.findMany({
      include: {
        departamento: true,
        _count: {
          select: { colaboradores: true }
        }
      },
      orderBy: [{ departamento: { nome: 'asc' } }, { nome: 'asc' }]
    });
    return NextResponse.json(setores);
  } catch (error) {
    console.error('Erro ao buscar setores:', error);
    return NextResponse.json({ error: 'Erro ao buscar setores' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, departamentoId } = body;
    
    const setor = await db.setor.create({
      data: { nome, departamentoId },
      include: { departamento: true }
    });
    
    return NextResponse.json(setor);
  } catch (error) {
    console.error('Erro ao criar setor:', error);
    return NextResponse.json({ error: 'Erro ao criar setor' }, { status: 500 });
  }
}
