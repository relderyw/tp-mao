-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 0002: REORDENAÇÃO DE COLUNAS + NOVA COLUNA tp_map
-- ═══════════════════════════════════════════════════════════════════
-- Reordena a tabela sku_tp na ordem EXATA requisitada e adiciona a
-- coluna tp_map (dias úteis desde o mapeamento, atualizada automaticamente
-- via TRIGGER toda vez que data_map ou status mudarem).
--
-- IMPORTANTE (!):
--   Esta migration recria a tabela com a ordem de colunas correta.
--   NÃO HÁ PERDA DE DADOS — os dados são copiados via CREATE TABLE ... AS SELECT
--   e depois o RLS/constraints são reaplicados.
--
--   Rode apenas 1 vez no SQL Editor do Supabase.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Criamos uma NOVA tabela com a ORDEM DE COLUNAS requisitada
--    (Postgres não permite "reorder columns" via ALTER TABLE;
--     esta é a forma canônica e segura de fazer).
CREATE TABLE IF NOT EXISTS sku_tp_new (
  -- Primeiro bloco: Identificação e auditoria
  id                     BIGSERIAL PRIMARY KEY,
  sku                    TEXT NOT NULL,
  descricao              TEXT DEFAULT '',
  modelo                 TEXT DEFAULT '',
  responsavel            TEXT,
  data_map               TIMESTAMPTZ,

  -- Sub-processo 1: PEGAR IK
  pegar_ik_t1            DOUBLE PRECISION,
  pegar_ik_t2            DOUBLE PRECISION,
  pegar_ik_t3            DOUBLE PRECISION,
  pegar_ik_t4            DOUBLE PRECISION,
  pegar_ik_t5            DOUBLE PRECISION,
  pegar_ik_qtd           DOUBLE PRECISION,
  pegar_ik_res           DOUBLE PRECISION,

  -- Sub-processo 2: ABRIR CAIXA
  abrir_t1               DOUBLE PRECISION,
  abrir_t2               DOUBLE PRECISION,
  abrir_t3               DOUBLE PRECISION,
  abrir_t4               DOUBLE PRECISION,
  abrir_t5               DOUBLE PRECISION,
  abrir_qtd              DOUBLE PRECISION,
  abrir_res              DOUBLE PRECISION,

  -- Sub-processo 3: FORMATAR
  form_t1                DOUBLE PRECISION,
  form_t2                DOUBLE PRECISION,
  form_t3                DOUBLE PRECISION,
  form_t4                DOUBLE PRECISION,
  form_t5                DOUBLE PRECISION,
  form_unid              TEXT,
  form_qtd               DOUBLE PRECISION,
  form_res               DOUBLE PRECISION,

  -- Sub-processo 4: DESCARTAR
  desc_t1                DOUBLE PRECISION,
  desc_t2                DOUBLE PRECISION,
  desc_t3                DOUBLE PRECISION,
  desc_t4                DOUBLE PRECISION,
  desc_t5                DOUBLE PRECISION,
  desc_qtd               DOUBLE PRECISION,
  desc_res               DOUBLE PRECISION,

  -- Sub-processo 5: ETIQUETA
  etq_t1                 DOUBLE PRECISION,
  etq_t2                 DOUBLE PRECISION,
  etq_t3                 DOUBLE PRECISION,
  etq_t4                 DOUBLE PRECISION,
  etq_t5                 DOUBLE PRECISION,
  etq_qtd                DOUBLE PRECISION,
  etq_res                DOUBLE PRECISION,

  -- Sub-processo 6: POSICIONAR IK
  pos_t1                 DOUBLE PRECISION,
  pos_t2                 DOUBLE PRECISION,
  pos_t3                 DOUBLE PRECISION,
  pos_t4                 DOUBLE PRECISION,
  pos_t5                 DOUBLE PRECISION,
  pos_qtd                DOUBLE PRECISION,
  pos_res                DOUBLE PRECISION,

  -- Resultados
  tempo_total            DOUBLE PRECISION,
  status                 TEXT NOT NULL DEFAULT 'pendente',

  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),

  -- Informações específicas FORN / DCC
  pecas_kd               DOUBLE PRECISION,
  tp_emb_forn            TEXT,
  pd_emb_forn            TEXT,
  tp_emb_dcc             TEXT,
  pd_emb_dcc             TEXT,
  carro                  TEXT,

  -- NOVA COLUNA: dias úteis (seg-sex) desde data_map → HOJE
  -- Ex: item mapeado HOJE → tp_map = 0. Amanhã (dia útil) → tp_map = 1.
  -- Sábado/domingo NÃO contam. NULL quando status != 'mapeado' / sem data_map.
  tp_map                 INTEGER
);

