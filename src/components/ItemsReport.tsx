import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Filter, X, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Loader2,
  Calendar, User, Package, RefreshCw, Download,
  ChevronDown, BarChart2
} from 'lucide-react';
import {
  getSkusReport, getUniqueModels, getUniqueAnalysts,
  SkuTp, SkusReportFilters
} from '../lib/supabase';

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  mapeado: {
    label: 'Mapeado',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15 border-emerald-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />
  },
  andamento: {
    label: 'Em Andamento',
    color: 'text-amber-400',
    bg: 'bg-amber-500/15 border-amber-500/30',
    icon: <Clock className="w-3 h-3" />
  },
  pendente: {
    label: 'Pendente',
    color: 'text-slate-400',
    bg: 'bg-slate-700/40 border-slate-600/30',
    icon: <AlertCircle className="w-3 h-3" />
  },
};

const PROCESS_COLS = [
  { key: 'pegar_ik_res', label: 'Pegar IK', color: 'text-cyan-400' },
  { key: 'abrir_res',    label: 'Abrir Cx.', color: 'text-orange-400' },
  { key: 'form_res',     label: 'Formatar', color: 'text-emerald-400' },
  { key: 'desc_res',     label: 'Descartar', color: 'text-purple-400' },
  { key: 'etq_res',      label: 'Etiqueta', color: 'text-blue-400' },
  { key: 'pos_res',      label: 'Posicionar', color: 'text-amber-400' },
];

