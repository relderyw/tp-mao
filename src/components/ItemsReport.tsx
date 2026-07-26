import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Filter, X, ChevronLeft, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Loader2,
  Calendar, User, Package, RefreshCw, Download,
  ChevronDown, BarChart2, Pencil, Save, ShieldCheck
} from "lucide-react";
import { AppUser } from "../lib/auth";
import {
  getSkusReport, getUniqueModels, getUniqueAnalysts,
  SkuTp, SkusReportFilters, supabase, sanitizeSkuTpPayload
} from "../lib/supabase";

interface ItemsReportProps {
  currentUser?: AppUser | null;
}

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  mapeado:  { label: "Mapeado",       color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  andamento:{ label: "Em Andamento",  color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30",     icon: <Clock className="w-3 h-3" /> },
  pendente: { label: "Pendente",      color: "text-slate-400",   bg: "bg-slate-700/40 border-slate-600/30",     icon: <AlertCircle className="w-3 h-3" /> },
};

const PROCESS_COLS = [
  { key: "pegar_ik_res", label: "Pegar IK",   color: "text-cyan-400" },
  { key: "abrir_res",    label: "Abrir Cx.",   color: "text-orange-400" },
  { key: "form_res",     label: "Formatar",    color: "text-emerald-400" },
  { key: "desc_res",     label: "Descartar",   color: "text-purple-400" },
  { key: "etq_res",      label: "Etiqueta",    color: "text-blue-400" },
  { key: "pos_res",      label: "Posicionar",  color: "text-amber-400" },
];

const SUB_PROC_SAMPLES = [
  { label: "Pegar IK",   bColor: "border-cyan-500/30",     tColor: "text-cyan-400",     keys: ["pegar_ik_t1","pegar_ik_t2","pegar_ik_t3"] },
  { label: "Abrir Cx.",  bColor: "border-orange-500/30",   tColor: "text-orange-400",   keys: ["abrir_t1","abrir_t2","abrir_t3"] },
  { label: "Formatar",   bColor: "border-emerald-500/30",  tColor: "text-emerald-400",  keys: ["form_t1","form_t2","form_t3"] },
  { label: "Descartar",  bColor: "border-purple-500/30",   tColor: "text-purple-400",   keys: ["desc_t1","desc_t2","desc_t3"] },
  { label: "Etiqueta",   bColor: "border-blue-500/30",     tColor: "text-blue-400",     keys: ["etq_t1","etq_t2","etq_t3"] },
  { label: "Posicionar", bColor: "border-amber-500/30",    tColor: "text-amber-400",    keys: ["pos_t1","pos_t2","pos_t3"] },
];

const EDIT_PROCESS_FIELDS = [
  { key: "pegar_ik_res", label: "Pegar IK (s)",       color: "text-cyan-400" },
  { key: "abrir_res",    label: "Abrir Caixa (s)",    color: "text-orange-400" },
  { key: "form_res",     label: "Formatar (s)",       color: "text-emerald-400" },
  { key: "desc_res",     label: "Descartar (s)",      color: "text-purple-400" },
  { key: "etq_res",      label: "Colar Etiqueta (s)", color: "text-blue-400" },
  { key: "pos_res",      label: "Posicionar IK (s)",  color: "text-amber-400" },
];

export default function ItemsReport({ currentUser }: ItemsReportProps) {
  const isAdmin = currentUser?.role === "administrador";
  const canEdit = isAdmin || currentUser?.permissions?.canEdit === true;

  const [validatingSkus, setValidatingSkus] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [filterModelo, setFilterModelo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterResponsavel, setFilterResponsavel] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [items, setItems] = useState<SkuTp[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const [editingItem, setEditingItem] = useState<SkuTp | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [analystOptions, setAnalystOptions] = useState<string[]>([]);
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

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

  useEffect(() => {
    const t = setTimeout(() => fetchData(0), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { fetchData(0); }, [filterModelo, filterStatus, filterResponsavel, filterDataInicio, filterDataFim]);

  const clearFilters = () => {
    setSearch(""); setFilterModelo(""); setFilterStatus("");
    setFilterResponsavel(""); setFilterDataInicio(""); setFilterDataFim("");
  };

  const hasActiveFilters = search || filterModelo || filterStatus || filterResponsavel || filterDataInicio || filterDataFim;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const fmtSec = (val?: number | null) => val != null && val > 0 ? `${val.toFixed(1)}s` : <span className="text-slate-700">—</span>;

  const fmtDateMap = (val?: string | null) => {
    if (!val) return '—';
    try {
      if (val.includes('/')) return val;
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return val;
    }
  };

  const exportCSV = () => {
    const headers = ["SKU","Descricao","Modelo","Status","Analista","Data Map","Tempo Total",...PROCESS_COLS.map(p => p.label)];
    const rows = items.map(i => [
      i.sku, i.descricao, i.modelo||"", i.status,
      i.responsavel||"", i.data_map||"", i.tempo_total?.toFixed(1)||"",
      ...PROCESS_COLS.map(p => (i as any)[p.key]?.toFixed(1)||""),
    ]);
    const csv = [headers,...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`itens_tp_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      let totalTime = 0;
      ["pegar_ik_res","abrir_res","form_res","desc_res","etq_res","pos_res"].forEach(k => {
        const val = (editingItem as any)[k];
        if (typeof val === "number") totalTime += val;
      });

      let cleanDataMap = editingItem.data_map;
      if (cleanDataMap && cleanDataMap.includes('/')) {
        const parts = cleanDataMap.split(' ');
        if (parts[0]) {
          const [d, m, y] = parts[0].split('/');
          if (d && m && y) {
            cleanDataMap = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${parts[1] || '00:00:00'}Z`;
          }
        }
      }

      const payload = {
        ...editingItem,
        data_map: cleanDataMap || null,
        tempo_total: Number(totalTime.toFixed(2)),
        updated_at: new Date().toISOString()
      };

      const cleanPayload = sanitizeSkuTpPayload(payload, true);

      const { data, error } = await supabase
        .from("sku_tp")
        .update(cleanPayload)
        .eq("sku", editingItem.sku)
        .select("*")
        .single();

      if (error) {
        alert("Erro ao salvar no banco: " + error.message);
      } else if (data) {
        setItems(prev => prev.map(item => item.sku === data.sku ? data : item));
        setEditingItem(null);
      }
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const isAllTimesMapped = (item: SkuTp): boolean => {
    return ["pegar_ik_res","abrir_res","form_res","desc_res","etq_res","pos_res"].every(k => {
      const val = (item as any)[k];
      return val != null && typeof val === "number" && val > 0;
    });
  };

  const handleValidateStatus = async (item: SkuTp, newStatus: "mapeado" | "pendente") => {
    const allMapped = isAllTimesMapped(item);

    if (newStatus === "mapeado" && !allMapped && !isAdmin) {
      alert("Todos os tempos precisam estar preenchidos para validar como Mapeado.");
      return;
    }

    if (newStatus === "mapeado" && !allMapped && isAdmin) {
      const ok = confirm("ATENÇÃO: Nem todos os tempos estão preenchidos.\nDeseja forçar a validação como Mapeado mesmo assim?");
      if (!ok) return;
    }

    setValidatingSkus(prev => new Set(prev).add(item.sku));
    try {
      const { data, error } = await supabase
        .from("sku_tp")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("sku", item.sku)
        .select("*")
        .single();

      if (error) { alert("Erro ao atualizar status: " + error.message); }
      else if (data) { setItems(prev => prev.map(i => i.sku === data.sku ? data : i)); }
    } catch (err: any) { alert("Erro: " + err.message); }
    finally { setValidatingSkus(prev => { const n = new Set(prev); n.delete(item.sku); return n; }); }
  };

  return (
    <div className="min-h-screen bg-[#111319] text-white p-4 md:p-6 font-sans">
      <div className="max-w-screen-xl mx-auto space-y-4">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-orange-500" />Relatorio de Itens
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">{loading ? "Carregando..." : `${total.toLocaleString("pt-BR")} itens encontrados`}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => fetchData(page)} className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all" title="Atualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setShowFilters(f => !f)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all ${showFilters || hasActiveFilters ? "bg-orange-500/15 border-orange-500/40 text-orange-400" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"}`}>
              <Filter className="w-4 h-4" />Filtros
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />}
            </button>
            <button onClick={exportCSV} disabled={items.length===0} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-sm hover:bg-emerald-500/25 transition-all disabled:opacity-30">
              <Download className="w-4 h-4" />CSV
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="text" placeholder="Buscar SKU, descricao..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#181b22] border border-slate-800/80 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500/50 transition-colors" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-500 hover:text-white" /></button>}
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}
              className="bg-[#181b22] border border-slate-800/80 rounded-2xl p-4 space-y-3 overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5"><Package className="inline w-3 h-3 mr-1" />Modelo</label>
                  <select value={filterModelo} onChange={e => setFilterModelo(e.target.value)} className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors">
                    <option value="">Todos</option>{modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5"><CheckCircle2 className="inline w-3 h-3 mr-1" />Status</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors">
                    <option value="">Todos</option><option value="mapeado">Mapeado</option><option value="andamento">Em Andamento</option><option value="pendente">Pendente</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5"><User className="inline w-3 h-3 mr-1" />Analista</label>
                  <select value={filterResponsavel} onChange={e => setFilterResponsavel(e.target.value)} className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors">
                    <option value="">Todos</option>{analystOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5"><Calendar className="inline w-3 h-3 mr-1" />Data Inicio</label>
                  <input type="date" value={filterDataInicio} onChange={e => setFilterDataInicio(e.target.value)} className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5"><Calendar className="inline w-3 h-3 mr-1" />Data Fim</label>
                  <input type="date" value={filterDataFim} onChange={e => setFilterDataFim(e.target.value)} className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors [color-scheme:dark]" />
                </div>
              </div>
              {hasActiveFilters && <div className="flex justify-end mt-2"><button onClick={clearFilters} className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors font-semibold"><X className="w-3 h-3" /> Limpar filtros</button></div>}
            </motion.div>
          )}
        </AnimatePresence>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {filterModelo && <FilterTag label={`Modelo: ${filterModelo}`} onRemove={() => setFilterModelo("")} />}
            {filterStatus && <FilterTag label={`Status: ${STATUS_LABELS[filterStatus]?.label}`} onRemove={() => setFilterStatus("")} />}
            {filterResponsavel && <FilterTag label={`Analista: ${filterResponsavel}`} onRemove={() => setFilterResponsavel("")} />}
            {filterDataInicio && <FilterTag label={`De: ${filterDataInicio}`} onRemove={() => setFilterDataInicio("")} />}
            {filterDataFim && <FilterTag label={`Ate: ${filterDataFim}`} onRemove={() => setFilterDataFim("")} />}
          </div>
        )}

        <div className="bg-[#181b22] border border-slate-800/80 rounded-2xl overflow-hidden">
          {loading && <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin text-orange-500 mr-3" />Carregando itens...</div>}
          {!loading && items.length === 0 && <div className="flex flex-col items-center justify-center py-20 text-slate-500"><Package className="w-10 h-10 mb-3 opacity-30" /><p className="font-bold">Nenhum item encontrado</p><p className="text-sm mt-1">Tente ajustar os filtros</p></div>}
          {!loading && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#1a1e29]">
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-6" />
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">SKU</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Descricao</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Modelo</th>
                    <th className="text-center px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Analista</th>
                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data/Hora Map.</th>
                    <th className="text-right px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Total</th>
                    {PROCESS_COLS.map(p => <th key={p.key} className={`text-right px-3 py-3 text-[10px] font-black uppercase tracking-widest ${p.color}`}>{p.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const s = STATUS_LABELS[item.status] || STATUS_LABELS.pendente;
                    const isExpanded = expandedSku === item.sku;
                    return (
                      <React.Fragment key={item.sku}>
                        <tr onClick={() => setExpandedSku(isExpanded ? null : item.sku)}
                          className={`border-b border-slate-800/50 transition-all cursor-pointer ${isExpanded ? "bg-[#1e2333]" : idx%2===0 ? "bg-transparent hover:bg-[#1a1e29]" : "bg-[#181c27]/50 hover:bg-[#1a1e29]"}`}>
                          <td className="px-4 py-3 text-slate-600"><ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180 text-orange-400" : ""}`} /></td>
                          <td className="px-4 py-3"><span className="font-black font-mono text-white text-xs">{item.sku}</span></td>
                          <td className="px-4 py-3 max-w-[180px]"><span className="text-slate-300 text-xs truncate block">{item.descricao||"—"}</span></td>
                          <td className="px-4 py-3"><span className="text-slate-400 text-xs font-semibold">{item.modelo||"—"}</span></td>
                          <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-black ${s.color} ${s.bg}`}>{s.icon}{s.label}</span></td>
                          <td className="px-4 py-3"><span className="text-slate-400 text-xs">{item.responsavel||"—"}</span></td>
                          <td className="px-4 py-3"><span className="text-slate-500 text-xs font-mono">{fmtDateMap(item.data_map)}</span></td>
                          <td className="px-4 py-3 text-right"><span className={`font-mono font-black text-xs ${item.tempo_total ? "text-white" : "text-slate-700"}`}>{item.tempo_total ? `${item.tempo_total.toFixed(1)}s` : "—"}</span></td>
                          {PROCESS_COLS.map(p => <td key={p.key} className="px-3 py-3 text-right"><span className={`font-mono text-xs ${(item as any)[p.key] ? p.color : "text-slate-700"}`}>{fmtSec((item as any)[p.key])}</span></td>)}
                        </tr>
                        <AnimatePresence>
                          {isExpanded && (
                            <tr key={`${item.sku}-exp`}>
                              <td colSpan={8+PROCESS_COLS.length} className="px-6 pb-4 bg-[#1e2333] border-b border-slate-800/50">
                                <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.15}}
                                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-3">
                                  {item.pecas_kd!=null && <InfoChip label="Pecas no KD" value={String(item.pecas_kd)} />}
                                  {item.tp_emb_forn && <InfoChip label="TP Emb. Forn." value={item.tp_emb_forn} />}
                                  {item.pd_emb_forn && <InfoChip label="PD Emb. Forn." value={item.pd_emb_forn} />}
                                  {item.tp_emb_dcc && <InfoChip label="TP Emb. DCC" value={item.tp_emb_dcc} />}
                                  {item.pd_emb_dcc && <InfoChip label="PD Emb. DCC" value={item.pd_emb_dcc} />}
                                  {item.carro && <InfoChip label="Carro" value={item.carro} />}
                                  {item.form_unid && <InfoChip label="Uni. Med. Form." value={item.form_unid} />}
                                  {item.form_qtd!=null && <InfoChip label="QTD Form." value={String(item.form_qtd)} />}
                                </motion.div>
                                <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                  {SUB_PROC_SAMPLES.map(proc => (
                                    <div key={proc.label} className={`bg-[#181b22] border ${proc.bColor} rounded-xl p-3`}>
                                      <p className={`text-[10px] font-black uppercase tracking-wider mb-2 ${proc.tColor}`}>{proc.label}</p>
                                      <div className="flex flex-wrap gap-1">
                                        {proc.keys.map((k, ki) => {
                                          const val = (item as any)[k] as number|null;
                                          return <span key={ki} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${val!=null ? "text-white bg-slate-700" : "text-slate-700"}`}>{ki+1}T:{val!=null ? `${val.toFixed(1)}s` : "—"}</span>;
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {(canEdit || isAdmin) && (
                                  <div className="flex flex-wrap justify-end gap-2 mt-3 pt-3 border-t border-slate-700/50">
                                    {/* Validar / Reverter Status */}
                                    {(() => {
                                      const allMapped = isAllTimesMapped(item);
                                      const isValidating = validatingSkus.has(item.sku);
                                      const isMapeado = item.status === "mapeado";

                                      if (isMapeado) {
                                        return (
                                          <button
                                            onClick={e => { e.stopPropagation(); handleValidateStatus(item, "pendente"); }}
                                            disabled={isValidating}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/40 border border-slate-600/30 text-slate-400 text-xs font-black hover:bg-slate-600/40 transition-all disabled:opacity-50"
                                          >
                                            {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                            Reverter p/ Pendente
                                          </button>
                                        );
                                      }

                                      if (allMapped) {
                                        return (
                                          <button
                                            onClick={e => { e.stopPropagation(); handleValidateStatus(item, "mapeado"); }}
                                            disabled={isValidating}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black hover:bg-emerald-500/25 transition-all disabled:opacity-50"
                                          >
                                            {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            Validar como Mapeado
                                          </button>
                                        );
                                      }

                                      if (isAdmin) {
                                        return (
                                          <button
                                            onClick={e => { e.stopPropagation(); handleValidateStatus(item, "mapeado"); }}
                                            disabled={isValidating}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black hover:bg-amber-500/25 transition-all disabled:opacity-50"
                                            title="Tempos incompletos — apenas Admin pode forcar"
                                          >
                                            {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                            Forcar Mapeado (ADM)
                                          </button>
                                        );
                                      }

                                      return null;
                                    })()}

                                    {/* Editar Item */}
                                    {canEdit && (
                                      <button onClick={e => { e.stopPropagation(); setEditingItem({...item}); }}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-black hover:bg-orange-500/25 transition-all">
                                        <Pencil className="w-3.5 h-3.5" />Editar Item
                                      </button>
                                    )}
                                  </div>
                                )}
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs text-slate-500 font-semibold">Pagina {page+1} de {totalPages} — {total.toLocaleString("pt-BR")} itens</span>
            <div className="flex gap-2">
              <button onClick={() => fetchData(page-1)} disabled={page===0||loading} className="p-2.5 rounded-xl bg-[#181b22] border border-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-800 transition-all"><ChevronLeft className="w-4 h-4" /></button>
              {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                const p=Math.max(0,Math.min(page-2,totalPages-5))+i;
                return <button key={p} onClick={() => fetchData(p)} disabled={loading} className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${p===page ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "bg-[#181b22] border border-slate-800 text-slate-400 hover:bg-slate-800"}`}>{p+1}</button>;
              })}
              <button onClick={() => fetchData(page+1)} disabled={page>=totalPages-1||loading} className="p-2.5 rounded-xl bg-[#181b22] border border-slate-800 text-slate-300 disabled:opacity-30 hover:bg-slate-800 transition-all"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {editingItem && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingItem(null)}>
            <div className="bg-[#181b22] border border-slate-800 rounded-3xl p-6 max-w-3xl w-full space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2"><Pencil className="w-5 h-5 text-orange-500" />Editar Item — <span className="font-mono text-orange-400">{editingItem.sku}</span></h3>
                  <p className="text-xs text-slate-400 mt-0.5">Alteracoes gravadas diretamente no banco de dados Supabase.</p>
                </div>
                <button onClick={() => setEditingItem(null)} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveEdit} className="space-y-5">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Identificacao do Item</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Descricao</label><input type="text" value={editingItem.descricao||""} onChange={e => setEditingItem({...editingItem,descricao:e.target.value})} className="w-full bg-[#1e222d] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors" /></div>
                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Modelo</label><input type="text" value={editingItem.modelo||""} onChange={e => setEditingItem({...editingItem,modelo:e.target.value})} className="w-full bg-[#1e222d] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors" /></div>
                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Status</label>
                      <select value={editingItem.status} onChange={e => setEditingItem({...editingItem,status:e.target.value as any})} className="w-full bg-[#1e222d] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors">
                        <option value="pendente">Pendente</option><option value="andamento">Em Andamento</option><option value="mapeado">Mapeado</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Tempos Medios por Sub-Processo (Segundos)</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {EDIT_PROCESS_FIELDS.map(sp => (
                      <div key={sp.key}>
                        <label className={`text-[10px] font-bold block mb-1 ${sp.color}`}>{sp.label}</label>
                        <input type="number" step="0.01" value={(editingItem as any)[sp.key]??""} onChange={e => { const val=e.target.value!==""?Number(e.target.value):null; setEditingItem({...editingItem,[sp.key]:val}); }} placeholder="0.00" className="w-full bg-[#1e222d] border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-white outline-none focus:border-orange-500 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Informacoes Adicionais</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Pecas KD</label><input type="number" value={editingItem.pecas_kd??""} onChange={e => setEditingItem({...editingItem,pecas_kd:e.target.value!==""?Number(e.target.value):null})} className="w-full bg-[#1e222d] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500" /></div>
                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">TP Emb Forn</label><input type="text" value={editingItem.tp_emb_forn||""} onChange={e => setEditingItem({...editingItem,tp_emb_forn:e.target.value})} className="w-full bg-[#1e222d] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500" /></div>
                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">TP Emb DCC</label><input type="text" value={editingItem.tp_emb_dcc||""} onChange={e => setEditingItem({...editingItem,tp_emb_dcc:e.target.value})} className="w-full bg-[#1e222d] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500" /></div>
                    <div><label className="text-[10px] text-slate-400 font-bold block mb-1">Carro</label><input type="text" value={editingItem.carro||""} onChange={e => setEditingItem({...editingItem,carro:e.target.value})} className="w-full bg-[#1e222d] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500" /></div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button type="button" onClick={() => setEditingItem(null)} disabled={savingEdit} className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-colors">Cancelar</button>
                  <button type="submit" disabled={savingEdit} className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-colors">
                    {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingEdit ? "Salvando..." : "Salvar Alteracoes"}
                  </button>
                </div>
              </form>
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
      <button onClick={onRemove} className="hover:text-white transition-colors"><X className="w-3 h-3" /></button>
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
