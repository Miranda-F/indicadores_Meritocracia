import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// API para histórico de metas - v3
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const indicadorId = searchParams.get('indicadorId');
    const periodo = searchParams.get('periodo');
    
    if (indicadorId && periodo) {
      // Buscar meta pelo indicador e período usando SQL direto
      const metaResult = await db.$queryRaw<Array<{
        id: string;
        indicadorId: string;
        periodo: string;
        mes: number;
        ano: number;
        meta: number;
        supermeta: number;
        versao: number;
        ativa: number;
      }>>`
        SELECT id, indicadorId, periodo, mes, ano, meta, supermeta, versao, ativa 
        FROM Meta 
        WHERE indicadorId = ${indicadorId} AND periodo = ${periodo}
        LIMIT 1
      `;
      
      if (!metaResult || metaResult.length === 0) {
        return NextResponse.json({ 
          error: 'Meta não encontrada', 
          historico: [],
          meta: null
        });
      }
      
      const metaRecord = metaResult[0];
      
      // Buscar histórico da meta usando SQL direto
      const historico = await db.$queryRaw<Array<{
        id: string;
        metaId: string;
        metaAnterior: number;
        supermetaAnterior: number;
        metaNova: number;
        supermetaNova: number;
        versaoAnterior: number;
        versaoNova: number;
        dataAlteracao: string;
        motivo: string | null;
        usuario: string | null;
        observacao: string | null;
        createdAt: string;
      }>>`
        SELECT id, metaId, metaAnterior, supermetaAnterior, metaNova, supermetaNova, 
               versaoAnterior, versaoNova, dataAlteracao, motivo, usuario, observacao, createdAt
        FROM MetaHistorico 
        WHERE metaId = ${metaRecord.id}
        ORDER BY dataAlteracao DESC
      `;
      
      return NextResponse.json({ 
        ...metaRecord, 
        historico: historico || [] 
      });
    }
    
    return NextResponse.json({ historico: [] });
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    return NextResponse.json({ error: 'Erro ao buscar histórico: ' + String(error), historico: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { indicadorId, periodo, mes, ano, meta: metaValor, supermeta, motivo, usuario, observacao } = body;
    
    // Buscar meta existente usando SQL direto
    const metas = await db.$queryRaw<Array<{
      id: string;
      meta: number;
      supermeta: number;
      versao: number;
    }>>`
      SELECT id, meta, supermeta, versao FROM Meta WHERE indicadorId = ${indicadorId} AND periodo = ${periodo}
    `;
    
    const metaExistente = metas?.[0];
    
    if (metaExistente) {
      // Verificar se houve alteração real nos valores (usar tolerância relativa para valores pequenos)
      const toleranciaAbsoluta = 0.0001;
      const toleranciaRelativa = 0.001; // 0.1% de tolerância relativa
      
      const calcularDiferenca = (antigo: number, novo: number) => {
        if (antigo === 0 && novo === 0) return 0;
        if (antigo === 0) return 1; // 100% de mudança se era zero
        return Math.abs((novo - antigo) / antigo);
      };
      
      const metaMudou = Math.abs(metaExistente.meta - metaValor) > toleranciaAbsoluta && calcularDiferenca(metaExistente.meta, metaValor) > toleranciaRelativa;
      const supermetaMudou = Math.abs(metaExistente.supermeta - supermeta) > toleranciaAbsoluta && calcularDiferenca(metaExistente.supermeta, supermeta) > toleranciaRelativa;
      
      if (!metaMudou && !supermetaMudou) {
        return NextResponse.json({ 
          message: 'Nenhuma alteração detectada',
          meta: metaExistente,
          alteracao: false
        });
      }
      
      const versaoAtual = metaExistente.versao || 1;
      const novaVersao = versaoAtual + 1;
      
      // Registrar histórico da alteração usando SQL direto
      await db.$executeRaw`
        INSERT INTO MetaHistorico (id, metaId, metaAnterior, supermetaAnterior, metaNova, supermetaNova, versaoAnterior, versaoNova, dataAlteracao, motivo, usuario, observacao, createdAt)
        VALUES (lower(hex(randomblob(16))), ${metaExistente.id}, ${metaExistente.meta}, ${metaExistente.supermeta}, ${metaValor}, ${supermeta}, ${versaoAtual}, ${novaVersao}, datetime('now'), ${motivo || null}, ${usuario || null}, ${observacao || null}, datetime('now'))
      `;
      
      // Atualizar meta usando SQL direto
      await db.$executeRaw`
        UPDATE Meta SET meta = ${metaValor}, supermeta = ${supermeta}, versao = ${novaVersao}, updatedAt = datetime('now')
        WHERE id = ${metaExistente.id}
      `;
      
      return NextResponse.json({
        message: 'Meta atualizada com sucesso! Histórico registrado.',
        meta: { ...metaExistente, meta: metaValor, supermeta, versao: novaVersao },
        alteracao: true
      });
    } else {
      // Criar nova meta usando SQL direto
      const mesFinal = mes || parseInt(periodo.split('-')[1]);
      const anoFinal = ano || parseInt(periodo.split('-')[0]);
      const novoId = `cm${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
      
      await db.$executeRaw`
        INSERT INTO Meta (id, indicadorId, periodo, mes, ano, meta, supermeta, versao, ativa, createdAt, updatedAt)
        VALUES (${novoId}, ${indicadorId}, ${periodo}, ${mesFinal}, ${anoFinal}, ${metaValor}, ${supermeta}, 1, 1, datetime('now'), datetime('now'))
      `;
      
      return NextResponse.json({
        message: 'Meta criada com sucesso',
        meta: { id: novoId, indicadorId, periodo, mes: mesFinal, ano: anoFinal, meta: metaValor, supermeta, versao: 1 },
        alteracao: false
      });
    }
  } catch (error) {
    console.error('Erro ao salvar meta:', error);
    return NextResponse.json({ error: 'Erro ao salvar meta: ' + String(error) }, { status: 500 });
  }
}
