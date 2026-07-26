import { createClient } from '@supabase/supabase-js';

const supabaseUrl = ((import.meta as any).env?.VITE_SUPABASE_URL || 'https://efeikudymqplfamtexgq.supabase.co') as string;
const supabaseKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_IKq4DPh80AlDfYmElLvw4Q_xAUYE6hf') as string;

export const supabase = createClient(supabaseUrl, supabaseKey);

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
  mod_caixa: string;
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
  pegar_ik_t1?: number | null; pegar_ik_t2?: number | null; pegar_ik_t3?: number | null;
  pegar_ik_qtd?: number | null; pegar_ik_res?: number | null;
  // Sub-processo 2: ABRIR CAIXA
  abrir_t1?: number | null; abrir_t2?: number | null; abrir_t3?: number | null;
  abrir_qtd?: number | null; abrir_res?: number | null;
  // Sub-processo 3: FORMATAR
  form_t1?: number | null; form_t2?: number | null; form_t3?: number | null;
  form_unid?: string | null; form_qtd?: number | null; form_res?: number | null;
  // Sub-processo 4: DESCARTAR
  desc_t1?: number | null; desc_t2?: number | null; desc_t3?: number | null;
  desc_qtd?: number | null; desc_res?: number | null;
  // Sub-processo 5: ETIQUETA
  etq_t1?: number | null; etq_t2?: number | null; etq_t3?: number | null;
  etq_qtd?: number | null; etq_res?: number | null;
  // Sub-processo 6: POSICIONAR IK
  pos_t1?: number | null; pos_t2?: number | null; pos_t3?: number | null;
  pos_qtd?: number | null; pos_res?: number | null;
  // Informações adicionais do item
  pecas_kd?: number | null;         // Peças no KD
  tp_emb_forn?: string | null;      // Tipo Embalagem Fornecedor
  pd_emb_forn?: string | null;      // Padrão Embalagem Fornecedor
  tp_emb_dcc?: string | null;       // Tipo Embalagem DCC
  pd_emb_dcc?: string | null;       // Padrão Embalagem DCC
  carro?: string | null;            // Carro
  // Resultado
  tempo_total?: number | null;
  status: 'pendente' | 'andamento' | 'mapeado';
}

const VALID_SKU_TP_COLUMNS = new Set([
  'id', 'sku', 'descricao', 'modelo', 'responsavel', 'data_map',
  'pegar_ik_t1', 'pegar_ik_t2', 'pegar_ik_t3', 'pegar_ik_qtd', 'pegar_ik_res',
  'abrir_t1', 'abrir_t2', 'abrir_t3', 'abrir_qtd', 'abrir_res',
  'form_t1', 'form_t2', 'form_t3', 'form_unid', 'form_qtd', 'form_res',
  'desc_t1', 'desc_t2', 'desc_t3', 'desc_qtd', 'desc_res',
  'etq_t1', 'etq_t2', 'etq_t3', 'etq_qtd', 'etq_res',
  'pos_t1', 'pos_t2', 'pos_t3', 'pos_qtd', 'pos_res',
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
export async function getDashboardAnalytics(): Promise<DashboardData> {
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
      modelos: []
    };
  }

  const total = data.length;
  const concluidos = data.filter(d => d.status === 'mapeado').length;
  const andamento = data.filter(d => d.status === 'andamento').length;
  const pendentes = total - concluidos - andamento;

  // Hoje no formato YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Agrupamento por Analista (responsavel)
  const analistasMap = new Map<string, { hoje: number; total: number; tempos: number[]; timestamps: number[] }>();

  data.forEach(item => {
    if (item.responsavel && item.status !== 'pendente') {
      const name = item.responsavel.trim();
      if (!analistasMap.has(name)) {
        analistasMap.set(name, { hoje: 0, total: 0, tempos: [], timestamps: [] });
      }
      const st = analistasMap.get(name)!;
      st.total += 1;
      if (item.updated_at) {
        if (item.updated_at.startsWith(todayStr)) {
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
  const modelosMap = new Map<string, { total: number; mapeados: number; andamento: number; pendentes: number }>();

  data.forEach(item => {
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
    modelos
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
  if (dataInicio) query = query.gte('data_map', dataInicio);
  if (dataFim) query = query.lte('data_map', dataFim + ' 23:59:59');

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


/** Salva as tomadas de um sub-processo específico de um SKU no Supabase */
export async function saveSubProcessMeasurements(
  sku: string,
  updateFields: Partial<SkuTp>,
  operatorName: string = 'Operador'
): Promise<SkuTp | null> {
  const { data: current } = await supabase
    .from('sku_tp')
    .select('*')
    .eq('sku', sku)
    .single();

  const now = new Date();
  const dataMapStr = now.toISOString();

  const currentTp = current || { sku, status: 'pendente' };
  const merged = {
    ...currentTp,
    ...updateFields,
    responsavel: operatorName,
    data_map: dataMapStr,
    updated_at: now.toISOString()
  };

  const spKeys = ['pegar_ik_t1', 'abrir_t1', 'form_t1', 'desc_t1', 'etq_t1', 'pos_t1'];
  const hasSome = spKeys.some(k => merged[k as keyof SkuTp] != null);
  const hasAll = spKeys.every(k => merged[k as keyof SkuTp] != null);

  if (hasAll) {
    merged.status = 'mapeado';
  } else if (hasSome) {
    merged.status = 'andamento';
  }

  let total = 0;
  ['abrir_res', 'form_res', 'desc_res', 'etq_res', 'pos_res', 'pegar_ik_res'].forEach(resKey => {
    const val = merged[resKey as keyof SkuTp];
    if (typeof val === 'number') total += val;
  });
  merged.tempo_total = Number(total.toFixed(2));

  const cleanMerged = sanitizeSkuTpPayload(merged, false);

  const { data: updated, error } = await supabase
    .from('sku_tp')
    .upsert(cleanMerged, { onConflict: 'sku' })
    .select('*')
    .single();

  if (error) {
    console.error('Erro ao salvar medição:', error);
    return null;
  }
  return updated;
}
