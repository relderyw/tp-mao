import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Users, CheckCircle2, Clock, Activity, RefreshCw, Loader2,
  TrendingUp, Boxes, Play, ArrowRight, Award, Calendar
} from 'lucide-react';
import { getDashboardAnalytics, DashboardData } from '../lib/supabase';

export default function Dashboard({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    stats: { total: 0, concluidos: 0, andamento: 0, pendentes: 0 },
    analistas: [],
    modelos: []
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getDashboardAnalytics();
      setData(result);
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">

      {/* ── Topo: Título + Botão Atualizar ── */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Resumo Geral de Cronometragem
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Acompanhamento em tempo real da medição de T&amp;P por analista e por modelo
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-200 flex items-center gap-2 text-xs font-bold"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
          <span>Atualizar</span>
        </button>
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

      {/* ── SEÇÃO 1: PRODUTIVIDADE POR ANALISTA ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">Produtividade por Analista</h2>
              <p className="text-xs text-slate-400">Itens mapeados hoje e acumulado total por controlador de T&amp;P</p>
            </div>
          </div>
        </div>

        {data.analistas.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl">
            <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500">Nenhum item mapeado registrado ainda</p>
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
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                  <div className="bg-white p-2.5 rounded-xl text-center border border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Hoje</span>
                    <span className="text-base font-black text-emerald-600 font-mono">{an.hoje}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl text-center border border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Total Mapeado</span>
                    <span className="text-base font-black text-blue-600 font-mono">{an.total}</span>
                  </div>
                </div>

                {/* Indicadores de Tempo & Ritmo A -> B -> C */}
                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      Tempo Médio da Peça:
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
              <p className="text-xs text-slate-400">Status dos SKUs agrupados por modelo do galpão</p>
            </div>
          </div>
        </div>

        {data.modelos.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl">
            <p className="text-sm font-bold text-slate-500">Nenhum modelo cadastrado na base</p>
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
