import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  Target,
  Activity,
  Layers,
  Play,
  ArrowRight
} from 'lucide-react';

interface Stats {
  total: number;
  completed: number;
  pending: number;
  percentOk: number;
  percentPending: number;
}

interface ProcessSummary {
  id: string;
  name: string;
  total: number;
  completed: number;
  percent: number;
}

export default function Dashboard({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, pending: 0, percentOk: 0, percentPending: 0 });
  const [processSummaries, setProcessSummaries] = useState<ProcessSummary[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'master_mapping'), orderBy('order')));
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));

      const isLeaf = (item: any, index: number) => {
        const nextItem = items[index + 1];
        if (!nextItem) return true;
        return nextItem.level <= item.level;
      };

      const leafActivities = items.filter((item, idx) => item.level > 1 && isLeaf(item, idx));
      const total = leafActivities.length;
      const completed = leafActivities.filter(i => (i.referenceTime || 0) > 0).length;
      const pending = total - completed;
      const percentOk = total > 0 ? (completed / total) * 100 : 0;
      const percentPending = total > 0 ? (pending / total) * 100 : 0;

      setStats({ total, completed, pending, percentOk, percentPending });

      const summaries: ProcessSummary[] = [];
      const processes = items.filter(i => i.level === 1);

      processes.forEach(proc => {
        const procIndex = items.findIndex(i => i.id === proc.id);
        let nextProcIndex = items.findIndex((i, idx) => idx > procIndex && i.level === 1);
        if (nextProcIndex === -1) nextProcIndex = items.length;

        const procLeafs = items.slice(procIndex + 1, nextProcIndex).filter((item, idx) => {
          const globalIdx = procIndex + 1 + idx;
          return isLeaf(item, globalIdx);
        });

        const pTotal = procLeafs.length;
        const pCompleted = procLeafs.filter(i => (i.referenceTime || 0) > 0).length;

        summaries.push({
          id: proc.id,
          name: proc.name,
          total: pTotal,
          completed: pCompleted,
          percent: pTotal > 0 ? (pCompleted / pTotal) * 100 : 0
        });
      });

      setProcessSummaries(summaries);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Carregando Painel...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Enhanced Header with Action Button */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100/50 gap-6">
        <div className="flex items-center gap-5">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Painel Executivo</h1>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Sincronização Ativa • T&P-MAO
            </p>
          </div>
        </div>

        <button 
          onClick={() => onNavigate('timer')}
          className="bg-slate-900 hover:bg-blue-600 text-white group flex items-center gap-4 py-4 px-10 rounded-2xl transition-all shadow-xl shadow-slate-200 active:scale-95"
        >
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Novo Mapeamento</span>
            <span className="text-base font-bold">Iniciar Cronômetro</span>
          </div>
          <div className="bg-white/10 p-2 rounded-xl group-hover:bg-white group-hover:text-blue-600 transition-colors">
            <Play className="w-5 h-5 fill-current" />
          </div>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <StatCard icon={<Layers className="w-5 h-5" />} label="Atividades Totais" value={stats.total} subValue="Itens Identificados" color="blue" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Realizados" value={stats.completed} subValue={`${stats.percentOk.toFixed(1)}% Coberto`} color="green" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Pendentes" value={stats.pending} subValue={`${stats.percentPending.toFixed(1)}% Espera`} color="amber" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Evolução" value={`${stats.percentOk.toFixed(1)}%`} subValue="Realizado" color="indigo" isPercent />
        <StatCard icon={<Target className="w-5 h-5" />} label="Status" value={stats.percentOk > 80 ? 'Excelente' : 'Em Progresso'} subValue="Qualidade dos Dados" color="rose" />
      </div>

      {/* Progress Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Progresso por Processo
            </h2>
            <button onClick={() => onNavigate('spreadsheet')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1">
              Ver Planilha Completa <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 p-8 space-y-7">
            {processSummaries.map((proc) => (
              <div key={proc.id} className="group">
                <div className="flex justify-between items-end mb-2.5">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{proc.total} PONTOS DE MEDIÇÃO</p>
                    <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{proc.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-800">{proc.percent.toFixed(0)}%</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{proc.completed} de {proc.total} OK</p>
                  </div>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-100 p-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${proc.percent === 100 ? 'bg-emerald-500 shadow-emerald-200' : 'bg-blue-600 shadow-blue-200'}`}
                    style={{ width: `${proc.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Action Column */}
        <div className="space-y-6">
           <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group cursor-pointer" onClick={() => onNavigate('timer')}>
              <div className="relative z-10">
                <p className="text-blue-400 font-black uppercase tracking-widest text-[9px] mb-2">Ação Sugerida</p>
                <h3 className="text-xl font-bold mb-4 leading-tight group-hover:text-blue-300 transition-colors">Capture novos tempos agora.</h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-6">
                  Existem {stats.pending} atividades pendentes de medição. Use o cronômetro para atualizar a base.
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-white group-hover:translate-x-2 transition-transform">
                   Acessar Lista de Processos <ArrowRight className="w-4 h-4" />
                </div>
              </div>
              <Play className="w-32 h-32 text-slate-800 absolute -bottom-8 -right-8 opacity-40 group-hover:scale-110 transition-transform" />
           </div>

           <div className="bg-blue-600 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-200">
              <h3 className="text-base font-bold mb-6 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Resumo de Pendências
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-[11px] font-bold opacity-80 uppercase tracking-wider">Aguardando Coleta</span>
                  <span className="text-lg font-black">{stats.pending}</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-[11px] font-bold opacity-80 uppercase tracking-wider">Última Atualização</span>
                  <span className="text-[11px] font-bold">Hoje</span>
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subValue, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 shadow-blue-100/30',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/30',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100/30',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-indigo-100/30',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-100/30'
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-100/50 hover:translate-y-[-4px] transition-all">
      <div className={`w-10 h-10 rounded-xl ${colors[color]} border flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <p className="text-slate-400 font-black uppercase tracking-widest text-[8px] mb-1">{label}</p>
      <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
      <p className="text-slate-400 font-bold text-[9px] uppercase mt-1">{subValue}</p>
    </div>
  );
}
