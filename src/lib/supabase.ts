/**
 * ═══════════════════════════════════════════════════════════════════
 * FIRESTORE DATABASE SERVICE (Substituição de alta performance do Supabase)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Todas as operações agora leem e gravam no Google Cloud Firestore.
 * Mantém 100% de compatibilidade com as assinaturas de funções existentes.
 */

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  limit as firestoreLimit
} from 'firebase/firestore';

// ── Helpers de Data (Fuso Local — Manaus UTC-4, etc.) ──────────────
export const MANAUS_TZ = 'America/Manaus';

/** Converte Data → "YYYY-MM-DD" no FUSO LOCAL DO NAVEGADOR (não UTC). */
export function localDateKey(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Extrai YYYY-MM-DD do início de um timestamp ISO (ignora conversão de fuso). */
export function parseIsoCalendarDate(raw: string): { y: number; m: number; d: number } | null {
  const m = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

/** Registros antigos gravados só como data viram meia-noite UTC → 20:00 falso em Manaus. */
export function isLegacyDateOnlyTimestamp(raw: string, d: Date): boolean {
  const trimmed = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
         d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/** "YYYY-MM-DD…" → "dd/MM/yyyy" sem deslocar o dia por fuso horário. */
export function fmtLegacyCalendarDate(raw: string): string {
  const cal = parseIsoCalendarDate(raw);
  if (!cal) return '—';
  return `${String(cal.d).padStart(2, '0')}/${String(cal.m).padStart(2, '0')}/${cal.y}`;
}

/** Converte ISO-UTC (ou Date) → "dd/MM/yyyy" no fuso EXPLÍCITO de Manaus. */
export function fmtManausDate(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const raw = String(dateInput);
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return raw;
    if (isLegacyDateOnlyTimestamp(raw, d)) return fmtLegacyCalendarDate(raw);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: MANAUS_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch { return String(dateInput); }
}

/** Converte ISO-UTC (ou Date) → "dd/MM/yyyy HH:mm" no fuso EXPLÍCITO de Manaus. */
export function fmtManausDateTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const raw = String(dateInput);
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return raw;

    if (isLegacyDateOnlyTimestamp(raw, d)) {
      return fmtLegacyCalendarDate(raw);
    }

    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: MANAUS_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d).reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value; return acc;
    }, {});
    return `${partes.day}/${partes.month}/${partes.year}\n${partes.hour}:${partes.minute}`;
  } catch { return String(dateInput); }
}

/** Converte ISO-UTC (ou Date) → "HH:mm" no fuso EXPLÍCITO de Manaus. */
export function fmtManausTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return '';
  try {
    const raw = String(dateInput);
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    if (isLegacyDateOnlyTimestamp(raw, d)) return '';
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: MANAUS_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d).reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value; return acc;
    }, {});
    return `${partes.hour}:${partes.minute}`;
  } catch { return ''; }
}

export function fmtMappingDate(dataMap?: string | null, _updatedAt?: string | null): string {
  return fmtManausDate(dataMap);
}

export function fmtMappingTime(dataMap?: string | null, updatedAt?: string | null): string {
  if (!dataMap) return updatedAt ? fmtManausTime(updatedAt) : '';
  try {
    const raw = String(dataMap);
    const d = new Date(dataMap);
    if (isNaN(d.getTime())) return '';
    if (isLegacyDateOnlyTimestamp(raw, d)) {
      return updatedAt ? fmtManausTime(updatedAt) : '';
    }
    return fmtManausTime(d);
  } catch { return ''; }
}

export function fmtMappingDateTime(dataMap?: string | null, updatedAt?: string | null): string {
  const date = fmtMappingDate(dataMap, updatedAt);
  const time = fmtMappingTime(dataMap, updatedAt);
  if (date === '—') return '—';
  return time ? `${date} ${time}` : date;
}

export function localStartOfDayToUtcIso(localDateStr: string): string {
  if (!localDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) return '';
  const [y, m, d] = localDateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

export function localEndOfDayToUtcIso(localDateStr: string): string {
  if (!localDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(localDateStr)) return '';
  const [y, m, d] = localDateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

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
  tp_map?: number | null;
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
  'pecas_kd', 'tp_emb_forn', 'pd_emb_forn', 'tp_emb_dcc', 'pd_emb_dcc', 'carro',
  'tp_map'
]);

