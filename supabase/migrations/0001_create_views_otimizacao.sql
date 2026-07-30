-- ═══════════════════════════════════════════════════════════════════
-- VIEWS DE OTIMIZAÇÃO T&P - LSL TRANSPORTES
-- ═══════════════════════════════════════════════════════════════════
-- Objetivo: Reduzir em ATÉ 99% as requisições/leituras das consultas
-- mais pesadas do app (KPIs de progresso + Resumo por Locações).
--
-- COMO USAR:
--   1. Abra o painel do Supabase → SQL Editor
--   2. Copie TODO este arquivo e cole
--   3. Clique em "RUN" (executar)
--   4. Pronto! O app detecta automaticamente as Views no próximo load.
--
-- NÃO HÁ RISCO: Views NÃO alteram dados; são só SELECTs virtualizados.
-- Você pode apagar e recriar quando quiser sem perder informação.
-- ═══════════════════════════════════════════════════════════════════

-- -------------------------------------------------------------------
-- VIEW 1: stats_tp_view → 1 LINHA com contagem de status dos 8.600+ SKUs
--     ANTES: 8.600 linhas transferidas → DEPOIS: 1 linha
--     Economia: ~99,99% de transferência e carga no frontend
-- -------------------------------------------------------------------
CREATE OR REPLACE VIEW stats_tp_view AS
SELECT
  COUNT(*)::bigint                                          AS total,
  COUNT(*) FILTER (WHERE status = 'mapeado')::bigint        AS concluidos,
  COUNT(*) FILTER (WHERE status = 'andamento')::bigint      AS andamento,
  (
    COUNT(*)
    - COUNT(*) FILTER (WHERE status = 'mapeado')
    - COUNT(*) FILTER (WHERE status = 'andamento')
  )::bigint                                                  AS pendentes
FROM sku_tp;

-- -------------------------------------------------------------------
-- VIEW 2 (OPCIONAL MAS ALTAMENTE RECOMENDADA):
--   resumo_locacao_view → Agrupa saldo_estoque × sku_tp POR LOCAÇÃO
--     ANTES: 2 consultas paginadas (saldo + sku_tp) → várias MB
--     DEPOIS: 1 SELECT, agregação feita no Postgres
--
--   Observação: esta View é um "RESUMO GERAL" por locação (contadores).
--   A lista detalhada de itens dentro de cada locação continua sendo
--   buscada pela função getResumoLocacoes() (que também tem cache).
-- -------------------------------------------------------------------
CREATE OR REPLACE VIEW resumo_locacao_view AS
SELECT
  TRIM(UPPER(COALESCE(s.locacao, 'SEM LOCAÇÃO'))) AS locacao,
  COUNT(*)::integer                                AS total_itens,
  COUNT(*) FILTER (
    WHERE tp.status = 'mapeado'
  )::integer                                        AS mapeados,
  COUNT(*) FILTER (
    WHERE tp.status IS NOT NULL AND tp.status <> 'mapeado'
  )::integer                                        AS pendentes,
  COUNT(*) FILTER (WHERE tp.sku IS NULL)::integer  AS nao_na_estrutura
FROM saldo_estoque s
LEFT JOIN sku_tp tp ON tp.sku = s.sku
GROUP BY 1
ORDER BY 1;

-- -------------------------------------------------------------------
-- VIEW 3 (OPCIONAL): unique_analysts_view
--   Lista de analistas únicos (para filtros do relatório)
-- -------------------------------------------------------------------
CREATE OR REPLACE VIEW unique_analysts_view AS
SELECT DISTINCT TRIM(responsavel) AS nome
FROM sku_tp
WHERE responsavel IS NOT NULL AND TRIM(responsavel) <> ''
ORDER BY 1;

-- -------------------------------------------------------------------
-- VIEW 4 (OPCIONAL): unique_modelos_view
--   Lista de modelos únicos (para filtros do relatório)
-- -------------------------------------------------------------------
CREATE OR REPLACE VIEW unique_modelos_view AS
SELECT DISTINCT TRIM(modelo) AS modelo
FROM sku_tp
WHERE modelo IS NOT NULL AND TRIM(modelo) <> ''
ORDER BY 1;
