import React, { useEffect, useState, useRef } from 'react';
import { collection, query, getDocs, doc, orderBy, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Process, Step, StudySession, Measurement } from '../types';
import { 
  Play, Pause, CheckCircle2, ChevronLeft, Save, 
  Clock, ClipboardList, PlayCircle, ArrowRight, RotateCcw, X, Trash2, Loader2, MousePointer2
} from 'lucide-react';
import { formatDuration } from '../lib/utils';

interface TimerSessionProps {
  processId: string;
  onClose: () => void;
  onSelectProcess: (id: string) => void;
}

interface FlatStep {
  id: string;
  name: string;
  level: number;
  order: number;
  excelId: string;
  parentName?: string;
  referenceTime?: number;
}

export default function TimerSession({ processId, onClose, onSelectProcess }: TimerSessionProps) {
  const [loading, setLoading] = useState(true);
  const [allProcesses, setAllProcesses] = useState<any[]>([]);
  const [flatSteps, setFlatSteps] = useState<FlatStep[]>([]);
  
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [currentMeasurements, setCurrentMeasurements] = useState<(number | null)[]>([null, null, null, null, null]);
  const [selectedSlot, setSelectedSlot] = useState<number>(0); // Slot ativo para gravação (0-4)
  
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!processId) {
      async function loadInitial() {
        setLoading(true);
        try {
          const q = query(collection(db, 'master_mapping'), orderBy('order'));
          const snap = await getDocs(q);
          const list = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(i => i.level === 1);
          setAllProcesses(list);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
      loadInitial();
    }
  }, [processId]);

  useEffect(() => {
    if (processId) {
      async function loadWorkflow() {
        setLoading(true);
        try {
          const qAll = query(collection(db, 'master_mapping'), orderBy('order'));
          const allSnap = await getDocs(qAll);
          const allItems = allSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
          
          const procIndex = allItems.findIndex(i => i.id === processId);
          if (procIndex === -1) return;
          
          const procData = allItems[procIndex];
          let endIdx = allItems.findIndex((i, idx) => idx > procIndex && i.level === 1);
          if (endIdx === -1) endIdx = allItems.length;

          const procBlock = allItems.slice(procIndex, endIdx);
          const steps: FlatStep[] = [];
          
          procBlock.forEach((item, idx) => {
            if (item.level === 1) return;
            const next = procBlock[idx + 1];
            const isLeaf = !next || next.level <= item.level;
            if (isLeaf) {
              steps.push({
                id: item.id,
                name: item.name,
                level: item.level,
                order: item.order,
                excelId: item.excelId,
                referenceTime: item.referenceTime,
                parentName: procData.name
              });
            }
          });

          setFlatSteps(steps);
          setActiveStepIndex(0);
          
          if (steps[0]) {
            loadStepData(steps[0].id);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
      loadWorkflow();
    }
  }, [processId]);

  const loadStepData = async (stepId: string) => {
    const docSnap = await getDoc(doc(db, 'master_mapping', stepId));
    const fresh = docSnap.data();
    const measures = [
      fresh?.m1?.t || null,
      fresh?.m2?.t || null,
      fresh?.m3?.t || null,
      fresh?.m4?.t || null,
      fresh?.m5?.t || null
    ];
    setCurrentMeasurements(measures);
    
    // Auto-selecionar o primeiro slot vazio
    const firstEmpty = measures.findIndex(m => m === null);
    setSelectedSlot(firstEmpty === -1 ? 0 : firstEmpty);
  };

  useEffect(() => {
    if (isRunning) {
      const start = Date.now() - (time * 1000);
      timerRef.current = window.setInterval(() => {
        setTime((Date.now() - start) / 1000);
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning, time]);

  const handleRecord = async () => {
    if (time === 0 || activeStepIndex === -1) return;
    const currentStep = flatSteps[activeStepIndex];
    const newMeasurements = [...currentMeasurements];
    
    newMeasurements[selectedSlot] = Number(time.toFixed(2));
    setCurrentMeasurements(newMeasurements);
    
    try {
      const docRef = doc(db, 'master_mapping', currentStep.id);
      const mKey = `m${selectedSlot + 1}`;
      await updateDoc(docRef, {
        [mKey]: { t: Number(time.toFixed(2)), q: 1, u: 'UN', ik: 1 }
      });
    } catch (err) {
      console.error(err);
    }

    // Avançar para o próximo slot (circularmente)
    setSelectedSlot((selectedSlot + 1) % 5);
    setTime(0);
    setIsRunning(false);
  };

  const clearMeasurements = async () => {
    if (!confirm('Deseja apagar as 5 tomadas deste passo?')) return;
    const currentStep = flatSteps[activeStepIndex];
    try {
      const docRef = doc(db, 'master_mapping', currentStep.id);
      await updateDoc(docRef, {
        m1: null, m2: null, m3: null, m4: null, m5: null
      });
      setCurrentMeasurements([null, null, null, null, null]);
      setSelectedSlot(0);
    } catch (err) {
      console.error(err);
    }
  };

  const nextStep = async () => {
    if (activeStepIndex < flatSteps.length - 1) {
      const nextIdx = activeStepIndex + 1;
      setActiveStepIndex(nextIdx);
      loadStepData(flatSteps[nextIdx].id);
      setTime(0);
      setIsRunning(false);
    }
  };

  if (!processId && !loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Selecione o Processo Macro</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-600 rounded-xl transition-all"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {allProcesses.map(p => (
            <button key={p.id} onClick={() => onSelectProcess(p.id)} className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-sm hover:shadow-lg hover:border-blue-400 transition-all text-left flex items-center justify-between group">
              <div>
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{p.sector || 'Operação'}</span>
                <h3 className="text-base font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{p.name}</h3>
              </div>
              <PlayCircle className="w-6 h-6 text-slate-200 group-hover:text-blue-600 transition-all" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-40"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>;

  const activeStep = flatSteps[activeStepIndex];
  const allFull = currentMeasurements.every(m => m !== null);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-600 rounded-xl transition-all"><ChevronLeft className="w-5 h-5" /></button>
        <div className="text-center"><h2 className="text-lg font-bold text-slate-800 tracking-tight">{activeStep?.parentName}</h2></div>
        <div className="w-10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-4 space-y-2">
          <h4 className="px-3 text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Passos</h4>
          <div className="max-h-[400px] overflow-auto pr-1 scrollbar-thin">
            {flatSteps.map((step, idx) => (
              <button key={step.id} onClick={() => setActiveStepIndex(idx)} className={`w-full flex items-center gap-2 p-3 rounded-xl border transition-all text-left ${idx === activeStepIndex ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}>
                <span className="font-mono text-[10px] opacity-50">{idx + 1}</span>
                <span className="font-bold text-[11px] truncate flex-1">{step.name}</span>
                {idx < activeStepIndex && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl p-8 relative overflow-hidden text-center">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-8 max-w-xl mx-auto leading-tight">{activeStep?.name}</h1>

            {/* Grade de 5 Tomadas Interativa */}
            <div className="grid grid-cols-5 gap-3 w-full max-w-2xl mx-auto mb-8">
              {currentMeasurements.map((m, i) => (
                <button 
                  key={i} 
                  onClick={() => setSelectedSlot(i)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-all ${
                    selectedSlot === i 
                      ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-lg scale-105' 
                      : m !== null ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-300 border-dashed'
                  }`}
                >
                  <span className={`text-[8px] font-black uppercase tracking-widest ${selectedSlot === i ? 'text-blue-500' : ''}`}>Tomada {i + 1}</span>
                  <span className="text-base font-black font-mono">{m ? m.toFixed(2) + 's' : '--'}</span>
                  {selectedSlot === i && <MousePointer2 className="w-3 h-3 animate-bounce mt-1" />}
                </button>
              ))}
            </div>

            <div className={`text-8xl font-mono font-black mb-8 tabular-nums tracking-tighter transition-all ${isRunning ? 'text-blue-600' : 'text-slate-800'}`}>
              {formatDuration(time)}
            </div>

            <div className="flex gap-4 w-full max-w-lg mx-auto">
              <button onClick={() => setIsRunning(!isRunning)} className={`flex-[2] flex items-center justify-center gap-3 p-6 rounded-2xl font-black text-base transition-all shadow-lg ${isRunning ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'}`}>
                {isRunning ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                {isRunning ? 'PAUSAR' : 'INICIAR'}
              </button>
              
              <button 
                onClick={handleRecord}
                disabled={time === 0}
                className={`flex-[1] p-6 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-lg disabled:opacity-20 ${allFull && selectedSlot === 0 ? 'bg-amber-600 text-white' : 'bg-slate-900 text-white'}`}
              >
                <Save className="w-6 h-6" /> GRAVAR {selectedSlot + 1}
              </button>
              
              <button onClick={() => { setTime(0); setIsRunning(false); }} className="p-6 rounded-2xl bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all border border-slate-200"><RotateCcw className="w-6 h-6" /></button>
            </div>
            
            {allFull && (
              <p className="mt-4 text-[10px] font-bold text-amber-600 uppercase tracking-widest flex items-center justify-center gap-2">
                <CheckCircle2 className="w-3 h-3" /> Ciclo Completo! Você pode regravar qualquer tomada selecionando acima.
              </p>
            )}
          </div>

          <div className="flex justify-between items-center px-8">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Meta</span>
              <span className="text-lg font-black text-slate-600">{activeStep?.referenceTime ? activeStep.referenceTime.toFixed(2) + 's' : '0.00s'}</span>
            </div>
            <div className="flex gap-4">
              <button onClick={clearMeasurements} className="bg-red-50 text-red-500 border border-red-100 py-3 px-6 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100 transition-all text-sm"><Trash2 className="w-4 h-4" /> LIMPAR PASSO</button>
              <button onClick={nextStep} className="bg-white border border-slate-200 py-3 px-8 rounded-xl font-bold text-slate-800 flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-sm">PRÓXIMO PASSO <ArrowRight className="w-4 h-4 text-blue-600" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