export function sanitizeSkuTpPayload(payload: Record<string, any>, excludeId = true): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (VALID_SKU_TP_COLUMNS.has(key)) {
      if (excludeId && (key === 'id' || key === 'created_at')) continue;
      if (value !== undefined) clean[key] = value;
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
  mediaTempo: number;
  tempoMedioCicloMin: number;
  capacidadeEstimadaDia: number;
}

export interface ModelStat {
  modelo: string;
  total: number;
  mapeados: number;
  andamento: number;
  pendentes: number;
  percent: number;
}

export interface TpMapBucket {
  dias: number;
  quantidade: number;
  label: string;
}

export interface DashboardData {
  stats: StatsTp;
  analistas: AnalystStat[];
  modelos: ModelStat[];
  periodLabel: string | null;
  periodTotalItems: number;
  tpMapDistribution: TpMapBucket[];
  mappingDates: { data: string; quantidade: number }[];
  hojeMapeados: number;
}

export interface DashboardDateRange {
  startDate?: string;
  endDate?: string;
}

export interface SkusReportFilters {
  search?: string;
  modelo?: string;
  status?: string;
  responsavel?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

// ── In-Memory Cache (TTL) ──────────────────────────────────────────
type CacheEntry<T> = { data: T; expiry: number };

const CACHE = {
  stats: null as CacheEntry<StatsTp> | null,
  resumoLoc: new Map<string, CacheEntry<LocacaoResumo[]>>(),
  uniqueModels: null as CacheEntry<string[]> | null,
  uniqueAnalysts: null as CacheEntry<string[]> | null,
  allSkus: null as CacheEntry<SkuTp[]> | null,
};

const TTL = {
  STATS_MS: 30_000,
  RESUMO_LOC_MS: 30_000,
  UNIQUE_MODEL_MS: 120_000,
  UNIQUE_ANALYS_MS: 60_000,
  ALL_SKUS_MS: 20_000,
};

export function invalidateCachesAfterWrite(): void {
  CACHE.stats = null;
  CACHE.resumoLoc.clear();
  CACHE.allSkus = null;
}

function cacheGet<T>(entry: CacheEntry<T> | null): T | null {
  if (!entry) return null;
  if (Date.now() > entry.expiry) return null;
  return entry.data;
}

function cacheSet<T>(_unused: any, key: 'stats' | 'uniqueModels' | 'uniqueAnalysts' | 'allSkus', value: T, ttlMs: number): T {
  (CACHE as any)[key] = { data: value, expiry: Date.now() + ttlMs };
  return value;
}

/** Calcula dias úteis entre uma data e hoje (seg-sex) */
export function contarDiasUteisLocal(dataMapStr: string): number {
  try {
    const inicio = new Date(dataMapStr);
    const fim = new Date();
    let count = 0;
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const f = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
    while (d <= f) {
      const dw = d.getDay();
      if (dw !== 0 && dw !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return Math.max(0, count - 1);
  } catch {
    return 0;
  }
}

/** Normaliza documento do Firestore para objeto SkuTp */
function normalizeSkuDoc(docData: any): SkuTp {
  const d = { ...docData };
  if (d.data_map?.toDate) d.data_map = d.data_map.toDate().toISOString();
  if (d.created_at?.toDate) d.created_at = d.created_at.toDate().toISOString();
  if (d.updated_at?.toDate) d.updated_at = d.updated_at.toDate().toISOString();
  return d as SkuTp;
}

/** Carrega todos os SKUs da coleção Firestore (com cache curto em memória) */
async function loadAllSkus(): Promise<SkuTp[]> {
  const cached = cacheGet<SkuTp[]>(CACHE.allSkus);
  if (cached) return cached;

  const snap = await getDocs(collection(db, 'sku_tp'));
  const list = snap.docs.map(d => normalizeSkuDoc(d.data()));
  return cacheSet<SkuTp[]>(null, 'allSkus', list, TTL.ALL_SKUS_MS);
}

// ── Funções de Consulta e Gravação ─────────────────────────────────

/** Busca todos os itens de um KD pela CHAVE do QR Code */
export async function getItensByChave(rawChave: string): Promise<(SaldoEstoque & { tp: SkuTp | null })[]> {
  const chaveNorm = rawChave.replace(/\s+/g, '').replace(/\//g, '_').toUpperCase().trim();
  const rawClean = rawChave.trim();

  // 1. Busca direta por Document ID (chave_norm) - Leitura O(1) instantânea
  const docRef = doc(db, 'saldo_estoque', chaveNorm);
  const snap = await getDoc(docRef);

  let saldo: SaldoEstoque[] = [];

  if (snap.exists()) {
    const data = snap.data();
    if (data.itens && Array.isArray(data.itens)) {
      saldo = data.itens;
    } else if (data.sku) {
      saldo = [data as SaldoEstoque];
    }
  }

  // Se não achou por ID direto, busca por query
  if (saldo.length === 0) {
    let q = query(collection(db, 'saldo_estoque'), where('chave_norm', '==', chaveNorm));
    let qSnap = await getDocs(q);
    if (qSnap.empty) {
      q = query(collection(db, 'saldo_estoque'), where('chave', '==', rawClean));
      qSnap = await getDocs(q);
    }
    qSnap.docs.forEach(d => {
      const data = d.data();
      if (data.itens && Array.isArray(data.itens)) {
        saldo.push(...data.itens);
      } else if (data.sku) {
        saldo.push(data as SaldoEstoque);
      }
    });
  }

  if (saldo.length === 0) return [];

  const skus = [...new Set(saldo.map(s => s.sku).filter(Boolean))];

  // Busca dados de mapeamento de cada SKU correspondente
  const tpMap = new Map<string, SkuTp>();
  await Promise.all(skus.map(async (sku) => {
    const docId = sku.trim().replace(/\//g, '_');
    const tpSnap = await getDoc(doc(db, 'sku_tp', docId));
    if (tpSnap.exists()) {
      tpMap.set(sku, normalizeSkuDoc(tpSnap.data()));
    }
  }));

  return saldo.map(s => ({
    ...s,
    tp: tpMap.get(s.sku) || null
  }));
}

/** Busca resumo por locação (saldo_estoque x sku_tp pendentes) */
export async function getResumoLocacoes(filterLocacao?: string): Promise<LocacaoResumo[]> {
  const cacheKey = (filterLocacao || '').trim().toLowerCase() || '__ALL__';
  const cached = CACHE.resumoLoc.get(cacheKey);
  if (cached && Date.now() < cached.expiry) return cached.data;

  // Carrega saldo de estoque e SKUs simultaneamente
  const [saldoSnap, allSkus] = await Promise.all([
    getDocs(collection(db, 'saldo_estoque')),
    loadAllSkus()
  ]);

  let allSaldo: SaldoEstoque[] = [];
  saldoSnap.docs.forEach(d => {
    const data = d.data();
    if (data.itens && Array.isArray(data.itens)) {
      allSaldo.push(...data.itens);
    } else if (data.sku) {
      allSaldo.push(data as SaldoEstoque);
    }
  });

  if (filterLocacao && filterLocacao.trim()) {
    const f = filterLocacao.trim().toLowerCase();
    allSaldo = allSaldo.filter(s => (s.locacao || '').toLowerCase().includes(f));
  }

  if (allSaldo.length === 0) {
    CACHE.resumoLoc.set(cacheKey, { data: [], expiry: Date.now() + TTL.RESUMO_LOC_MS });
    return [];
  }

  const tpMap = new Map<string, SkuTp>();
  allSkus.forEach(t => {
    if (t.sku) tpMap.set(t.sku, t);
  });

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

  const result = Array.from(locMap.values()).sort((a, b) => a.locacao.localeCompare(b.locacao));
  CACHE.resumoLoc.set(cacheKey, { data: result, expiry: Date.now() + TTL.RESUMO_LOC_MS });
  return result;
}

/** Busca estatísticas globais de progresso */
export async function getStatsTp(): Promise<StatsTp> {
  const cached = cacheGet<StatsTp>(CACHE.stats);
  if (cached) return cached;

  const data = await loadAllSkus();
  const total = data.length;
  const concluidos = data.filter(d => d.status === 'mapeado').length;
  const andamento = data.filter(d => d.status === 'andamento').length;
  const pendentes = Math.max(0, total - concluidos - andamento);

  const result = { total, concluidos, andamento, pendentes };
  return cacheSet<StatsTp>(null, 'stats', result, TTL.STATS_MS);
}

/** Busca analítica completa para o Dashboard */
export async function getDashboardAnalytics(dateRange?: DashboardDateRange): Promise<DashboardData> {
  const gteTs = dateRange?.startDate ? new Date(localStartOfDayToUtcIso(dateRange.startDate)).getTime() : -Infinity;
  const lteTs = dateRange?.endDate   ? new Date(localEndOfDayToUtcIso(dateRange.endDate)).getTime()   :  Infinity;
  const hasFilter = (dateRange?.startDate != null && dateRange.startDate !== '') ||
                    (dateRange?.endDate   != null && dateRange.endDate   !== '');

  const periodLabel = (() => {
    if (!hasFilter) return null;
    const s = dateRange?.startDate;
    const e = dateRange?.endDate;
    if (s && e && s === e) return 'No Dia';
    return 'No Período';
  })();

  const data = await loadAllSkus();

  if (!data || data.length === 0) {
    return {
      stats: { total: 0, concluidos: 0, andamento: 0, pendentes: 0 },
      analistas: [],
      modelos: [],
      periodLabel,
      periodTotalItems: 0,
      tpMapDistribution: [],
      mappingDates: []
    };
  }

  const total = data.length;
  const concluidos = data.filter(d => d.status === 'mapeado').length;
  const andamento = data.filter(d => d.status === 'andamento').length;
  const pendentes = Math.max(0, total - concluidos - andamento);
  const todayStr = localDateKey(new Date());

  // Contagem REAL de itens mapeados no dia de hoje (data_map ou updated_at hoje)
  const hojeMapeados = data.filter(d =>
    d.status === 'mapeado' &&
    ((d.data_map && localDateKey(d.data_map) === todayStr) ||
     (d.updated_at && localDateKey(d.updated_at) === todayStr))
  ).length;

  const inPeriod = (item: any) => {
    if (!hasFilter) return true;
    if (!item.updated_at) return false;
    const ts = new Date(item.updated_at).getTime();
    return ts >= gteTs && ts <= lteTs;
  };

  // 1. Analistas
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
      const itemDate = item.data_map || item.updated_at;
      if (itemDate && localDateKey(itemDate) === todayStr) {
        st.hoje += 1;
      }
      if (item.updated_at) {
        st.timestamps.push(new Date(item.updated_at).getTime());
      }
      if (item.tempo_total && item.tempo_total > 0) {
        st.tempos.push(item.tempo_total);
      }
    }
  });

  const analistas: AnalystStat[] = Array.from(analistasMap.entries()).map(([nome, st]) => {
    const avgTempoProcesso = st.tempos.length > 0
      ? Number((st.tempos.reduce((a, b) => a + b, 0) / st.tempos.length).toFixed(2))
      : 0;

    let tempoMedioCicloMin = 0;
    if (st.timestamps.length > 1) {
      const sortedTs = [...st.timestamps].sort((a, b) => a - b);
      const intervalsMin: number[] = [];
      for (let i = 1; i < sortedTs.length; i++) {
        const diffMs = sortedTs[i] - sortedTs[i - 1];
        const diffMin = diffMs / (1000 * 60);
        if (diffMin > 0.05 && diffMin <= 45) {
          intervalsMin.push(diffMin);
        }
      }
      if (intervalsMin.length > 0) {
        tempoMedioCicloMin = Number((intervalsMin.reduce((a, b) => a + b, 0) / intervalsMin.length).toFixed(1));
      }
    }

    if (tempoMedioCicloMin === 0) {
      tempoMedioCicloMin = Number(((avgTempoProcesso / 60) + 1.5).toFixed(1));
    }

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

  // 2. Modelos
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

  // 3. Distribuição Tp Map (dias úteis calculados dinamicamente com base em data_map)
  const MAX_BUCKET = 30;
  const tpCounter = new Map<number, number>();

  data.forEach(item => {
    if (item.status !== 'mapeado') return;
    let dias: number;
    if (item.data_map) {
      dias = contarDiasUteisLocal(item.data_map);
    } else if (typeof item.tp_map === 'number' && isFinite(item.tp_map) && item.tp_map > 0) {
      dias = item.tp_map;
    } else {
      return;
    }
    const bucket = dias >= MAX_BUCKET ? MAX_BUCKET : dias;
    tpCounter.set(bucket, (tpCounter.get(bucket) || 0) + 1);
  });

  const tpMapDistribution: TpMapBucket[] = [];
  for (let d = 0; d <= MAX_BUCKET; d++) {
    const qty = tpCounter.get(d) || 0;
    let label: string;
    if (d === 0) label = 'Hoje';
    else if (d === MAX_BUCKET) label = `${MAX_BUCKET}+ dias úteis`;
    else label = d === 1 ? `${d} dia útil` : `${d} dias úteis`;
    tpMapDistribution.push({ dias: d, quantidade: qty, label });
  }

  // 4. Datas de Mapeamento
  const datesCounter = new Map<string, number>();
  data.forEach(item => {
    if (item.status !== 'mapeado' || !item.data_map) return;
    try {
      const k = localDateKey(item.data_map);
      datesCounter.set(k, (datesCounter.get(k) || 0) + 1);
    } catch {}
  });

  const mappingDates = Array.from(datesCounter.entries())
    .map(([d, quantidade]) => ({ data: d, quantidade }))
    .sort((a, b) => b.data.localeCompare(a.data));

  return {
    stats: { total, concluidos, andamento, pendentes },
    analistas,
    modelos,
    periodLabel,
    periodTotalItems,
    tpMapDistribution,
    mappingDates,
    hojeMapeados,
  };
}

/** Busca lista de SKUs com filtro de texto */
export async function getSkusList(search: string = '', limit: number = 50): Promise<SkuTp[]> {
  const all = await loadAllSkus();
  if (!search.trim()) return all.slice(0, limit);

  const s = search.trim().toLowerCase();
  return all.filter(item =>
    (item.sku || '').toLowerCase().includes(s) ||
    (item.descricao || '').toLowerCase().includes(s)
  ).slice(0, limit);
}

/** Relatório de SKUs com filtros e paginação */
export async function getSkusReport(filters: SkusReportFilters = {}): Promise<{ data: SkuTp[]; total: number }> {
  const { search, modelo, status, responsavel, dataInicio, dataFim, page = 0, pageSize = 50 } = filters;
  const all = await loadAllSkus();

  const gte = dataInicio ? localStartOfDayToUtcIso(dataInicio) : null;
  const lte = dataFim ? localEndOfDayToUtcIso(dataFim) : null;
  const s = search?.trim().toLowerCase();
  const m = modelo?.trim().toLowerCase();
  const r = responsavel?.trim().toLowerCase();

  const filtered = all.filter(item => {
    if (s) {
      const matchSku = (item.sku || '').toLowerCase().includes(s);
      const matchDesc = (item.descricao || '').toLowerCase().includes(s);
      if (!matchSku && !matchDesc) return false;
    }
    if (m && !(item.modelo || '').toLowerCase().includes(m)) return false;
    if (status && item.status !== status) return false;
    if (r && !(item.responsavel || '').toLowerCase().includes(r)) return false;
    if (gte && (!item.data_map || item.data_map < gte)) return false;
    if (lte && (!item.data_map || item.data_map > lte)) return false;
    return true;
  });

  // Ordena por SKU
  filtered.sort((a, b) => (a.sku || '').localeCompare(b.sku || ''));

  const start = page * pageSize;
  const pagedData = filtered.slice(start, start + pageSize);

  return { data: pagedData, total: filtered.length };
}

/** Lista de modelos únicos */
export async function getUniqueModels(): Promise<string[]> {
  const cached = cacheGet<string[]>(CACHE.uniqueModels);
  if (cached) return cached;

  const all = await loadAllSkus();
  const set = new Set<string>();
  all.forEach(item => {
    if (item.modelo && item.modelo.trim()) set.add(item.modelo.trim());
  });

  const result = Array.from(set).sort();
  return cacheSet<string[]>(null, 'uniqueModels', result, TTL.UNIQUE_MODEL_MS);
}

/** Lista de analistas únicos */
export async function getUniqueAnalysts(): Promise<string[]> {
  const cached = cacheGet<string[]>(CACHE.uniqueAnalysts);
  if (cached) return cached;

  const all = await loadAllSkus();
  const set = new Set<string>();
  all.forEach(item => {
    if (item.responsavel && item.responsavel.trim()) set.add(item.responsavel.trim());
  });

  const result = Array.from(set).sort();
  return cacheSet<string[]>(null, 'uniqueAnalysts', result, TTL.UNIQUE_ANALYS_MS);
}

/**
 * Salva as tomadas de um sub-processo específico de um SKU no Firestore.
 * Protegido contra concorrência por leitura prévia do banco e merge seguro.
 */
export async function saveSubProcessMeasurements(
  sku: string,
  updateFields: Partial<SkuTp>,
  operatorName: string = 'Operador',
  maxRetries: number = 3
): Promise<SkuTp | null> {
  const docId = sku.trim().replace(/\//g, '_');
  const docRef = doc(db, 'sku_tp', docId);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const snap = await getDoc(docRef);
      const currentTp = snap.exists() ? normalizeSkuDoc(snap.data()) : { sku, status: 'pendente' as const };

      const now = new Date();
      const merged: any = { ...currentTp };
      for (const k of Object.keys(updateFields)) {
        merged[k] = (updateFields as any)[k];
      }
      merged.responsavel = operatorName;
      merged.updated_at = now.toISOString();

      // Recalcula status
      const spKeys = ['pegar_ik_t1', 'abrir_t1', 'form_t1', 'desc_t1', 'etq_t1', 'pos_t1'];
      const hasSome = spKeys.some(k => merged[k] != null);
      const hasAll = spKeys.every(k => merged[k] != null);

      if (currentTp.status === 'mapeado' || hasAll) {
        merged.status = 'mapeado';
        if (!merged.data_map) merged.data_map = now.toISOString();
      } else if (hasSome) {
        merged.status = 'andamento';
      } else {
        merged.status = currentTp.status || 'pendente';
      }

      // Recalcula tp_map (dias úteis) no status mapeado
      if (merged.status === 'mapeado' && merged.data_map) {
        merged.tp_map = contarDiasUteisLocal(merged.data_map);
      }

      // Recalcula tempo_total
      let total = 0;
      ['abrir_res', 'form_res', 'desc_res', 'etq_res', 'pos_res', 'pegar_ik_res'].forEach(resKey => {
        const val = merged[resKey];
        if (typeof val === 'number') total += val;
      });
      merged.tempo_total = Number(total.toFixed(2));

      const cleanMerged = sanitizeSkuTpPayload(merged, false);
      await setDoc(docRef, cleanMerged, { merge: true });

      invalidateCachesAfterWrite();
      return cleanMerged as SkuTp;
    } catch (err: any) {
      if (attempt === maxRetries) {
        console.error(`[saveSubProcessMeasurements] Falha após ${maxRetries} tentativas:`, err);
        return null;
      }
      await new Promise(r => setTimeout(r, 150 * attempt));
    }
  }
  return null;
}

/** Grava UMA tomada no próximo slot vazio no Firestore */
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
  const docId = sku.trim().replace(/\//g, '_');
  const docRef = doc(db, 'sku_tp', docId);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const snap = await getDoc(docRef);
      const row = snap.exists() ? normalizeSkuDoc(snap.data()) : ({ sku, status: 'pendente' } as any);

      const tKeys = [keys.t1, keys.t2, keys.t3, keys.t4, keys.t5];
      let targetKey = keys.t5;
      for (let i = 0; i < tKeys.length; i++) {
        const v = (row as any)[tKeys[i]];
        if (v == null || v === 0) { targetKey = tKeys[i]; break; }
      }

      const updated: any = { ...row };
      updated[targetKey] = tVal;
      if (qtdUnid != null && !isNaN(qtdUnid)) {
        updated[keys.qtd] = qtdUnid;
      }

      const validTs = tKeys
        .map(k => updated[k])
        .filter((v: any) => typeof v === 'number' && v > 0) as number[];
      const avg = validTs.length > 0
        ? Number((validTs.reduce((a, b) => a + b, 0) / validTs.length).toFixed(2))
        : null;
      updated[keys.res] = avg;

      const fieldsToSave: Partial<SkuTp> = {};
      (fieldsToSave as any)[targetKey] = tVal;
      (fieldsToSave as any)[keys.res] = avg;
      if (qtdUnid != null && !isNaN(qtdUnid)) {
        (fieldsToSave as any)[keys.qtd] = qtdUnid;
      }

      const result = await saveSubProcessMeasurements(sku, fieldsToSave, operatorName, 2);
      if (result) return result;
    } catch (err: any) {
      if (attempt === maxRetries) {
        console.error(`[recordMeasurementSafe] Erro para ${sku}:`, err);
        return null;
      }
      await new Promise(r => setTimeout(r, 150 * attempt));
    }
  }
  return null;
}

/** Remove uma tomada individual e recalcula média */
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

