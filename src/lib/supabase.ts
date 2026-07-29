import { createClient } from '@supabase/supabase-js';

const supabaseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || 'https://efeikudymqplfamtexgq.supabase.co') as string;
const supabaseKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_IKq4DPh80AlDfYmElLvw4Q_xAUYE6hf') as string;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Helpers de Data (Fuso Local — Manaus UTC-4, etc.) ──────────────
// Regra GOLD: Banco SEMPRE grava datas em UTC (.toISOString).
// Quando precisar AGUPAR / COMPARAR por DIA LOCAL (Manaus = UTC-4),
// SEMPRE converta o timestamp UTC para a data de referência LOCAL antes.

/** Converte Data → "YYYY-MM-DD" no FUSO LOCAL DO NAVEGADOR (não UTC).
 *  Ex: 2026-07-29T02:00:00Z (UTC) → 2026-07-28 em Manaus (UTC-4). */
export function localDateKey(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Data "YYYY-MM-DD" no fuso LOCAL → ISO UTC do 1° segundo daquele dia.
 *  Ex: "2026-07-28" em Manaus → 2026-07-28T04:00:00.000Z */
export function localStartOfDayToUtcIso(localDateStr: string): string {
  if (!localDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) return '';
  const [y, m, d] = localDateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

/** Data "YYYY-MM-DD" no fuso LOCAL → ISO UTC do último ms daquele dia.
 *  Ex: "2026-07-28" em Manaus → 2026-07-29T03:59:59.999Z */
export function localEndOfDayToUtcIso(localDateStr: string): string {
  if (!localDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) return '';
  const [y, m, d] = localDateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/** "YYYY-MM-DD HH:MM:SS" em data LOCAL → ISO UTC equivalente.
 *  Usado para converter valores de input do usuário em UTC p/ filtros de query. */
export function localDateTimeToUtcIso(dateStr: string, timeStr = '00:00:00'): string {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  const [h, mi, s] = (timeStr || '00:00:00').split(':').map(n => parseInt(n, 10) || 0);
  if (!y) return '';
  return new Date(y, m - 1, d, h, mi, s, 0).toISOString();
}

// ── Tipos ──────────────────────────────────────────────────────────
export interface SaldoEstoque {
  id?: number;
  sku: string;
  descricao: string;
  chave: string;
  fatura: string;
  kd: string;
  filial: string;
  lote: string;
  fifo: string;
  locacao: string;
  sts: string;
  qtde: number;
  qtde_kd: number;
  modelo: string;
  mod_comp: string;
}

export interface LocacaoItem extends SaldoEstoque {
  tp: SkuTp | null;
  statusCategoria: 'mapeado' | 'pendente' | 'nao_na_estrutura';
}

export interface LocacaoResumo {
  locacao: string;
  totalItens: number;
  mapeados: number;
  pendentes: number;
  naoNaEstrutura: number;
  itens: LocacaoItem[];
}

export interface SkuTp {
  id?: number;
  sku: string;
  descricao: string;
  modelo: string;
  responsavel?: string;
  data_map?: string;
  updated_at?: string;
  // Sub-processo 1: PEGAR IK
  pegar_ik_t1?: number | null; pegar_ik_t2?: number | null; pegar_ik_t3?: number | null; pegar_ik_t4?: number | null; pegar_ik_t5?: number | null;
  pegar_ik_qtd?: number | null; pegar_ik_res?: number | null;
  // Sub-processo 2: ABRIR CAIXA
  abrir_t1?: number | null; abrir_t2?: number | null; abrir_t3?: number | null; abrir_t4?: number | null; abrir_t5?: number | null;
  abrir_qtd?: number | null; abrir_res?: number | null;
  // Sub-processo 3: FORMATAR
  form_t1?: number | null; form_t2?: number | null; form_t3?: number | null; form_t4?: number | null; form_t5?: number | null;
  form_unid?: string | null; form_qtd?: number | null; form_res?: number | null;
  // Sub-processo 4: DESCARTAR
  desc_t1?: number | null; desc_t2?: number | null; desc_t3?: number | null; desc_t4?: number | null; desc_t5?: number | null;
  desc_qtd?: number | null; desc_res?: number | null;
  // Sub-processo 5: ETIQUETA
  etq_t1?: number | null; etq_t2?: number | null; etq_t3?: number | null; etq_t4?: number | null; etq_t5?: number | null;
  etq_qtd?: number | null; etq_res?: number | null;
  // Sub-processo 6: POSICIONAR IK
  pos_t1?: number | null; pos_t2?: number | null; pos_t3?: number | null; pos_t4?: number | null; pos_t5?: number | null;
  pos_qtd?: number | null; pos_res?: number | null;
  // Informações adicionais do item
  pecas_kd?: number | null;
  tp_emb_forn?: string | null;
  pd_emb_forn?: string | null;
  tp_emb_dcc?: string | null;
  pd_emb_dcc?: string | null;
  carro?: string | null;
  // Resultado
  tempo_total?: number | null;
  status: 'pendente' | 'andamento' | 'mapeado';
}

const VALID_SKU_TP_COLUMNS = new Set([
  'id', 'sku', 'descricao', 'modelo', 'responsavel', 'data_map',
  'pegar_ik_t1', 'pegar_ik_t2', 'pegar_ik_t3', 'pegar_ik_t4', 'pegar_ik_t5', 'pegar_ik_qtd', 'pegar_ik_res',
  'abrir_t1', 'abrir_t2', 'abrir_t3', 'abrir_t4', 'abrir_t5', 'abrir_qtd', 'abrir_res',
  'form_t1', 'form_t2', 'form_t3', 'form_t4', 'form_t5', 'form_unid', 'form_qtd', 'form_res',
  'desc_t1', 'desc_t2', 'desc_t3', 'desc_t4', 'desc_t5', 'desc_qtd', 'desc_res',
  'etq_t1', 'etq_t2', 'etq_t3', 'etq_t4', 'etq_t5', 'etq_qtd', 'etq_res',
  'pos_t1', 'pos_t2', 'pos_t3', 'pos_t4', 'pos_t5', 'pos_qtd', 'pos_res',
  'tempo_total', 'status', 'created_at', 'updated_at',
  'pecas_kd', 'tp_emb_forn', 'pd_emb_forn', 'tp_emb_dcc', 'pd_emb_dcc', 'carro'
]);

export function sanitizeSkuTpPayload(payload: Record<string, any>, excludeId = true): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (VALID_SKU_TP_COLUMNS.has(key)) {
      if (excludeId && (key === 'id' || key === 'created_at')) continue;
      clean[key] = value;
    }
  }
  return clean;
}

export interface StatsTp {
  total: number;
  concluidos: number;
  andamento: number;
  pendentes: number;
}

export interface AnalystStat {
  nome: string;
  hoje: number;
  total: number;
  mediaTempo: number;          // Tempo médio do processo (s) por item
  tempoMedioCicloMin: number;  // Intervalo médio entre conclusões (min/item: A -> B -> C...)
  capacidadeEstimadaDia: number; // Projeção de itens/dia
}

export interface ModelStat {
  modelo: string;
  total: number;
  mapeados: number;
  andamento: number;
  pendentes: number;
  percent: number;
}

export interface DashboardData {
  stats: StatsTp;
  analistas: AnalystStat[];
  modelos: ModelStat[];
  /** Rótulo do período selecionado pelo usuário (null = sem filtro) */
  periodLabel: string | null;
  /** Número de itens mapeados/em andamento DENTRO do período (exclui filtro) */
  periodTotalItems: number;
}

// ── Funções de acesso ──────────────────────────────────────────────

/** Busca todos os itens de um KD pela CHAVE do QR Code (normaliza espaços) */
export async function getItensByChave(rawChave: string): Promise<(SaldoEstoque & { tp: SkuTp | null })[]> {
  const chave = rawChave.replace(/\s+/g, '').toUpperCase().trim();

  const { data: saldo, error } = await supabase
    .from('saldo_estoque')
    .select('*')
    .eq('chave', chave);

  if (error) throw error;
  if (!saldo || saldo.length === 0) return [];

  const skus = [...new Set(saldo.map(s => s.sku))];
  const { data: tpData } = await supabase
    .from('sku_tp')
    .select('*')
    .in('sku', skus);

  const tpMap = new Map((tpData || []).map(t => [t.sku, t]));

  return saldo.map(s => ({
    ...s,
    tp: tpMap.get(s.sku) || null
  }));
}

/** Busca resumo por locação (saldo_estoque x sku_tp pendentes de mapeamento) */
export async function getResumoLocacoes(filterLocacao?: string): Promise<LocacaoResumo[]> {
  let allSaldo: SaldoEstoque[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore && page < 50) {
    let query = supabase
      .from('saldo_estoque')
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (filterLocacao && filterLocacao.trim()) {
      query = query.ilike('locacao', `%${filterLocacao.trim()}%`);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      allSaldo = allSaldo.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  if (allSaldo.length === 0) return [];

  // Obter todos os SKUs únicos para consultar na tabela sku_tp
  const skus = [...new Set(allSaldo.map(s => s.sku).filter(Boolean))];
  
  const tpMap = new Map<string, SkuTp>();
  for (let i = 0; i < skus.length; i += 1000) {
    const chunk = skus.slice(i, i + 1000);
    const { data: tpData } = await supabase
      .from('sku_tp')
      .select('*')
      .in('sku', chunk);

    if (tpData) {
      tpData.forEach(t => tpMap.set(t.sku, t));
    }
  }

  // Agrupar por locação (sem repetir a locação)
  const locMap = new Map<string, LocacaoResumo>();

  allSaldo.forEach(item => {
    const loc = (item.locacao || 'SEM LOCAÇÃO').trim().toUpperCase();
    if (!locMap.has(loc)) {
      locMap.set(loc, {
        locacao: loc,
        totalItens: 0,
        mapeados: 0,
        pendentes: 0,
        naoNaEstrutura: 0,
        itens: []
      });
    }

    const locResumo = locMap.get(loc)!;
    const tp = tpMap.get(item.sku) || null;

    let statusCategoria: 'mapeado' | 'pendente' | 'nao_na_estrutura';
    if (!tp) {
      statusCategoria = 'nao_na_estrutura';
      locResumo.naoNaEstrutura += 1;
    } else if (tp.status === 'mapeado') {
      statusCategoria = 'mapeado';
      locResumo.mapeados += 1;
    } else {
      statusCategoria = 'pendente';
      locResumo.pendentes += 1;
    }

    locResumo.totalItens += 1;
    locResumo.itens.push({
      ...item,
      tp,
      statusCategoria
    });
  });

  return Array.from(locMap.values()).sort((a, b) => a.locacao.localeCompare(b.locacao));
}

/** Busca estatísticas globais de progresso */
export async function getStatsTp(): Promise<StatsTp> {
  const { data, count, error } = await supabase
    .from('sku_tp')
    .select('status', { count: 'exact' });

  if (error || !data) {
    return { total: 8643, concluidos: 0, andamento: 0, pendentes: 8643 };
  }

  const total = count || data.length || 8643;
  const concluidos = data.filter(d => d.status === 'mapeado').length;
  const andamento = data.filter(d => d.status === 'andamento').length;
  const pendentes = total - concluidos - andamento;

  return { total, concluidos, andamento, pendentes };
}

/** Busca analítica completa para o Dashboard (Produtividade por analista e Resumo por modelo) */
export interface DashboardDateRange {
  /** 'YYYY-MM-DD' no fuso LOCAL (Manaus). Se vazio, não limita início. */
  startDate?: string;
  /** 'YYYY-MM-DD' no fuso LOCAL (Manaus). Se vazio, não limita fim. */
  endDate?: string;
}

export async function getDashboardAnalytics(dateRange?: DashboardDateRange): Promise<DashboardData> {
  // Converte datas do filtro (fuso LOCAL) → limites de timestamp em UTC
  // que usaremos p/ decidir se um item entra na contagem de produtividade do período.
  const gteTs = dateRange?.startDate ? new Date(localStartOfDayToUtcIso(dateRange.startDate)).getTime() : -Infinity;
  const lteTs = dateRange?.endDate   ? new Date(localEndOfDayToUtcIso(dateRange.endDate)).getTime()   :  Infinity;
  const hasFilter = (dateRange?.startDate != null && dateRange.startDate !== '') ||
                    (dateRange?.endDate   != null && dateRange.endDate   !== '');

  // Rótulo que vai no card do analista no lugar de "Hoje" quando filtro ativo
  const periodLabel = (() => {
    if (!hasFilter) return null;
    const s = dateRange?.startDate;
    const e = dateRange?.endDate;
    if (s && e && s === e) return 'No Dia';
    return 'No Período';
  })();

  // Supabase PostgREST limita a 1.000 linhas por requisição por padrão.
  // Fazemos paginação em lote de 1.000 para carregar TODOS os 18.000+ SKUs!
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore && page < 50) { // limite de segurança 50k linhas
    const { data: pageData, error } = await supabase
      .from('sku_tp')
      .select('id, sku, modelo, responsavel, status, tempo_total, updated_at')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !pageData || pageData.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(pageData);
      if (pageData.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  const data = allData;

  if (!data || data.length === 0) {
    return {
      stats: { total: 0, concluidos: 0, andamento: 0, pendentes: 0 },
      analistas: [],
      modelos: [],
      periodLabel,
      periodTotalItems: 0
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // KPI Cards do topo (TOTAL GERAL DA ESTRUTURA — ignoram filtro
  // de data, pois representam o "estado atual do trabalho")
  // ═══════════════════════════════════════════════════════════════
  const total = data.length;
  const concluidos = data.filter(d => d.status === 'mapeado').length;
  const andamento = data.filter(d => d.status === 'andamento').length;
  const pendentes = total - concluidos - andamento;

  // Usa DATA LOCAL DO NAVEGADOR (não UTC) para bater com fusos como Manaus (UTC-4)
  // ex: 22:00 do dia 27 local = 02:00 dia 28 UTC — queremos "hoje" = dia 27
  const todayStr = localDateKey(new Date());

  // Predicado: UM ITEM CONTA NA PRODUTIVIDADE DO PERÍODO?
  // Sem filtro → sempre true (todo o histórico).
  // Com filtro → requer updated_at (tempo em ms) DENTRO de [gteTs, lteTs].
  const inPeriod = (item: any) => {
    if (!hasFilter) return true;
    if (!item.updated_at) return false;
    const ts = new Date(item.updated_at).getTime();
    return ts >= gteTs && ts <= lteTs;
  };

  // 1. Agrupamento por Analista (responsavel)
  const analistasMap = new Map<string, { hoje: number; total: number; tempos: number[]; timestamps: number[] }>();
  let periodTotalItems = 0;

  data.forEach(item => {
    if (item.responsavel && item.status !== 'pendente' && inPeriod(item)) {
      periodTotalItems += 1;
      const name = item.responsavel.trim();
      if (!analistasMap.has(name)) {
        analistasMap.set(name, { hoje: 0, total: 0, tempos: [], timestamps: [] });
      }
      const st = analistasMap.get(name)!;
      st.total += 1;
      if (item.updated_at) {
        // ATENÇÃO: updated_at no banco está em UTC. Para comparar "hoje" com
        // dia local Manaus, converte o timestamp UTC → chave de data local antes.
        if (localDateKey(item.updated_at) === todayStr) {
          st.hoje += 1;
        }
        st.timestamps.push(new Date(item.updated_at).getTime());
      }
      if (item.tempo_total && item.tempo_total > 0) {
        st.tempos.push(item.tempo_total);
      }
    }
  });

  const analistas: AnalystStat[] = Array.from(analistasMap.entries()).map(([nome, st]) => {
    // Média de tempo cronometrado da peça (segundos)
    const avgTempoProcesso = st.tempos.length > 0
      ? Number((st.tempos.reduce((a, b) => a + b, 0) / st.tempos.length).toFixed(2))
      : 0;

    // Cálculo do tempo entre o item A -> B -> C... (minutos de intervalo entre registros)
    let tempoMedioCicloMin = 0;
    if (st.timestamps.length > 1) {
      const sortedTs = [...st.timestamps].sort((a, b) => a - b);
      const intervalsMin: number[] = [];
      for (let i = 1; i < sortedTs.length; i++) {
        const diffMs = sortedTs[i] - sortedTs[i - 1];
        const diffMin = diffMs / (1000 * 60);
        // Desconsidera intervalos maiores que 45 min (pausas de almoço/turnos)
        if (diffMin > 0.05 && diffMin <= 45) {
          intervalsMin.push(diffMin);
        }
      }
      if (intervalsMin.length > 0) {
        tempoMedioCicloMin = Number((intervalsMin.reduce((a, b) => a + b, 0) / intervalsMin.length).toFixed(1));
      }
    }

    // Se não houver histórico de datas suficiente, estima pelo tempo cronometrado + 1,5 min de manuseio/troca
    if (tempoMedioCicloMin === 0) {
      tempoMedioCicloMin = Number(((avgTempoProcesso / 60) + 1.5).toFixed(1));
    }

    // Projeção diária por analista (Jornada útil de 7h = 420 min / ritmo por item)
    const capacidadeEstimadaDia = tempoMedioCicloMin > 0 ? Math.round(420 / tempoMedioCicloMin) : 0;

    return {
      nome,
      hoje: st.hoje,
      total: st.total,
      mediaTempo: avgTempoProcesso,
      tempoMedioCicloMin,
      capacidadeEstimadaDia
    };
  }).sort((a, b) => b.total - a.total);

  // 2. Agrupamento por Modelo (modelo)
  // Com filtro de data: considera SOMENTE os itens do PERÍODO filtrado
  // (mostra modelos "ativos" em produtividade durante o período)
  // Sem filtro: mostra TUDO (100% da estrutura atual)
  const modelosMap = new Map<string, { total: number; mapeados: number; andamento: number; pendentes: number }>();

  data.forEach(item => {
    if (hasFilter && !inPeriod(item)) return;
    const mod = (item.modelo || 'Sem Modelo').trim().toUpperCase();
    if (!modelosMap.has(mod)) {
      modelosMap.set(mod, { total: 0, mapeados: 0, andamento: 0, pendentes: 0 });
    }
    const m = modelosMap.get(mod)!;
    m.total += 1;
    if (item.status === 'mapeado') m.mapeados += 1;
    else if (item.status === 'andamento') m.andamento += 1;
    else m.pendentes += 1;
  });

  const modelos: ModelStat[] = Array.from(modelosMap.entries()).map(([modelo, m]) => ({
    modelo,
    total: m.total,
    mapeados: m.mapeados,
    andamento: m.andamento,
    pendentes: m.pendentes,
    percent: m.total > 0 ? Number(((m.mapeados / m.total) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.total - a.total);

  return {
    stats: { total, concluidos, andamento, pendentes },
    analistas,
    modelos,
    periodLabel,
    periodTotalItems
  };
}

/** Busca lista de SKUs com suporte a filtro e busca por código/descrição */
export async function getSkusList(search: string = '', limit: number = 50): Promise<SkuTp[]> {
  let query = supabase
    .from('sku_tp')
    .select('*')
    .order('id', { ascending: true })
    .limit(limit);

  if (search.trim()) {
    const s = search.trim();
    query = query.or(`sku.ilike.%${s}%,descricao.ilike.%${s}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Erro ao buscar lista de SKUs:', error);
    return [];
  }
  return data || [];
}

export interface SkusReportFilters {
  search?: string;
  modelo?: string;
  status?: string;
  responsavel?: string;
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string;    // YYYY-MM-DD
  page?: number;
  pageSize?: number;
}

/** Busca itens para o Relatório com filtros avançados + paginação */
export async function getSkusReport(
  filters: SkusReportFilters = {}
): Promise<{ data: SkuTp[]; total: number }> {
  const { search, modelo, status, responsavel, dataInicio, dataFim, page = 0, pageSize = 50 } = filters;

  let query = supabase
    .from('sku_tp')
    .select('*', { count: 'exact' })
    .order('sku', { ascending: true });

  if (search?.trim()) {
    const s = search.trim();
    query = query.or(`sku.ilike.%${s}%,descricao.ilike.%${s}%`);
  }
  if (modelo?.trim()) query = query.ilike('modelo', `%${modelo.trim()}%`);
  if (status?.trim()) query = query.eq('status', status.trim());
  if (responsavel?.trim()) query = query.ilike('responsavel', `%${responsavel.trim()}%`);
  // IMPORTANTE: dataInicio e dataFim chegam como "YYYY-MM-DD" no fuso LOCAL do usuário.
  // No banco, data_map está armazenado como ISO UTC via new Date().toISOString().
  // Precisamos converter:
  //   dataInicio = "2026-07-28" Manaus → UTC = 2026-07-28T04:00:00.000Z  (gte)
  //   dataFim    = "2026-07-28" Manaus → UTC = 2026-07-29T03:59:59.999Z  (lte)
  const gte = localStartOfDayToUtcIso(dataInicio || '');
  const lte = localEndOfDayToUtcIso(dataFim || '');
  if (gte) query = query.gte('data_map', gte);
  if (lte) query = query.lte('data_map', lte);

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('Erro ao buscar relatório de SKUs:', error);
    return { data: [], total: 0 };
  }
  return { data: data || [], total: count || 0 };
}

/** Busca lista de modelos únicos para o filtro (paginado para pegar todos os 8.600+ SKUs) */
export async function getUniqueModels(): Promise<string[]> {
  let allModels: string[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && page < 20) {
    const { data, error } = await supabase
      .from('sku_tp')
      .select('modelo')
      .not('modelo', 'is', null)
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(d => { if (d.modelo) allModels.push(d.modelo.trim()); });
      if (data.length < 1000) hasMore = false;
      else page++;
    }
  }

  return [...new Set(allModels)].sort();
}

/** Busca lista de analistas únicos para o filtro (paginado para pegar todos os 8.600+ SKUs) */
export async function getUniqueAnalysts(): Promise<string[]> {
  let allAnalysts: string[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore && page < 20) {
    const { data, error } = await supabase
      .from('sku_tp')
      .select('responsavel')
      .not('responsavel', 'is', null)
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(d => { if (d.responsavel) allAnalysts.push(d.responsavel.trim()); });
      if (data.length < 1000) hasMore = false;
      else page++;
    }
  }

  return [...new Set(allAnalysts)].sort();
}


/** Salva as tomadas de um sub-processo específico de um SKU no Supabase.
 *  PROTEÇÃO CONCORRÊNCIA: Sempre lê a versão MAIS RECENTE do banco imediatamente antes
 *  de escrever (evita sobrepor gravações de outros analistas feitas enquanto este cliente
 *  estava com dados em cache). Usa operações de MERGE campo-a-campo.
 */
export async function saveSubProcessMeasurements(
  sku: string,
  updateFields: Partial<SkuTp>,
  operatorName: string = 'Operador',
  maxRetries: number = 3
): Promise<SkuTp | null> {
  let lastErr: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 1) BUSCA FRESCA DO BANCO (nunca usa cache de client aqui)
      const { data: current, error: errSel } = await supabase
        .from('sku_tp')
        .select('*')
        .eq('sku', sku)
        .single();

      if (errSel && !current) throw errSel;

      const now = new Date();
      const dataMapStr = now.toISOString();

      const currentTp: any = current || { sku, status: 'pendente' };

      // 2) MERGE CAMPO-A-CAMPO: só atualiza campos em updateFields que tem VALOR EXPLÍCITO (null também vale = apagar tomada).
      // Campos não mencionados em updateFields → mantém valor do banco (evita sobrepor writes concorrentes).
      const merged: any = { ...currentTp };
      for (const k of Object.keys(updateFields)) {
        merged[k] = (updateFields as any)[k];
      }
      merged.responsavel = operatorName;
      merged.data_map = dataMapStr;
      merged.updated_at = now.toISOString();

      // 3) Recalcula status com base nos valores do banco + campos novos aplicados
      const spKeys = ['pegar_ik_t1', 'abrir_t1', 'form_t1', 'desc_t1', 'etq_t1', 'pos_t1'];
      const hasSome = spKeys.some(k => merged[k] != null);
      const hasAll = spKeys.every(k => merged[k] != null);

      const jaMapeado = currentTp.status === 'mapeado';
      if (jaMapeado) {
        merged.status = 'mapeado';
      } else if (hasAll) {
        merged.status = 'mapeado';
      } else if (hasSome) {
        merged.status = 'andamento';
      } else {
        merged.status = currentTp.status || 'pendente';
      }

      // 4) Recalcula tempo_total com base nos *_res frescos
      let total = 0;
      ['abrir_res', 'form_res', 'desc_res', 'etq_res', 'pos_res', 'pegar_ik_res'].forEach(resKey => {
        const val = merged[resKey];
        if (typeof val === 'number') total += val;
      });
      merged.tempo_total = Number(total.toFixed(2));

      const cleanMerged = sanitizeSkuTpPayload(merged, false);

      // 5) UPSERT com retorno da linha mais recente do banco
      const { data: updated, error } = await supabase
        .from('sku_tp')
        .upsert(cleanMerged, { onConflict: 'sku' })
        .select('*')
        .single();

      if (error) throw error;

      return updated as SkuTp;
    } catch (err: any) {
      lastErr = err;
      console.warn(`[saveSubProcessMeasurements] Tentativa ${attempt}/${maxRetries} falhou para SKU ${sku}:`, err);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 150 * attempt)); // backoff linear
      }
    }
  }

  console.error(`[saveSubProcessMeasurements] Falhou após ${maxRetries} tentativas para SKU ${sku}:`, lastErr);
  return null;
}

/** Grava UMA tomada calculando o SLOT VAZIO usando DADOS FRESCOS DO BANCO.
 *  Essa é a função SEGURA para múltiplos analistas — evita sobrescrever tomadas simultâneas.
 *  Retorna SKU atualizado do banco ou null em caso de falha.
 */
export async function recordMeasurementSafe(
  sku: string,
  processoId: 'pegar_ik' | 'abrir' | 'form' | 'desc' | 'etq' | 'pos',
  tempoSegundos: number,
  qtdUnid: number | null,
  operatorName: string = 'Operador',
  maxRetries: number = 4
): Promise<SkuTp | null> {
  const processKeyMap: Record<string, { t1: string; t2: string; t3: string; t4: string; t5: string; res: string; qtd: string }> = {
    pegar_ik: { t1: 'pegar_ik_t1', t2: 'pegar_ik_t2', t3: 'pegar_ik_t3', t4: 'pegar_ik_t4', t5: 'pegar_ik_t5', res: 'pegar_ik_res', qtd: 'pegar_ik_qtd' },
    abrir:    { t1: 'abrir_t1',    t2: 'abrir_t2',    t3: 'abrir_t3',    t4: 'abrir_t4',    t5: 'abrir_t5',    res: 'abrir_res',    qtd: 'abrir_qtd' },
    form:     { t1: 'form_t1',     t2: 'form_t2',     t3: 'form_t3',     t4: 'form_t4',     t5: 'form_t5',     res: 'form_res',     qtd: 'form_qtd' },
    desc:     { t1: 'desc_t1',     t2: 'desc_t2',     t3: 'desc_t3',     t4: 'desc_t4',     t5: 'desc_t5',     res: 'desc_res',     qtd: 'desc_qtd' },
    etq:      { t1: 'etq_t1',      t2: 'etq_t2',      t3: 'etq_t3',      t4: 'etq_t4',      t5: 'etq_t5',      res: 'etq_res',      qtd: 'etq_qtd' },
    pos:      { t1: 'pos_t1',      t2: 'pos_t2',      t3: 'pos_t3',      t4: 'pos_t4',      t5: 'pos_t5',      res: 'pos_res',      qtd: 'pos_qtd' },
  };
  const keys = processKeyMap[processoId];
  if (!keys) return null;

  const tVal = Number(tempoSegundos.toFixed(2));
  let lastErr: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 1) READ FRESH: pega a versão MAIS ATUALIZADA do banco NESTE EXATO MOMENTO
      const { data: fresh, error: errSel } = await supabase
        .from('sku_tp')
        .select('*')
        .eq('sku', sku)
        .single();

      if (errSel && !fresh) throw errSel;

      const row: any = fresh || { sku, status: 'pendente' };

      // 2) CALCULA SLOT VAZIO baseado nos valores DO BANCO (não do cache local!)
      const tKeys = [keys.t1, keys.t2, keys.t3, keys.t4, keys.t5];
      let targetKey = keys.t5;
      for (let i = 0; i < tKeys.length; i++) {
        const v = row[tKeys[i]];
        if (v == null || v === 0) { targetKey = tKeys[i]; break; }
      }

      // 3) Aplica a nova tomada no slot correto, preserva valores das outras tomadas
      const updated: any = { ...row };
      updated[targetKey] = tVal;
      if (qtdUnid != null && !isNaN(qtdUnid)) {
        updated[keys.qtd] = qtdUnid;
      }

      // 4) Recalcula a MÉDIA (_res) baseada nas 5 tomadas DO BANCO + a nova
      const validTs = tKeys
        .map(k => updated[k])
        .filter((v: any) => typeof v === 'number' && v > 0) as number[];
      const avg = validTs.length > 0
        ? Number((validTs.reduce((a, b) => a + b, 0) / validTs.length).toFixed(2))
        : null;
      updated[keys.res] = avg;

      // 5) Usa saveSubProcessMeasurements que já mergeia, calcula status e tempo_total com retries internos
      const fieldsToSave: Partial<SkuTp> = {};
      (fieldsToSave as any)[targetKey] = tVal;
      (fieldsToSave as any)[keys.res] = avg;
      if (qtdUnid != null && !isNaN(qtdUnid)) {
        (fieldsToSave as any)[keys.qtd] = qtdUnid;
      }

      const result = await saveSubProcessMeasurements(sku, fieldsToSave, operatorName, 2);
      if (result) return result;
      throw new Error('saveSubProcessMeasurements retornou null');
    } catch (err: any) {
      lastErr = err;
      console.warn(`[recordMeasurementSafe] Tentativa ${attempt}/${maxRetries} falhou (${processoId} @ ${sku}):`, err);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 200 * attempt + Math.random() * 100));
      }
    }
  }

  console.error(`[recordMeasurementSafe] Falhou após ${maxRetries} tentativas (${processoId} @ ${sku}):`, lastErr);
  return null;
}

/** Remove UMA tomada individual (ex: "pegar_ik_t3") e recalcula a média (_res) do processo no banco.
 *  Retorna SKU atualizado (com valores do banco) ou null em caso de erro.
 */
export async function clearSingleMeasurement(
  sku: string,
  processoId: 'pegar_ik' | 'abrir' | 'form' | 'desc' | 'etq' | 'pos',
  slot: 1 | 2 | 3 | 4 | 5,
  operatorName: string = 'Operador'
): Promise<SkuTp | null> {
  const processKeyMap: Record<string, { t1: string; t2: string; t3: string; t4: string; t5: string; res: string }> = {
    pegar_ik: { t1: 'pegar_ik_t1', t2: 'pegar_ik_t2', t3: 'pegar_ik_t3', t4: 'pegar_ik_t4', t5: 'pegar_ik_t5', res: 'pegar_ik_res' },
    abrir:    { t1: 'abrir_t1',    t2: 'abrir_t2',    t3: 'abrir_t3',    t4: 'abrir_t4',    t5: 'abrir_t5',    res: 'abrir_res' },
    form:     { t1: 'form_t1',     t2: 'form_t2',     t3: 'form_t3',     t4: 'form_t4',     t5: 'form_t5',     res: 'form_res' },
    desc:     { t1: 'desc_t1',     t2: 'desc_t2',     t3: 'desc_t3',     t4: 'desc_t4',     t5: 'desc_t5',     res: 'desc_res' },
    etq:      { t1: 'etq_t1',      t2: 'etq_t2',      t3: 'etq_t3',      t4: 'etq_t4',      t5: 'etq_t5',      res: 'etq_res' },
    pos:      { t1: 'pos_t1',      t2: 'pos_t2',      t3: 'pos_t3',      t4: 'pos_t4',      t5: 'pos_t5',      res: 'pos_res' },
  };
  const keys = processKeyMap[processoId];
  if (!keys) return null;
  const slotKey = (keys as any)[`t${slot}`];
  if (!slotKey) return null;

  const { data: fresh }: any = await supabase
    .from('sku_tp')
    .select('*')
    .eq('sku', sku)
    .single();

  if (!fresh) return null;

  const newTs = { ...fresh };
  newTs[slotKey] = null;

  const validTs = [1,2,3,4,5]
    .map(i => newTs[(keys as any)[`t${i}`]])
    .filter((v: any) => typeof v === 'number' && v > 0) as number[];
  const avg = validTs.length > 0
    ? Number((validTs.reduce((a, b) => a + b, 0) / validTs.length).toFixed(2))
    : null;
  newTs[keys.res] = avg;

  const clean: Partial<SkuTp> = {};
  (clean as any)[slotKey] = null;
  (clean as any)[keys.res] = avg;
  return await saveSubProcessMeasurements(sku, clean, operatorName);
}

/** Força um SKU a ter status 'mapeado' (conclusão manual mesmo com processos incompletos) */
export async function confirmarMapeamentoForcado(
  sku: string,
  operatorName: string = 'Operador'
): Promise<SkuTp | null> {
  const { data: current } = await supabase
    .from('sku_tp')
    .select('*')
    .eq('sku', sku)
    .single();

  const now = new Date();
  const currentTp = current || { sku, status: 'pendente' };

  // Calcula tempo_total atual com base nos valores já salvos
  let total = 0;
  ['abrir_res', 'form_res', 'desc_res', 'etq_res', 'pos_res', 'pegar_ik_res'].forEach(resKey => {
    const val = (currentTp as any)[resKey];
    if (typeof val === 'number') total += val;
  });

  const merged = {
    ...currentTp,
    tempo_total: Number(total.toFixed(2)),
    status: 'mapeado' as const,
    responsavel: operatorName,
    data_map: (currentTp as any).data_map || now.toISOString(),
    updated_at: now.toISOString()
  };

  const cleanMerged = sanitizeSkuTpPayload(merged, false);

  const { data: updated, error } = await supabase
    .from('sku_tp')
    .upsert(cleanMerged, { onConflict: 'sku' })
    .select('*')
    .single();

  if (error) {
    console.error('Erro ao confirmar mapeamento forçado:', error);
    return null;
  }
  return updated;
}
