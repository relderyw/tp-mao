import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StudySession, Process, Measurement, Step } from '../types';
import { Download, FileText, Calendar, User, Clock, ChevronRight, BarChart } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDuration } from '../lib/utils';

export default function Reports() {
  const [sessions, setSessions] = useState<(StudySession & { processName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<{
    session: StudySession;
    process: Process;
    measurements: (Measurement & { stepName: string })[];
  } | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    setLoading(true);
    try {
      const q = query(collection(db, 'study_sessions'), orderBy('startTime', 'desc'), limit(20));
      const querySnapshot = await getDocs(q);
      const sessionData = await Promise.all(querySnapshot.docs.map(async (d) => {
        const data = d.data() as StudySession;
        const pSnap = await getDoc(doc(db, 'processes', data.processId));
        return { 
          id: d.id, 
          ...data, 
          processName: pSnap.exists() ? (pSnap.data() as Process).name : 'Processo Excluído'
        };
      }));
      setSessions(sessionData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function viewSessionDetails(session: StudySession) {
    try {
      const pSnap = await getDoc(doc(db, 'processes', session.processId));
      if (!pSnap.exists()) return;
      const process = { id: pSnap.id, ...pSnap.data() } as Process;

      const mSnap = await getDocs(query(collection(db, `study_sessions/${session.id}/measurements`), orderBy('timestamp', 'asc')));
      const sSnap = await getDocs(collection(db, `processes/${session.processId}/steps`));
      const steps = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Step));

      const measurementData = await Promise.all(mSnap.docs.map(async d => {
        const m = d.data() as Measurement;
        const step = steps.find(s => s.id === m.stepId);
        let stepName = step?.name || 'Passo desconhecido';

        if (m.subStepId) {
          const ssSnap = await getDoc(doc(db, `processes/${session.processId}/steps/${m.stepId}/substeps`, m.subStepId));
          if (ssSnap.exists()) {
            stepName = `${stepName} - ${(ssSnap.data() as any).name}`;
          }
        }

        return { ...m, id: d.id, stepName };
      }));

      setSelectedSession({ session, process, measurements: measurementData });
    } catch (err) {
      console.error(err);
    }
  }

  const exportToCSV = () => {
    if (!selectedSession) return;
    const { session, process, measurements } = selectedSession;
    
    const headers = ['Processo', 'Setor', 'Origem', 'Analista', 'Data', 'Atividade Principal', 'Sub-passo', 'Duração (s)', 'Duração Formatada'];
    const rows = measurements.map(m => {
      const parts = m.stepName.split(' - ');
      const mainStep = parts[0];
      const subStep = parts.slice(1).join(' - ') || '-';
      
      return [
        process.name,
        process.sector,
        process.origin,
        session.userName,
        format(new Date(session.startTime), 'dd/MM/yyyy HH:mm'),
        mainStep,
        subStep,
        m.duration.toFixed(2),
        formatDuration(m.duration)
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_${process.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Sessions List */}
      <div className="lg:col-span-1 space-y-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-red-600" />
          Medições Recentes
        </h2>
        
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-2xl" />)}
          </div>
        ) : (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => viewSessionDetails(s)}
                className={`w-full text-left p-4 rounded-2xl border transition-all hover:shadow-md ${
                  selectedSession?.session.id === s.id ? 'bg-red-50 border-red-200 ring-2 ring-red-500/10' : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                    {s.status === 'completed' ? 'Finalizado' : 'Em curso'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(s.startTime), "d 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
                <h3 className="font-bold text-gray-900 truncate mb-1">{s.processName}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <User className="w-3 h-3" />
                  <span>{s.userName}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details View */}
      <div className="lg:col-span-2">
        {selectedSession ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{selectedSession.process.name}</h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {format(new Date(selectedSession.session.startTime), 'dd/MM/yyyy HH:mm')}</span>
                  <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {selectedSession.session.userName}</span>
                </div>
              </div>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>

            <div className="overflow-hidden border border-gray-100 rounded-2xl">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Ordem</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Passo / Atividade</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Duração</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedSession.measurements.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gray-100 text-gray-400 text-xs font-bold">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">{m.stepName}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                        {formatDuration(m.duration)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={2} className="px-6 py-4 text-gray-900">Tempo Total do Ciclo</td>
                    <td className="px-6 py-4 text-right font-mono text-red-600 text-lg">
                      {formatDuration(selectedSession.measurements.reduce((acc, curr) => acc + curr.duration, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Média por Passo</div>
                <div className="text-xl font-bold text-gray-900 tabular-nums">
                  {formatDuration(selectedSession.measurements.reduce((acc, curr) => acc + curr.duration, 0) / (selectedSession.measurements.length || 1))}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Atividades</div>
                <div className="text-xl font-bold text-gray-900 tabular-nums">
                  {selectedSession.measurements.length}
                </div>
              </div>
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-1">Eficiência Relativa</div>
                <div className="text-xl font-bold text-blue-900">Excelente</div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
            <BarChart className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-900">Análise de Dados</h3>
            <p className="text-gray-500 mt-2 max-w-xs">Selecione uma medição à esquerda para visualizar o detalhamento completo dos tempos e exportar relatórios.</p>
          </div>
        )}
      </div>
    </div>
  );
}
