import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const colaboradorId = searchParams.get('colaboradorId');
    const periodo = searchParams.get('periodo');
    const ano = searchParams.get('ano');
    
    if (colaboradorId && periodo) {
      // Performance de um colaborador específico em um período
      const colaborador = await db.colaborador.findUnique({
        where: { id: colaboradorId },
        include: {
          setor: { include: { departamento: true } },
          indicadores: {
            include: {
              metas: { where: { periodo } },
              coletas: { where: { periodo } }
            }
          }
        }
      });
      
      if (!colaborador) {
        return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 });
      }
      
      const performance = colaborador.indicadores.map(ind => {
        const meta = ind.metas[0];
        const coleta = ind.coletas[0];
        
        return {
          indicador: ind.nome,
          meta: meta?.meta || 0,
          supermeta: meta?.supermeta || 0,
          realizado: coleta?.valor || 0,
          atingiuMeta: coleta?.atingiuMeta || false,
          atingiuSupermeta: coleta?.atingiuSupermeta || false,
          bonusCalculado: coleta?.bonusCalculado || 0,
          percentualAtingido: meta && coleta 
            ? ((coleta.valor / meta.meta) * 100).toFixed(1)
            : 0
        };
      });
      
      const bonusTotal = performance.reduce((sum, p) => sum + p.bonusCalculado, 0);
      
      return NextResponse.json({
        colaborador: {
          nome: colaborador.nome,
          funcao: colaborador.funcao,
          nivel: colaborador.nivel,
          setor: colaborador.setor.nome,
          departamento: colaborador.setor.departamento.nome
        },
        periodo,
        performance,
        resumo: {
          totalIndicadores: performance.length,
          metasAtingidas: performance.filter(p => p.atingiuMeta).length,
          supermetasAtingidas: performance.filter(p => p.atingiuSupermeta).length,
          bonusTotal
        }
      });
    }
    
    if (ano) {
      // Performance anual de todos os colaboradores
      const colaboradores = await db.colaborador.findMany({
        where: { ativo: true },
        include: {
          setor: { include: { departamento: true } },
          indicadores: {
            include: {
              metas: { where: { ano: parseInt(ano) } },
              coletas: { where: { ano: parseInt(ano) } }
            }
          }
        }
      });
      
      const performanceAnual = colaboradores.map(c => {
        const bonusAnual = c.indicadores.reduce((sum, ind) => {
          return sum + ind.coletas.reduce((s, co) => s + co.bonusCalculado, 0);
        }, 0);
        
        const metasAtingidas = c.indicadores.reduce((sum, ind) => {
          return sum + ind.coletas.filter(co => co.atingiuMeta).length;
        }, 0);
        
        const supermetasAtingidas = c.indicadores.reduce((sum, ind) => {
          return sum + ind.coletas.filter(co => co.atingiuSupermeta).length;
        }, 0);
        
        const totalColetas = c.indicadores.reduce((sum, ind) => {
          return sum + ind.coletas.length;
        }, 0);
        
        return {
          id: c.id,
          nome: c.nome,
          funcao: c.funcao,
          nivel: c.nivel,
          setor: c.setor.nome,
          departamento: c.setor.departamento.nome,
          totalIndicadores: c.indicadores.length,
          totalColetas,
          metasAtingidas,
          supermetasAtingidas,
          taxaAtingimento: totalColetas > 0 
            ? ((metasAtingidas / totalColetas) * 100).toFixed(1)
            : 0,
          bonusAnual
        };
      }).sort((a, b) => b.bonusAnual - a.bonusAnual);
      
      return NextResponse.json({
        ano: parseInt(ano),
        colaboradores: performanceAnual,
        resumo: {
          totalColaboradores: performanceAnual.length,
          bonusTotalAnual: performanceAnual.reduce((sum, p) => sum + p.bonusAnual, 0)
        }
      });
    }
    
    // Performance geral do período atual
    const periodoAtual = new Date().toISOString().slice(0, 7);
    
    const coletas = await db.coleta.findMany({
      where: { periodo: periodoAtual },
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
    
    const performancePorColaborador = new Map();
    
    for (const coleta of coletas) {
      const colabId = coleta.indicador.colaborador.id;
      
      if (!performancePorColaborador.has(colabId)) {
        performancePorColaborador.set(colabId, {
          colaborador: coleta.indicador.colaborador,
          indicadores: [],
          bonusTotal: 0,
          metasAtingidas: 0,
          supermetasAtingidas: 0
        });
      }
      
      const perf = performancePorColaborador.get(colabId);
      perf.indicadores.push({
        nome: coleta.indicador.nome,
        valor: coleta.valor,
        atingiuMeta: coleta.atingiuMeta,
        atingiuSupermeta: coleta.atingiuSupermeta,
        bonus: coleta.bonusCalculado
      });
      perf.bonusTotal += coleta.bonusCalculado;
      if (coleta.atingiuMeta) perf.metasAtingidas++;
      if (coleta.atingiuSupermeta) perf.supermetasAtingidas++;
    }
    
    return NextResponse.json({
      periodo: periodoAtual,
      performance: Array.from(performancePorColaborador.values())
        .sort((a, b) => b.bonusTotal - a.bonusTotal)
    });
  } catch (error) {
    console.error('Erro ao buscar performance:', error);
    return NextResponse.json({ error: 'Erro ao buscar performance' }, { status: 500 });
  }
}
