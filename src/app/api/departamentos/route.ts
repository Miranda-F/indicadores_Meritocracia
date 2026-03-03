import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const departamentos = await db.departamento.findMany({
      include: {
        setores: true,
        _count: {
          select: { setores: true }
        }
      },
      orderBy: { nome: 'asc' }
    });
    return NextResponse.json(departamentos);
  } catch (error) {
    console.error('Erro ao buscar departamentos:', error);
    return NextResponse.json({ error: 'Erro ao buscar departamentos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome } = body;
    
    const departamento = await db.departamento.create({
      data: { nome }
    });
    
    return NextResponse.json(departamento);
  } catch (error) {
    console.error('Erro ao criar departamento:', error);
    return NextResponse.json({ error: 'Erro ao criar departamento' }, { status: 500 });
  }
}