  const docId = sku.trim().replace(/\//g, '_');
  const snap = await getDoc(doc(db, 'sku_tp', docId));
  if (!snap.exists()) return null;

  const fresh = normalizeSkuDoc(snap.data());
  const newTs: any = { ...fresh };
  newTs[slotKey] = null;

  const validTs = [1,2,3,4,5]
    .map(i => newTs[(keys as any)[`t${i}`]])
    .filter((v: any) => typeof v === 'number' && v > 0) as number[];
  const avg = validTs.length > 0
    ? Number((validTs.reduce((a, b) => a + b, 0) / validTs.length).toFixed(2))
    : null;

  const clean: Partial<SkuTp> = {};
  (clean as any)[slotKey] = null;
  (clean as any)[keys.res] = avg;

  return await saveSubProcessMeasurements(sku, clean, operatorName);
}

/** Força status como 'mapeado' */
export async function confirmarMapeamentoForcado(
  sku: string,
  operatorName: string = 'Operador'
): Promise<SkuTp | null> {
  const docId = sku.trim().replace(/\//g, '_');
  const docRef = doc(db, 'sku_tp', docId);
  const snap = await getDoc(docRef);

  const now = new Date();
  const currentTp = snap.exists() ? normalizeSkuDoc(snap.data()) : ({ sku, status: 'pendente' } as any);

  let total = 0;
  ['abrir_res', 'form_res', 'desc_res', 'etq_res', 'pos_res', 'pegar_ik_res'].forEach(resKey => {
    const val = (currentTp as any)[resKey];
    if (typeof val === 'number') total += val;
  });

  const dataMapStr = (currentTp as any).data_map || now.toISOString();
  const merged: any = {
    ...currentTp,
    tempo_total: Number(total.toFixed(2)),
    status: 'mapeado' as const,
    responsavel: operatorName,
    data_map: dataMapStr,
    tp_map: contarDiasUteisLocal(dataMapStr),
    updated_at: now.toISOString()
  };

  const cleanMerged = sanitizeSkuTpPayload(merged, false);
  await setDoc(docRef, cleanMerged, { merge: true });

  invalidateCachesAfterWrite();
  return cleanMerged as SkuTp;
}

// ── Objeto de Compatibilidade `supabase` ───────────────────────────
// Usado diretamente por componentes legados como ItemsReport
export const supabase = {
  from: (collectionName: string) => ({
    update: (payload: any) => ({
      eq: (col: string, val: any) => ({
        select: (_sel?: string) => ({
          single: async () => {
            const raw = String(val).trim();
            const docId = raw.replace(/\//g, '_');
            const docRef = doc(db, collectionName, docId);
            const now = new Date().toISOString();
            const toSave = { ...payload, updated_at: now };
            if (toSave.status === 'mapeado' && toSave.data_map) {
              toSave.tp_map = contarDiasUteisLocal(toSave.data_map);
            }
            await setDoc(docRef, sanitizeSkuTpPayload(toSave, false), { merge: true });
            const snap = await getDoc(docRef);
            invalidateCachesAfterWrite();
            return { data: normalizeSkuDoc(snap.data()), error: null };
          }
        })
      })
    })
  })
} as any;