export default function ItemsReport() {
  // Filtros
  const [search, setSearch] = useState('');
  const [filterModelo, setFilterModelo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Dados
  const [items, setItems] = useState<SkuTp[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  // Opções de filtro
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [analystOptions, setAnalystOptions] = useState<string[]>([]);

  // Expandir linha
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  // Carregar opções de filtro
  useEffect(() => {
    getUniqueModels().then(setModelOptions);
    getUniqueAnalysts().then(setAnalystOptions);
  }, []);

  const fetchData = useCallback(async (pg: number = 0) => {
    setLoading(true);
    const filters: SkusReportFilters = {
      search, modelo: filterModelo, status: filterStatus,
      responsavel: filterResponsavel, dataInicio: filterDataInicio,
      dataFim: filterDataFim, page: pg, pageSize: PAGE_SIZE,
    };
    const result = await getSkusReport(filters);
    setItems(result.data);
    setTotal(result.total);
    setPage(pg);
    setLoading(false);
  }, [search, filterModelo, filterStatus, filterResponsavel, filterDataInicio, filterDataFim]);

  // Busca com debounce no search
  useEffect(() => {
    const t = setTimeout(() => fetchData(0), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Busca imediata ao mudar filtros (exceto search)
  useEffect(() => {
    fetchData(0);
  }, [filterModelo, filterStatus, filterResponsavel, filterDataInicio, filterDataFim]);

  const clearFilters = () => {
    setSearch('');
    setFilterModelo('');
    setFilterStatus('');
    setFilterResponsavel('');
    setFilterDataInicio('');
    setFilterDataFim('');
  };

  const hasActiveFilters = search || filterModelo || filterStatus || filterResponsavel || filterDataInicio || filterDataFim;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fmtSec = (val?: number | null) =>
    val != null && val > 0 ? `${val.toFixed(1)}s` : <span className="text-slate-700">—</span>;

  const exportCSV = () => {
    const headers = ['SKU', 'Descrição', 'Modelo', 'Status', 'Analista', 'Data Map', 'Tempo Total', ...PROCESS_COLS.map(p => p.label)];
    const rows = items.map(i => [
      i.sku, i.descricao, i.modelo || '', i.status,
      i.responsavel || '', i.data_map || '',
      i.tempo_total?.toFixed(1) || '',
      ...PROCESS_COLS.map(p => (i as any)[p.key]?.toFixed(1) || ''),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `itens_tp_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#111319] text-white p-4 md:p-6 font-sans">
      <div className="max-w-screen-xl mx-auto space-y-4">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-orange-500" />
              Relatório de Itens
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {loading ? 'Carregando...' : `${total.toLocaleString('pt-BR')} itens encontrados`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchData(page)}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={exportCSV}
              className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all flex items-center gap-2 text-sm font-bold"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 text-sm font-bold transition-all ${
                showFilters || hasActiveFilters
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtros
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* ── Barra de busca sempre visível ── */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código SKU ou descrição..."
            className="w-full bg-[#181b22] border border-slate-800 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500 transition-colors font-medium"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Painel de Filtros Avançados ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-[#181b22] border border-slate-800/80 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">

                {/* Modelo */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Modelo
                  </label>
                  <select
                    value={filterModelo}
                    onChange={e => setFilterModelo(e.target.value)}
                    className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Todos</option>
                    {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Todos</option>
                    <option value="pendente">Pendente</option>
                    <option value="andamento">Em Andamento</option>
                    <option value="mapeado">Mapeado</option>
                  </select>
                </div>

                {/* Analista */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                    <User className="w-3 h-3" /> Analista
                  </label>
                  <select
                    value={filterResponsavel}
                    onChange={e => setFilterResponsavel(e.target.value)}
                    className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="">Todos</option>
                    {analystOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                {/* Data Início */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Data Início
                  </label>
                  <input
                    type="date"
                    value={filterDataInicio}
                    onChange={e => setFilterDataInicio(e.target.value)}
                    className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors [color-scheme:dark]"
                  />
                </div>

                {/* Data Fim */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Data Fim
                  </label>
                  <input
                    type="date"
                    value={filterDataFim}
                    onChange={e => setFilterDataFim(e.target.value)}
                    className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors [color-scheme:dark]"
                  />
                </div>

              </div>

              {hasActiveFilters && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={clearFilters}
                    className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors font-semibold"
                  >
                    <X className="w-3 h-3" /> Limpar filtros
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tags de filtros ativos ── */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {filterModelo && <FilterTag label={`Modelo: ${filterModelo}`} onRemove={() => setFilterModelo('')} />}
            {filterStatus && <FilterTag label={`Status: ${STATUS_LABELS[filterStatus]?.label}`} onRemove={() => setFilterStatus('')} />}
            {filterResponsavel && <FilterTag label={`Analista: ${filterResponsavel}`} onRemove={() => setFilterResponsavel('')} />}
            {filterDataInicio && <FilterTag label={`De: ${filterDataInicio}`} onRemove={() => setFilterDataInicio('')} />}
            {filterDataFim && <FilterTag label={`Até: ${filterDataFim}`} onRemove={() => setFilterDataFim('')} />}
          </div>
        )}

        {/* ── Tabela ── */}
        <div className="bg-[#181b22] border border-slate-800/80 rounded-2xl overflow-hidden">

          {/* Loader overlay */}
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500 mr-3" />
              Carregando itens...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Package className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-bold">Nenhum item encontrado</p>
              <p className="text-sm mt-1">Tente ajustar os filtros</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#1a1e29]">
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-6" />
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">SKU</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Modelo</th>
                    <th className="text-center px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Analista</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data/Hora Map.</th>
                    <th className="text-right px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Total</th>
                    {PROCESS_COLS.map(p => (
                      <th key={p.key} className={`text-right px-3 py-3 text-[10px] font-black uppercase tracking-widest ${p.color}`}>
                        {p.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const s = STATUS_LABELS[item.status] || STATUS_LABELS.pendente;
                    const isExpanded = expandedSku === item.sku;
                    return (
                      <React.Fragment key={item.sku}>
                        <tr
                          onClick={() => setExpandedSku(isExpanded ? null : item.sku)}
                          className={`border-b border-slate-800/50 transition-all cursor-pointer ${
                            isExpanded ? 'bg-[#1e2333]' : idx % 2 === 0 ? 'bg-transparent hover:bg-[#1a1e29]' : 'bg-[#181c27]/50 hover:bg-[#1a1e29]'
                          }`}
                        >
                          <td className="px-4 py-3 text-slate-600">
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180 text-orange-400' : ''}`} />
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-black font-mono text-white text-xs">{item.sku}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[180px]">
                            <span className="text-slate-300 text-xs truncate block">{item.descricao || '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-400 text-xs font-semibold">{item.modelo || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-black ${s.color} ${s.bg}`}>
                              {s.icon}{s.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-400 text-xs">{item.responsavel || '—'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-400 text-xs font-mono">{item.data_map || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-mono font-black text-xs ${item.tempo_total ? 'text-white' : 'text-slate-700'}`}>
                              {item.tempo_total ? `${item.tempo_total.toFixed(1)}s` : '—'}
                            </span>
                          </td>
                          {PROCESS_COLS.map(p => (
                            <td key={p.key} className="px-3 py-3 text-right">
                              <span className={`font-mono text-xs ${(item as any)[p.key] ? p.color : 'text-slate-700'}`}>
                                {fmtSec((item as any)[p.key])}
                              </span>
                            </td>
                          ))}
                        </tr>

                        {/* Linha expandida: info adicional + tomadas individuais */}
                        <AnimatePresence>
                          {isExpanded && (
                            <tr key={`${item.sku}-expanded`}>
                              <td colSpan={8 + PROCESS_COLS.length} className="px-6 pb-4 bg-[#1e2333] border-b border-slate-800/50">
                                <motion.div
                                  initial={{ opacity: 0, y: -8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  transition={{ duration: 0.15 }}
                                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-3"
                                >
                                  {item.pecas_kd != null && <InfoChip label="Peças no KD" value={String(item.pecas_kd)} />}
                                  {item.tp_emb_forn && <InfoChip label="TP Emb. Forn." value={item.tp_emb_forn} />}
                                  {item.pd_emb_forn && <InfoChip label="PD Emb. Forn." value={item.pd_emb_forn} />}
                                  {item.tp_emb_dcc && <InfoChip label="TP Emb. DCC" value={item.tp_emb_dcc} />}
                                  {item.pd_emb_dcc && <InfoChip label="PD Emb. DCC" value={item.pd_emb_dcc} />}
                                  {item.carro && <InfoChip label="Carro" value={item.carro} />}
                                  {item.form_unid && <InfoChip label="Uni. Med. Form." value={item.form_unid} />}
                                  {item.form_qtd != null && <InfoChip label="QTD Form." value={String(item.form_qtd)} />}
                                </motion.div>

                                {/* Tomadas individuais por sub-processo */}
                                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                  {[
                                    { label: 'Pegar IK', color: 'border-cyan-500/30 text-cyan-400', keys: ['pegar_ik_t1','pegar_ik_t2','pegar_ik_t3','pegar_ik_t4','pegar_ik_t5'] },
                                    { label: 'Abrir Cx.', color: 'border-orange-500/30 text-orange-400', keys: ['abrir_t1','abrir_t2','abrir_t3','abrir_t4','abrir_t5'] },
                                    { label: 'Formatar', color: 'border-emerald-500/30 text-emerald-400', keys: ['form_t1','form_t2','form_t3','form_t4','form_t5'] },
                                    { label: 'Descartar', color: 'border-purple-500/30 text-purple-400', keys: ['desc_t1','desc_t2','desc_t3','desc_t4','desc_t5'] },
                                    { label: 'Etiqueta', color: 'border-blue-500/30 text-blue-400', keys: ['etq_t1','etq_t2','etq_t3','etq_t4','etq_t5'] },
                                    { label: 'Posicionar', color: 'border-amber-500/30 text-amber-400', keys: ['pos_t1','pos_t2','pos_t3','pos_t4','pos_t5'] },
                                  ].map(proc => (
                                    <div key={proc.label} className={`bg-[#181b22] border ${proc.color} rounded-xl p-3`}>
                                      <p className={`text-[10px] font-black uppercase tracking-wider mb-2 ${proc.color.split(' ')[1]}`}>{proc.label}</p>
                                      <div className="flex flex-wrap gap-1">
                                        {proc.keys.map((k, ki) => {
                                          const val = (item as any)[k] as number | null;
                                          return (
                                            <span key={ki} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${val != null ? 'text-white bg-slate-700' : 'text-slate-700'}`}>
                                              {ki + 1}T:{val != null ? `${val.toFixed(1)}s` : '—'}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Paginação ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">
              Página {page + 1} de {totalPages} — {total.toLocaleString('pt-BR')} itens
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchData(page - 1)}
                disabled={page === 0 || loading}
                className="p-2.5 rounded-xl bg-[#181b22] border border-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-800 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => fetchData(p)}
                    disabled={loading}
                    className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${
                      p === page
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'bg-[#181b22] border border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {p + 1}
                  </button>
                );
              })}
              <button
                onClick={() => fetchData(page + 1)}
                disabled={page >= totalPages - 1 || loading}
                className="p-2.5 rounded-xl bg-[#181b22] border border-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-800 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-bold">
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#181b22] border border-slate-800 rounded-xl px-3 py-2">
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
      <p className="text-sm font-black text-white mt-0.5">{value}</p>
    </div>
  );
}
