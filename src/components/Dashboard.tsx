import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Users, CheckCircle2, Clock, Activity, RefreshCw, Loader2,
  TrendingUp, Boxes, Play, ArrowRight, Award, Calendar,
  Filter, X, BarChart3, ChevronDown, Search, MapPin
} from 'lucide-react';
import { getDashboardAnalytics, DashboardData, DashboardDateRange, localDateKey, TpMapBucket } from '../lib/supabase';

// ── Helpers de data rápidos para os atalhos (fuso LOCAL do navegador = Manaus)
function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

type PresetKey = 'all' | 'today' | 'yesterday' | '7d' | '30d';

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'all',       label: 'Todo' },
  { key: 'today',     label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7d',        label: '7 dias' },
  { key: '30d',       label: '30 dias' },
];

export default function Dashboard({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    stats: { total: 0, concluidos: 0, andamento: 0, pendentes: 0 },
    analistas: [],
    modelos: [],
    periodLabel: null,
    periodTotalItems: 0,
    tpMapDistribution: [],
    mappingDates: [],
  });

  const [startDate, setStartDate] = useState<string>('');
  const [endDate,   setEndDate]   = useState<string>('');
  const [activePreset, setActivePreset] = useState<PresetKey>('all');
  // ⬇️ NOVO: Data exata de mapeamento selecionada (YYYY-MM-DD | '')
  // Usado para filtrar por UM dia específico em que itens foram MAREADOS.
  const [exactMappingDate, setExactMappingDate] = useState<string>('');
  const [dateDropdownOpen, setDateDropdownOpen] = useState<boolean>(false);
  const [dateFilterQuery, setDateFilterQuery] = useState<string>('');

  const applyPreset = (key: PresetKey) => {
    setActivePreset(key);
    const today = localDateKey(new Date());
    // Presets limpam o filtro de dia exato de mapeamento (são fluxos separados)
    setExactMappingDate('');
    switch (key) {
      case 'all':
        setStartDate(''); setEndDate('');
        return;
      case 'today':
        setStartDate(today); setEndDate(today);
        return;
      case 'yesterday': {
        const ys = localDateKey(addDays(new Date(), -1));
        setStartDate(ys); setEndDate(ys);
        return;
      }
      case '7d': {
        const s = localDateKey(addDays(new Date(), -6));
        setStartDate(s); setEndDate(today);
        return;
      }
      case '30d': {
        const s = localDateKey(addDays(new Date(), -29));
        setStartDate(s); setEndDate(today);
        return;
      }
    }
  };

  const loadData = async (range?: DashboardDateRange) => {
    setLoading(true);
    try {
      // Prioridade: filtro de dia exato de mapeamento (override no range de datas)
      let finalRange = range || { startDate: startDate || undefined, endDate: endDate || undefined };
      if (exactMappingDate) {
        finalRange = { startDate: exactMappingDate, endDate: exactMappingDate };
      }
      const result = await getDashboardAnalytics(finalRange);
      setData(result);
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Se o usuário escolher um dia exato de mapeamento → força start/end = esse dia.
    // Caso contrário, usa start/end normais.
    const range: DashboardDateRange = {};
    if (exactMappingDate) {
      range.startDate = exactMappingDate;
      range.endDate   = exactMappingDate;
    } else {
      if (startDate) range.startDate = startDate;
      if (endDate)   range.endDate   = endDate;
    }
    loadData(range);
  }, [startDate, endDate, exactMappingDate]);

  const clearFilter = () => { setExactMappingDate(''); setDateFilterQuery(''); applyPreset('all'); };

  const percentConcluido = data.stats.total > 0
    ? Number(((data.stats.concluidos / data.stats.total) * 100).toFixed(1))
    : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando Resumo Executivo...</p>
      </div>
    );
  }

  const hasFilter = !!startDate || !!endDate || !!exactMappingDate;
  const fmtPtBr = (d: string) => {
    if (!d) return '';
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  };
  const diaDaSemanaPt = (d: string) => {
    if (!d) return '';
    const [y, m, dd] = d.split('-').map(Number);
    const dw = new Date(y, (m||1) - 1, dd || 1).getDay();
    return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dw] || '';
  };

  // Filtra datas do dropdown por busca textual (dd/mm ou dia da semana)
  const filteredMappingDates = (() => {
    if (!dateFilterQuery.trim()) return data.mappingDates;
    const q = dateFilterQuery.trim().toLowerCase();
    return data.mappingDates.filter(md => {
      const pt = fmtPtBr(md.data);
      const dw = diaDaSemanaPt(md.data).toLowerCase();
      return pt.includes(q) || md.data.includes(q) || dw.includes(q);
    });
  })();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">

      {/* ── Topo: Título + Filtro de Datas + Botão Atualizar ── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              Resumo Geral de Cronometragem
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Acompanhamento em tempo real da medição de T&amp;P por analista e por modelo
              {hasFilter && (
                <span className="ml-2 inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold border border-blue-100">
                  <Filter className="w-3 h-3" />
                  Período: {fmtPtBr(startDate) || '...'} a {fmtPtBr(endDate) || '...'}
                  {data.periodTotalItems >= 0 && (
                    <span className="text-[10px] font-black ml-1 bg-white border border-blue-100 px-1.5 py-0.5 rounded">
                      {data.periodTotalItems} itens
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => loadData({ startDate: startDate || undefined, endDate: endDate || undefined })}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-200 flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Filtro de período: presets + inputs */}
        <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border transition-all ${
                  activePreset === p.key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="h-7 w-px bg-slate-200 mx-0.5" />

          <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Data Início
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={startDate}
                max={endDate || localDateKey(new Date())}
                onChange={(e) => { setActivePreset('all'); setStartDate(e.target.value); }}
                className="pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs font-bold text-slate-700 w-[145px]"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Data Fim
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={endDate}
                min={startDate || ''}
                max={localDateKey(new Date())}
                onChange={(e) => { setActivePreset('all'); setExactMappingDate(''); setEndDate(e.target.value); }}
                className="pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs font-bold text-slate-700 w-[145px]"
              />
            </div>
          </label>

          {/* ⬇️ NOVO: Seletor de DIA EXATO DE MAPEAMENTO (pesquisável) */}
          <div className="relative">
            <label className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Filtrar por Dia do Mapeamento
              <button
                type="button"
                onClick={() => setDateDropdownOpen(v => !v)}
                className={`relative w-[240px] text-left pl-3 pr-8 py-1.5 rounded-lg border transition-all text-xs font-bold flex items-center justify-between ${
                  exactMappingDate
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-600 focus:border-blue-500'
                }`}
              >
                {exactMappingDate ? (
                  <span className="flex items-center gap-2 truncate">
                    <MapPin className="w-3.5 h-3.5" />
                    {fmtPtBr(exactMappingDate)} · {diaDaSemanaPt(exactMappingDate)}
                  </span>
                ) : (
                  <span className="truncate text-slate-400">Selecionar dia do mapeamento…</span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 transition-transform ${dateDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </label>

            {dateDropdownOpen && (
              <>
                {/* Backdrop para fechar dropdown ao clicar fora */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDateDropdownOpen(false)}
                />
                <div className="absolute z-20 right-0 mt-2 w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  {/* Caixa de busca */}
                  <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar: dd/mm ou dia semana (seg/ter)…"
                        value={dateFilterQuery}
                        onChange={(e) => setDateFilterQuery(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        autoFocus
                      />
                    </div>
                  </div>
                  {/* Lista de opções */}
                  <div className="max-h-72 overflow-y-auto">
                    {data.mappingDates.length === 0 ? (
                      <div className="p-4 text-center">
                        <p className="text-xs font-bold text-slate-400">
                          Nenhum item mapeado ainda.
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Realize um mapeamento para que as datas apareçam aqui.
                        </p>
                      </div>
                    ) : filteredMappingDates.length === 0 ? (
                      <div className="p-4 text-center">
                        <p className="text-xs font-bold text-slate-400">
                          Nenhuma data encontrada com esse filtro.
                        </p>
                      </div>
                    ) : (
                      filteredMappingDates.map(md => {
                        const ativo = md.data === exactMappingDate;
                        return (
                          <button
                            key={md.data}
                            type="button"
                            onClick={() => {
                              setExactMappingDate(ativo ? '' : md.data);
                              setActivePreset('all');
                              setStartDate('');
                              setEndDate('');
                              setDateDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors border-b border-slate-50 last:border-b-0 ${
                              ativo
                                ? 'bg-emerald-50 text-emerald-700 font-black'
                                : 'hover:bg-slate-50 text-slate-700 font-semibold'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {fmtPtBr(md.data)} · <span className="text-slate-500">{diaDaSemanaPt(md.data)}</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              ativo ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {md.quantidade} itens
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {hasFilter && (
            <button
              onClick={clearFilter}
              className="px-2.5 py-1.5 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
              title="Limpar filtro de datas"
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards do Topo ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total SKUs */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total de SKUs</span>
            <p className="text-2xl font-black text-slate-800 font-mono leading-tight">{data.stats.total.toLocaleString()}</p>
          </div>
        </div>

        {/* Mapeados (Concluídos) */}
        <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Concluídos</span>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-800 font-mono leading-tight">{data.stats.concluidos.toLocaleString()}</p>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {percentConcluido}%
              </span>
            </div>
          </div>
        </div>

        {/* Em Andamento */}
        <div className="bg-white p-5 rounded-3xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Em Andamento</span>
            <p className="text-2xl font-black text-slate-800 font-mono leading-tight">{data.stats.andamento.toLocaleString()}</p>
          </div>
        </div>

        {/* Pendentes */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pendentes</span>
            <p className="text-2xl font-black text-slate-700 font-mono leading-tight">{data.stats.pendentes.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── SEÇÃO 0.5: GRÁFICO DE DISTRIBUIÇÃO tp_map
           Mostra QUANTOS itens mapeados têm N dias úteis desde que foram finalizados.
           Ajuda a verificar se itens recentes estão se acumulando ou precisam de re-trabalho. */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">
                Envelhecimento dos Itens Mapeados
              </h2>
              <p className="text-xs text-slate-400">
                Distribuição por dias úteis desde a conclusão do mapeamento (tp_map).
                {exactMappingDate && (
                  <span className="ml-1 inline-flex items-center text-emerald-600 font-bold">
                    (Filtrado por dia do mapeamento)
                  </span>
                )}
              </p>
            </div>
          </div>

          {(() => {
            // Totais rápidos do gráfico para a direita
            const totalMapeados = data.tpMapDistribution.reduce((s, b) => s + b.quantidade, 0);
            const hoje = data.tpMapDistribution[0]?.quantidade || 0;
            const novos7 = data.tpMapDistribution.slice(0, 7).reduce((s, b) => s + b.quantidade, 0);
            const velhos = (data.tpMapDistribution[30]?.quantidade || 0);
            return (
              <div className="flex gap-2 flex-wrap">
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-center">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                    Total
                  </span>
                  <span className="text-sm font-black text-slate-800 font-mono">{totalMapeados}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-center">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 block">
                    Hoje
                  </span>
                  <span className="text-sm font-black text-emerald-700 font-mono">{hoje}</span>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-center">
                  <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 block">
                    ≤ 7 dias
                  </span>
                  <span className="text-sm font-black text-blue-700 font-mono">{novos7}</span>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-center">
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 block">
                    30+ dias
                  </span>
                  <span className="text-sm font-black text-amber-700 font-mono">{velhos}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {(() => {
          const dados = data.tpMapDistribution;
          const totalBars = dados.reduce((s, b) => s + b.quantidade, 0);
          if (totalBars === 0) {
            return (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl">
                <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-500">
                  {exactMappingDate ? 'Nenhum item mapeado nesse dia' : 'Nenhum item concluído ainda para exibir'}
                </p>
                <p className="text-xs text-slate-400">
                  Itens mapeados aparecerão aqui distribuídos por quantidade de dias úteis desde seu fechamento.
                </p>
              </div>
            );
          }
          // Calcula barra mais alta para normalizar alturas
          const maxQty = Math.max(...dados.map(b => b.quantidade), 1);
          // Exibe apenas os buckets que tiverem atividade, + 2 de contexto (ou todos até 15)
          const temDado = dados.map(b => b.quantidade > 0);
          const ultimoIdx = (() => {
            let last = 0;
            temDado.forEach((tem, i) => { if (tem) last = i; });
            return Math.max(last + 2, 7); // pelo menos 7 primeiros buckets
          })();
          const exibir = dados.slice(0, Math.min(ultimoIdx + 1, dados.length));

          return (
            <div>
              {/* Área do gráfico */}
              <div className="relative bg-slate-50/50 rounded-2xl p-4 border border-slate-100 overflow-hidden">
                {/* Grid horizontal de fundo */}
                <div className="absolute inset-4 pointer-events-none">
                  {[0.25, 0.5, 0.75, 1].map(pct => (
                    <div
                      key={pct}
                      className="absolute left-0 right-0 border-t border-dashed border-slate-200"
                      style={{ bottom: `${pct * 100}%` }}
                    />
                  ))}
                </div>
                <div className="flex items-end justify-around gap-1 relative h-[240px]">
                  {exibir.map((bucket, i) => {
                    const hPct = (bucket.quantidade / maxQty) * 100;
                    const isHoje = bucket.dias === 0;
                    const isVelho = bucket.dias >= 30;
                    const destaque = isHoje || isVelho || bucket.quantidade === maxQty;
                    return (
                      <motion.div
                        key={bucket.dias}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.03 * i }}
                        className="flex flex-col items-center justify-end flex-1 max-w-[44px] min-w-[28px] h-full group"
                      >
                        {/* Popover com quantidade */}
                        <div className="mb-1 px-1.5 py-0.5 rounded text-[9px] font-black text-white bg-slate-800 opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap translate-y-1 group-hover:translate-y-0">
                          {bucket.quantidade} itens
                        </div>
                        {/* Barra */}
                        <div
                          className={`w-full rounded-t-lg transition-all shadow-sm ${
                            isHoje ? 'bg-gradient-to-b from-emerald-500 to-emerald-600'
                              : isVelho ? 'bg-gradient-to-b from-amber-500 to-amber-600'
                              : destaque ? 'bg-gradient-to-b from-blue-500 to-blue-600'
                              : 'bg-gradient-to-b from-slate-400/80 to-slate-500/80'
                          } ${destaque ? 'ring-2 ring-offset-1 ring-slate-200' : ''}`}
                          style={{
                            height: hPct < 3 && bucket.quantidade > 0 ? '3px' : `${hPct}%`,
                            minHeight: bucket.quantidade > 0 ? '2px' : '0px',
                          }}
                          title={`${bucket.label}: ${bucket.quantidade} itens`}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
              {/* Rótulos (eixo X) */}
              <div className="flex items-stretch justify-around gap-1 mt-2">
                {exibir.map(bucket => {
                  const isHoje = bucket.dias === 0;
                  const isVelho = bucket.dias >= 30;
                  return (
                    <div
                      key={bucket.dias + '-x'}
                      className={`flex-1 max-w-[44px] min-w-[28px] text-center truncate ${
                        isHoje ? 'text-emerald-700' : isVelho ? 'text-amber-700' : 'text-slate-500'
                      } font-black text-[9px]`}
                      title={bucket.label}
                    >
                      {bucket.dias === 0 ? '0' : isVelho ? '30+' : String(bucket.dias)}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-1 px-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <span>Recentes ⬅️</span>
                <span>Dias úteis desde o mapeamento (tp_map)</span>
                <span>➡️ Antigos</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── SEÇÃO 1: PRODUTIVIDADE POR ANALISTA ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">Produtividade por Analista</h2>
              <p className="text-xs text-slate-400">
                {hasFilter
                  ? `Itens mapeados no período (${fmtPtBr(startDate)} a ${fmtPtBr(endDate)}) e itens feitos HOJE por controlador de T&P`
                  : 'Itens mapeados hoje e acumulado total por controlador de T&P'}
              </p>
            </div>
          </div>
        </div>

        {data.analistas.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl">
            <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500">
              {hasFilter ? 'Nenhum item registrado nesse período de datas' : 'Nenhum item mapeado registrado ainda'}
            </p>
            <p className="text-xs text-slate-400">As medições feitas na tela de Mapeamento aparecerão agrupadas por analista aqui.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.analistas.map((an, idx) => (
              <motion.div
                key={an.nome}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-blue-600 text-white font-black text-base flex items-center justify-center shadow-md">
                      {an.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm leading-tight">{an.nome}</h3>
                      <span className="text-[10px] font-semibold text-slate-400">Controlador de T&amp;P</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      Projeção
                    </span>
                    <p className="text-xs font-black text-slate-700 font-mono mt-0.5">
                      ~{an.capacidadeEstimadaDia} itens/dia
                    </p>
                  </div>
                </div>

                {/* Métricas Principais */}
                <div className={`grid gap-2 pt-2 border-t border-slate-200/60 ${hasFilter ? 'grid-cols-2' : 'grid-cols-2'}`}>
                  <div className="bg-white p-2.5 rounded-xl text-center border border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Hoje</span>
                    <span className="text-base font-black text-emerald-600 font-mono">{an.hoje}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl text-center border border-blue-100">
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider block">
                      {hasFilter ? 'No Período' : 'Total Mapeado'}
                    </span>
                    <span className="text-base font-black text-blue-600 font-mono">{an.total}</span>
                  </div>
                </div>

                {/* Indicadores de Tempo & Ritmo A -> B -> C */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      {hasFilter ? 'Tempo Médio da Peça no Período:' : 'Tempo Médio da Peça:'}
                    </span>
                    <span className="font-black text-slate-800 font-mono">
                      {an.mediaTempo ? an.mediaTempo + 's' : '—'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-100">
                    <span className="text-slate-500 font-semibold flex items-center gap-1" title="Ritmo médio de ciclo entre conclusões do Item A -> B -> C">
                      <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                      Ritmo (Item A ➔ B):
                    </span>
                    <span className="font-black text-orange-600 font-mono">
                      {an.tempoMedioCicloMin ? an.tempoMedioCicloMin + ' min/item' : '—'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── SEÇÃO 2: RESUMO POR MODELO ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">Resumo por Modelo de Motocicleta</h2>
              <p className="text-xs text-slate-400">
                {hasFilter
                  ? `Modelos com atividade no período de ${fmtPtBr(startDate)} a ${fmtPtBr(endDate)}`
                  : 'Status dos SKUs agrupados por modelo do galpão'}
              </p>
            </div>
          </div>
        </div>

        {data.modelos.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl">
            <p className="text-sm font-bold text-slate-500">
              {hasFilter ? 'Nenhum modelo registrou atividade nesse período de datas' : 'Nenhum modelo cadastrado na base'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-4">Modelo</th>
                  <th className="py-3 px-4 text-center">Total SKUs</th>
                  <th className="py-3 px-4 text-center">Concluídos</th>
                  <th className="py-3 px-4 text-center">Em Andamento</th>
                  <th className="py-3 px-4 text-center">Pendentes</th>
                  <th className="py-3 px-4">Progresso do Modelo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {data.modelos.map((m) => (
                  <tr key={m.modelo} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-black font-mono text-slate-800 text-sm">
                      {m.modelo}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700 font-mono">
                      {m.total}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600 font-mono">
                      {m.mapeados}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-amber-600 font-mono">
                      {m.andamento}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-400 font-mono">
                      {m.pendentes}
                    </td>
                    <td className="py-3 px-4 min-w-[180px]">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${m.percent}%` }}
                          />
                        </div>
                        <span className="font-bold text-xs text-slate-600 font-mono w-10 text-right">
                          {m.percent}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
