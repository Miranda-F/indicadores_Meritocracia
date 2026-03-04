import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo'); // YYYY-MM
    
    // KPIs gerais
    const totalColaboradores = await db.colaborador.count({ where: { ativo: true } });
    const totalIndicadores = await db.indicador.count();
    const totalDepartamentos = await db.departamento.count();
    const totalSetores = await db.setor.count();
    
    // Metas e coletas por período
    let metasAtingidas = 0;
    let supermetasAtingidas = 0;
    let totalColetas = 0;
    let totalBonus = 0;
    let coletasSemMeta = 0;
    
    if (periodo) {
      const coletasPeriodo = await db.coleta.findMany({
        where: { periodo }
      });
      
      totalColetas = coletasPeriodo.length;
      metasAtingidas = coletasPeriodo.filter(c => c.atingiuMeta && !c.atingiuSupermeta).length;
      supermetasAtingidas = coletasPeriodo.filter(c => c.atingiuSupermeta).length;
      coletasSemMeta = coletasPeriodo.filter(c => !c.atingiuMeta).length;
      totalBonus = coletasPeriodo.reduce((sum, c) => sum + c.bonusCalculado, 0);
    }
    
    // Colaboradores por departamento
    const colaboradoresPorDepartamento = await db.departamento.findMany({
      include: {
        setores: {
          include: {
            _count: { select: { colaboradores: true } }
          }
        }
      }
    });
    
    const departamentosStats = colaboradoresPorDepartamento.map(d => ({
      nome: d.nome,
      colaboradores: d.setores.reduce((sum, s) => sum + s._count.colaboradores, 0)
    }));
    
    // Top performers (por período)
    let topPerformers: Array<{
      nome: string;
      funcao: string;
      indicadores: number;
      metasAtingidas: number;
      supermetasAtingidas: number;
      bonusTotal: number;
    }> = [];
    
    // Performance por departamento
    let performanceDepartamentos: Array<{
      nome: string;
      totalIndicadores: number;
      metasAtingidas: number;
      supermetasAtingidas: number;
      totalBonus: number;
      taxaSucesso: number;
    }> = [];
    
    // Performance por setor
    let performanceSetores: Array<{
      departamento: string;
      nome: string;
      totalIndicadores: number;
      metasAtingidas: number;
      supermetasAtingidas: number;
      totalBonus: number;
      taxaSucesso: number;
    }> = [];
    
    // Evolução mensal (últimos 6 meses)
    let evolucaoMensal: Array<{
      periodo: string;
      mes: string;
      total: number;
      metas: number;
      supermetas: number;
      naoAtingidas: number;
      bonus: number;
    }> = [];
    
    // Indicadores com melhor/pior performance
    let indicadoresTop: Array<{
      nome: string;
      colaborador: string;
      tipoMeta: string;
      taxaSucesso: number;
      totalAvaliacoes: number;
    }> = [];
    
    if (periodo) {
      // Top performers
      const colaboradores = await db.colaborador.findMany({
        where: { ativo: true },
        include: {
          indicadores: {
            include: {
              coletas: { where: { periodo } }
            }
          }
        }
      });
      
      topPerformers = colaboradores
        .map(c => {
          const coletas = c.indicadores.flatMap(i => i.coletas);
          return {
            nome: c.nome,
            funcao: c.funcao,
            indicadores: c.indicadores.length,
            metasAtingidas: coletas.filter(co => co.atingiuMeta && !co.atingiuSupermeta).length,
            supermetasAtingidas: coletas.filter(co => co.atingiuSupermeta).length,
            bonusTotal: coletas.reduce((sum, co) => sum + co.bonusCalculado, 0)
          };
        })
        .filter(c => c.bonusTotal > 0)
        .sort((a, b) => b.bonusTotal - a.bonusTotal)
        .slice(0, 10);
      
      // Performance por departamento
      const departamentos = await db.departamento.findMany({
        include: {
          setores: {
            include: {
              colaboradores: {
                include: {
                  indicadores: {
                    include: {
                      coletas: { where: { periodo } }
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      performanceDepartamentos = departamentos.map(d => {
        const indicadores = d.setores.flatMap(s => s.colaboradores.flatMap(c => c.indicadores));
        const coletas = indicadores.flatMap(i => i.coletas);
        const metas = coletas.filter(c => c.atingiuMeta).length;
        const supermetas = coletas.filter(c => c.atingiuSupermeta).length;
        const bonus = coletas.reduce((sum, c) => sum + c.bonusCalculado, 0);
        const total = coletas.length;
        
        return {
          nome: d.nome,
          totalIndicadores: indicadores.length,
          metasAtingidas: metas - supermetas,
          supermetasAtingidas: supermetas,
          totalBonus: bonus,
          taxaSucesso: total > 0 ? ((metas / total) * 100) : 0
        };
      }).sort((a, b) => b.taxaSucesso - a.taxaSucesso);
      
      // Performance por setor
      const setores = await db.setor.findMany({
        include: {
          departamento: true,
          colaboradores: {
            include: {
              indicadores: {
                include: {
                  coletas: { where: { periodo } }
                }
              }
            }
          }
        }
      });
      
      performanceSetores = setores.map(s => {
        const indicadores = s.colaboradores.flatMap(c => c.indicadores);
        const coletas = indicadores.flatMap(i => i.coletas);
        const metas = coletas.filter(c => c.atingiuMeta).length;
        const supermetas = coletas.filter(c => c.atingiuSupermeta).length;
        const bonus = coletas.reduce((sum, c) => sum + c.bonusCalculado, 0);
        const total = coletas.length;
        
        return {
          departamento: s.departamento.nome,
          nome: s.nome,
          totalIndicadores: indicadores.length,
          metasAtingidas: metas - supermetas,
          supermetasAtingidas: supermetas,
          totalBonus: bonus,
          taxaSucesso: total > 0 ? ((metas / total) * 100) : 0
        };
      }).filter(s => s.totalIndicadores > 0).sort((a, b) => b.totalBonus - a.totalBonus);
    }
    
    // Evolução mensal (últimos 6 meses)
    const hoje = new Date();
    const meses: Array<{ periodo: string; mesNome: string }> = [];
    for (let i = 5; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mes = data.getMonth() + 1;
      const ano = data.getFullYear();
      meses.push({
        periodo: `${ano}-${String(mes).padStart(2, '0')}`,
        mesNome: data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      });
    }
    
    for (const m of meses) {
      const coletasMes = await db.coleta.findMany({
        where: { periodo: m.periodo }
      });
      
      const metas = coletasMes.filter(c => c.atingiuMeta && !c.atingiuSupermeta).length;
      const supermetas = coletasMes.filter(c => c.atingiuSupermeta).length;
      const naoAtingidas = coletasMes.filter(c => !c.atingiuMeta).length;
      const bonus = coletasMes.reduce((sum, c) => sum + c.bonusCalculado, 0);
      
      evolucaoMensal.push({
        periodo: m.periodo,
        mes: m.mesNome,
        total: coletasMes.length,
        metas,
        supermetas,
        naoAtingidas,
        bonus
      });
    }
    
    // Indicadores com melhor performance
    const indicadores = await db.indicador.findMany({
      include: {
        colaborador: true,
        coletas: periodo ? { where: { periodo } } : true
      }
    });
    
    indicadoresTop = indicadores
      .map(ind => {
        const total = ind.coletas.length;
        const metas = ind.coletas.filter(c => c.atingiuMeta).length;
        return {
          nome: ind.nome,
          colaborador: ind.colaborador.nome,
          tipoMeta: ind.tipoMeta || 'maior_que',
          taxaSucesso: total > 0 ? ((metas / total) * 100) : 0,
          totalAvaliacoes: total
        };
      })
      .filter(i => i.totalAvaliacoes >= 3) // Pelo menos 3 avaliações
      .sort((a, b) => b.taxaSucesso - a.taxaSucesso)
      .slice(0, 5);
    
    // Performance por nível
    const performancePorNivel = await db.colaborador.groupBy({
      by: ['nivel'],
      where: { ativo: true },
      _count: { id: true }
    });
    
    return NextResponse.json({
      kpis: {
        totalColaboradores,
        totalIndicadores,
        totalDepartamentos,
        totalSetores,
        metasAtingidas,
        supermetasAtingidas,
        coletasSemMeta,
        totalColetas,
        totalBonus
      },
      departamentosStats,
      topPerformers,
      performanceDepartamentos,
      performanceSetores,
      evolucaoMensal,
      indicadoresTop,
      performancePorNivel
    });
  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    return NextResponse.json({ error: 'Erro ao buscar dashboard' }, { status: 500 });
  }
}