-- 2) Copiar TODOS os dados da tabela antiga para a nova
INSERT INTO sku_tp_new (
  id, sku, descricao, modelo, responsavel, data_map,
  pegar_ik_t1, pegar_ik_t2, pegar_ik_t3, pegar_ik_t4, pegar_ik_t5, pegar_ik_qtd, pegar_ik_res,
  abrir_t1, abrir_t2, abrir_t3, abrir_t4, abrir_t5, abrir_qtd, abrir_res,
  form_t1, form_t2, form_t3, form_t4, form_t5, form_unid, form_qtd, form_res,
  desc_t1, desc_t2, desc_t3, desc_t4, desc_t5, desc_qtd, desc_res,
  etq_t1, etq_t2, etq_t3, etq_t4, etq_t5, etq_qtd, etq_res,
  pos_t1, pos_t2, pos_t3, pos_t4, pos_t5, pos_qtd, pos_res,
  tempo_total, status, created_at, updated_at,
  pecas_kd, tp_emb_forn, pd_emb_forn, tp_emb_dcc, pd_emb_dcc, carro,
  tp_map
)
SELECT
  id, sku, COALESCE(descricao,''), COALESCE(modelo,''), responsavel, data_map,
  pegar_ik_t1, pegar_ik_t2, pegar_ik_t3, pegar_ik_t4, pegar_ik_t5, pegar_ik_qtd, pegar_ik_res,
  abrir_t1, abrir_t2, abrir_t3, abrir_t4, abrir_t5, abrir_qtd, abrir_res,
  form_t1, form_t2, form_t3, form_t4, form_t5, form_unid, form_qtd, form_res,
  desc_t1, desc_t2, desc_t3, desc_t4, desc_t5, desc_qtd, desc_res,
  etq_t1, etq_t2, etq_t3, etq_t4, etq_t5, etq_qtd, etq_res,
  pos_t1, pos_t2, pos_t3, pos_t4, pos_t5, pos_qtd, pos_res,
  tempo_total, status, created_at, updated_at,
  pecas_kd, tp_emb_forn, pd_emb_forn, tp_emb_dcc, pd_emb_dcc, carro,
  NULL -- tp_map será populado depois pelo cálculo abaixo
FROM sku_tp
ON CONFLICT (id) DO NOTHING;

-- 3) Troca de nomes ATÔMICA (1 transação)
DROP TABLE IF EXISTS sku_tp_old;
ALTER TABLE sku_tp RENAME TO sku_tp_old;
ALTER TABLE sku_tp_new RENAME TO sku_tp;

-- 4) Recriar UNIQUE constraint em sku (usado pelo UPSERT do app)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sku_tp_sku_unique ON sku_tp(sku);

-- 5) Recriar índices de performance
CREATE INDEX IF NOT EXISTS idx_sku_tp_status ON sku_tp(status);
CREATE INDEX IF NOT EXISTS idx_sku_tp_modelo ON sku_tp(modelo);
CREATE INDEX IF NOT EXISTS idx_sku_tp_responsavel ON sku_tp(responsavel);
CREATE INDEX IF NOT EXISTS idx_sku_tp_data_map ON sku_tp(data_map);
CREATE INDEX IF NOT EXISTS idx_sku_tp_tp_map ON sku_tp(tp_map);

-- ═══════════════════════════════════════════════════════════════════
-- FUNÇÃO: contar_dias_uteis
--   Conta dias úteis (segunda a sexta) ENTRE DUAS DATAS.
--   Sábado = 6, Domingo = 0 no EXTRACT(DOW).
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION contar_dias_uteis(data_inicio DATE, data_fim DATE)
RETURNS INTEGER AS $$
DECLARE
  total INTEGER := 0;
  dia   DATE;
BEGIN
  IF data_inicio IS NULL OR data_fim IS NULL THEN RETURN NULL; END IF;
  IF data_fim < data_inicio THEN RETURN 0; END IF;

  dia := data_inicio;
  WHILE dia <= data_fim LOOP
    IF EXTRACT(DOW FROM dia) NOT IN (0, 6) THEN
      total := total + 1;
    END IF;
    dia := dia + INTERVAL '1 day';
  END LOOP;
  -- "Hoje" conta como 0 dias passados (subtrai 1)
  RETURN GREATEST(0, total - 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER: atualiza tp_map SEMPRE que data_map ou status forem alterados
--   Também popula tp_map com NULL se status != 'mapeado'
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_atualiza_tp_map()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'mapeado' AND NEW.data_map IS NOT NULL THEN
    NEW.tp_map := contar_dias_uteis(
      DATE_TRUNC('day', NEW.data_map AT TIME ZONE 'America/Manaus')::DATE,
      DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Manaus')::DATE
    );
  ELSE
    NEW.tp_map := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atualiza_tp_map ON sku_tp;
CREATE TRIGGER trg_atualiza_tp_map
BEFORE INSERT OR UPDATE OF data_map, status ON sku_tp
FOR EACH ROW
EXECUTE FUNCTION fn_atualiza_tp_map();

-- ═══════════════════════════════════════════════════════════════════
-- POPULA INICIALMENTE o tp_map para todos os itens já mapeados
-- (o trigger acima vai rodar a cada UPDATE a partir de agora)
-- ═══════════════════════════════════════════════════════════════════
UPDATE sku_tp
SET status = status -- força a execução do trigger para todo mundo
WHERE status = 'mapeado' OR data_map IS NOT NULL;

-- (Re)cria as Views otimizadas da migration 0001 (no caso de a troca de
-- nomes ter causado invalidação)
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
