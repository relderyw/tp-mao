import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, ChevronLeft, ChevronRight, Play, Pause, Save, RotateCcw,
  CheckCircle2, Clock, AlertCircle, Loader2, Sparkles, User, RefreshCw,
  Zap, FastForward, ArrowDownRight, Layers
} from 'lucide-react';
import {
  getSkusList, getStatsTp, saveSubProcessMeasurements, SkuTp, StatsTp
} from '../lib/supabase';
import { getSession } from '../lib/auth';

interface MappingWorkspaceProps {
  initialSku?: string;
  onClose?: () => void;
}

// Configuração dos 6 sub-processos na ordem exata solicitada com 5 tomadas cada (t1 a t5)
const PROCESS_CONFIGS = [
  {
    id: 'pegar_ik',
    title: 'Pegar IK',
    borderColor: 'border-cyan-500',
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-400',
    btnColor: 'bg-cyan-500 hover:bg-cyan-600',
    t1Key: 'pegar_ik_t1', t2Key: 'pegar_ik_t2', t3Key: 'pegar_ik_t3', t4Key: 'pegar_ik_t4', t5Key: 'pegar_ik_t5', resKey: 'pegar_ik_res'
  },
  {
    id: 'abrir',
    title: 'Pegar e abrir caixa',
    borderColor: 'border-orange-500',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    btnColor: 'bg-orange-500 hover:bg-orange-600',
    t1Key: 'abrir_t1', t2Key: 'abrir_t2', t3Key: 'abrir_t3', t4Key: 'abrir_t4', t5Key: 'abrir_t5', resKey: 'abrir_res'
  },
  {
    id: 'form',
    title: 'Formatar',
    borderColor: 'border-emerald-500',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    btnColor: 'bg-emerald-500 hover:bg-emerald-600',
    t1Key: 'form_t1', t2Key: 'form_t2', t3Key: 'form_t3', t4Key: 'form_t4', t5Key: 'form_t5', resKey: 'form_res'
  },
  {
    id: 'desc',
    title: 'Descartar Residuo (caixa)',
    borderColor: 'border-purple-500',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-400',
    btnColor: 'bg-purple-500 hover:bg-purple-600',
    t1Key: 'desc_t1', t2Key: 'desc_t2', t3Key: 'desc_t3', t4Key: 'desc_t4', t5Key: 'desc_t5', resKey: 'desc_res'
  },
  {
    id: 'etq',
    title: 'Colar Etiqueta',
    borderColor: 'border-blue-500',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    btnColor: 'bg-blue-500 hover:bg-blue-600',
    t1Key: 'etq_t1', t2Key: 'etq_t2', t3Key: 'etq_t3', t4Key: 'etq_t4', t5Key: 'etq_t5', resKey: 'etq_res'
  },
  {
    id: 'pos',
    title: 'Posicionar IK no palete',
    borderColor: 'border-amber-500',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    btnColor: 'bg-amber-500 hover:bg-amber-600',
    t1Key: 'pos_t1', t2Key: 'pos_t2', t3Key: 'pos_t3', t4Key: 'pos_t4', t5Key: 'pos_t5', resKey: 'pos_res'
  }
] as const;

export default function MappingWorkspace({ initialSku }: MappingWorkspaceProps) {
  const currentUser = getSession();
  const operatorName = currentUser?.displayName || 'Operador';

  // Estados dos SKUs e busca
  const [skus, setSkus] = useState<SkuTp[]>([]);
  const [selectedSkuIndex, setSelectedSkuIndex] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingSkus, setLoadingSkus] = useState(true);

  // Estatísticas do painel
  const [stats, setStats] = useState<StatsTp>({ total: 8643, concluidos: 0, andamento: 0, pendentes: 8643 });

  // Estado do sub-processo ativo
  const [activeProcessId, setActiveProcessId] = useState<string>('pegar_ik');

  // Cronômetro — usa ref para o startTime para evitar recriação do interval a cada tick
  const [time, setTime] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Mantém timeRef sempre sincronizado com time
  useEffect(() => { timeRef.current = time; }, [time]);

  // Estado dos campos adicionais do item (FORN. + DCC-AÇAÍ + FORMATAR específicos)
  const [itemInfo, setItemInfo] = useState({
    pecas_kd: '' as string,
    tp_emb_forn: '' as string,
    pd_emb_forn: '' as string,
    tp_emb_dcc: '' as string,
    pd_emb_dcc: '' as string,
    carro: '' as string,
    form_unid: '' as string,
    form_qtd: '' as string,
  });
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);

  // Carregar SKUs e estatísticas
  useEffect(() => {
    loadData();
  }, [searchTerm]);

  const loadData = async () => {
    setLoadingSkus(true);
    try {
      const [list, st] = await Promise.all([
        getSkusList(searchTerm, 100),
        getStatsTp()
      ]);
      setSkus(list);
      setStats(st);

      if (initialSku && list.length > 0) {
        const idx = list.findIndex(s => s.sku === initialSku);
        if (idx !== -1) setSelectedSkuIndex(idx);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSkus(false);
    }
  };

  const selectedSku = skus[selectedSkuIndex] || null;

  // Sincroniza itemInfo quando troca de SKU
  useEffect(() => {
    if (selectedSku) {
      setItemInfo({
        pecas_kd: selectedSku.pecas_kd != null ? String(selectedSku.pecas_kd) : '',
        tp_emb_forn: selectedSku.tp_emb_forn || '',
        pd_emb_forn: selectedSku.pd_emb_forn || '',
        tp_emb_dcc: selectedSku.tp_emb_dcc || '',
        pd_emb_dcc: selectedSku.pd_emb_dcc || '',
        carro: selectedSku.carro || '',
        form_unid: selectedSku.form_unid || '',
        form_qtd: selectedSku.form_qtd != null ? String(selectedSku.form_qtd) : '',
      });
      setInfoSaved(false);
    }
  }, [selectedSkuIndex, skus]);

  // Salva os campos adicionais do item
  const saveItemInfo = async () => {
    if (!selectedSku) return;
    setSavingInfo(true);
    const fields: Partial<SkuTp> = {
      pecas_kd: itemInfo.pecas_kd !== '' ? Number(itemInfo.pecas_kd) : null,
      tp_emb_forn: itemInfo.tp_emb_forn || null,
      pd_emb_forn: itemInfo.pd_emb_forn || null,
      tp_emb_dcc: itemInfo.tp_emb_dcc || null,
      pd_emb_dcc: itemInfo.pd_emb_dcc || null,
      carro: itemInfo.carro || null,
      form_unid: itemInfo.form_unid || null,
      form_qtd: itemInfo.form_qtd !== '' ? Number(itemInfo.form_qtd) : null,
    };
    const updated = await saveSubProcessMeasurements(selectedSku.sku, fields, operatorName);
    if (updated) {
      const newSkus = [...skus];
      newSkus[selectedSkuIndex] = updated;
      setSkus(newSkus);
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 2000);
    }
    setSavingInfo(false);
  };

  // Lógica do cronômetro — NÃO inclui `time` nas dependências para não recriar o interval a cada tick
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - (timeRef.current * 1000);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setTime(elapsed);
        timeRef.current = elapsed;
      }, 30);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning]); // ← apenas isRunning, sem time

  const resetTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setTime(0);
    timeRef.current = 0;
    setIsRunning(false);
  };

  // Trocar de SKU (setas ← →)
  const handlePrevSku = () => {
    if (selectedSkuIndex > 0) {
      setSelectedSkuIndex(selectedSkuIndex - 1);
      resetTimer();
    }
  };

  const handleNextSku = () => {
    if (selectedSkuIndex < skus.length - 1) {
      setSelectedSkuIndex(selectedSkuIndex + 1);
      resetTimer();
    }
  };

  // ── Gravar tomada para um sub-processo específico ──────────────────────────
  const recordTimeToProcess = async (
    procConfig: typeof PROCESS_CONFIGS[number],
    customTimeSec?: number,
    keepRunningAfter: boolean = false
  ) => {
    if (!selectedSku) return null;
    const timeToRecord = customTimeSec !== undefined ? customTimeSec : time;
    if (timeToRecord === 0) return null;

    const tVal = Number(timeToRecord.toFixed(2));

    // Identifica qual tomada (t1 a t5) está vaga
    const t1 = selectedSku[procConfig.t1Key as keyof SkuTp] as number | null;
    const t2 = selectedSku[procConfig.t2Key as keyof SkuTp] as number | null;
    const t3 = selectedSku[procConfig.t3Key as keyof SkuTp] as number | null;
    const t4 = selectedSku[procConfig.t4Key as keyof SkuTp] as number | null;
    const t5 = selectedSku[procConfig.t5Key as keyof SkuTp] as number | null;

    let targetKey: string = procConfig.t1Key;
    if (t1 != null && t2 == null) targetKey = procConfig.t2Key;
    else if (t1 != null && t2 != null && t3 == null) targetKey = procConfig.t3Key;
    else if (t1 != null && t2 != null && t3 != null && t4 == null) targetKey = procConfig.t4Key;
    else if (t1 != null && t2 != null && t3 != null && t4 != null && t5 == null) targetKey = procConfig.t5Key;
    else targetKey = procConfig.t5Key; // Sobrescreve a 5ª se todas preenchidas

    const currentT1 = (targetKey === procConfig.t1Key ? tVal : t1) || 0;
    const currentT2 = (targetKey === procConfig.t2Key ? tVal : t2) || 0;
    const currentT3 = (targetKey === procConfig.t3Key ? tVal : t3) || 0;
    const currentT4 = (targetKey === procConfig.t4Key ? tVal : t4) || 0;
    const currentT5 = (targetKey === procConfig.t5Key ? tVal : t5) || 0;

    const validTs = [currentT1, currentT2, currentT3, currentT4, currentT5].filter(v => v > 0);
    const avg = validTs.length > 0 ? Number((validTs.reduce((a, b) => a + b, 0) / validTs.length).toFixed(2)) : 0;

    const fieldsToSave: Partial<SkuTp> = {
      [targetKey]: tVal,
      [procConfig.resKey]: avg
    };

    const updated = await saveSubProcessMeasurements(selectedSku.sku, fieldsToSave, operatorName);

    if (updated) {
      const newSkus = [...skus];
      newSkus[selectedSkuIndex] = updated;
      setSkus(newSkus);
      setStats(await getStatsTp());

      // Verifica se completou as 5 tomadas desse sub-processo -> avança pro próximo sub-processo!
      const countRecorded = [
        updated[procConfig.t1Key as keyof SkuTp],
        updated[procConfig.t2Key as keyof SkuTp],
        updated[procConfig.t3Key as keyof SkuTp],
        updated[procConfig.t4Key as keyof SkuTp],
        updated[procConfig.t5Key as keyof SkuTp]
      ].filter(v => v != null && (v as number) > 0).length;

      if (countRecorded >= 5) {
        // Avança automaticamente para o próximo sub-processo na lista
        const currIdx = PROCESS_CONFIGS.findIndex(p => p.id === procConfig.id);
        if (currIdx !== -1 && currIdx < PROCESS_CONFIGS.length - 1) {
          setActiveProcessId(PROCESS_CONFIGS[currIdx + 1].id);
        }
      }
    }

    if (keepRunningAfter) {
      // Reinicia o cronômetro do zero imediatamente
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      startTimeRef.current = Date.now();
      timeRef.current = 0;
      setTime(0);
      setIsRunning(true);
      // Inicia interval manualmente pois isRunning pode já ser true (sem disparo de effect)
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setTime(elapsed);
        timeRef.current = elapsed;
      }, 30);
    } else {
      resetTimer();
    }

    return updated;
  };

  // ── Botão CICLO (Grava tomada atual e reinicia o cronômetro imediatamente) ──
  const handleCiclo = async () => {
    const currentProc = PROCESS_CONFIGS.find(p => p.id === activeProcessId);
    // Usa timeRef.current para garantir valor atual sem closure stale
    const capturedTime = timeRef.current;
    if (!currentProc || capturedTime < 0.1) return;

    // Para o cronômetro momentaneamente para capturar o tempo com precisão
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    // Grava o tempo capturado e reinicia automaticamente
    await recordTimeToProcess(currentProc, capturedTime, true);
  };

  // ── Trocar de Sub-processo com auto-salvamento se houver tempo decorrido ──
  const handleSelectProcess = async (targetProcId: string) => {
    if (targetProcId === activeProcessId) return;

    // Se houver tempo rodando/decorrido no processo atual, salva automaticamente antes de trocar
    if (time > 0) {
      const currentProc = PROCESS_CONFIGS.find(p => p.id === activeProcessId);
      if (currentProc) {
        await recordTimeToProcess(currentProc, time, false);
      }
    }

    setActiveProcessId(targetProcId);
    resetTimer();
  };

  // Limpar tomadas de um sub-processo
  const handleClearProcess = async (procConfig: typeof PROCESS_CONFIGS[number]) => {
    if (!selectedSku) return;

    const fieldsToSave: Partial<SkuTp> = {
      [procConfig.t1Key]: null,
      [procConfig.t2Key]: null,
      [procConfig.t3Key]: null,
      [procConfig.t4Key]: null,
      [procConfig.t5Key]: null,
      [procConfig.resKey]: null
    };

    const updated = await saveSubProcessMeasurements(selectedSku.sku, fieldsToSave, operatorName);
    if (updated) {
      const newSkus = [...skus];
      newSkus[selectedSkuIndex] = updated;
      setSkus(newSkus);
      resetTimer();
    }
  };

  const formatSecondsDisplay = (sec: number) => {
    const s = Math.floor(sec);
    const ms = Math.floor((sec - s) * 10);
    return `${s < 10 ? '0' + s : s}.${ms}`;
  };

  return (
    <div className="min-h-screen bg-[#111319] text-white p-4 md:p-6 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── PAINEL ESQUERDO: LISTA & PROGRESSO (5 colunas no desktop) ── */}
        <div className="lg:col-span-5 bg-[#181b22] border border-slate-800/80 rounded-3xl p-5 space-y-5 shadow-2xl">

          {/* Header Esquerda */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              RW T&amp;P
            </h2>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
              <User className="w-3.5 h-3.5 text-orange-400" />
              <span>{operatorName}</span>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="bg-[#1e222d] border border-slate-800 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-400">Progresso</span>
              <span className="text-white font-mono text-sm">
                {stats.concluidos} <span className="text-slate-500">/ {stats.total}</span>
              </span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (stats.concluidos / (stats.total || 1)) * 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
              />
            </div>
          </div>

          {/* 3 Cards Estatísticos (Pendente, Andamento, Concluído) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#1e222d] border border-slate-800 rounded-2xl p-3 text-center">
              <span className="text-2xl font-black text-white font-mono">{stats.pendentes}</span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Pendente</p>
            </div>
            <div className="bg-[#1e222d] border border-slate-800 rounded-2xl p-3 text-center">
              <span className="text-2xl font-black text-orange-400 font-mono">{stats.andamento}</span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Andamento</p>
            </div>
            <div className="bg-[#1e222d] border border-slate-800 rounded-2xl p-3 text-center">
              <span className="text-2xl font-black text-emerald-400 font-mono">{stats.concluidos}</span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Concluído</p>
            </div>
          </div>

          {/* Campo de Busca */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar código ou descrição"
              className="w-full bg-[#1e222d] border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500 transition-colors font-medium"
            />
          </div>

          {/* Lista de SKUs na Lateral */}
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {loadingSkus ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500 mr-2" />
                <span>Carregando SKUs...</span>
              </div>
            ) : skus.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs font-semibold">
                Nenhum SKU encontrado
              </div>
            ) : (
              skus.map((skuItem, idx) => {
                const isSelected = idx === selectedSkuIndex;
                const statusColor =
                  skuItem.status === 'mapeado' ? 'bg-emerald-500' :
                  skuItem.status === 'andamento' ? 'bg-orange-500' : 'bg-slate-600';

                return (
                  <button
                    key={skuItem.sku}
                    onClick={() => { setSelectedSkuIndex(idx); resetTimer(); }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-[#252a36] border-orange-500 shadow-lg shadow-orange-500/10'
                        : 'bg-[#1e222d]/60 border-slate-800/80 hover:bg-[#222733] hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <p className={`font-black text-sm font-mono truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {skuItem.sku}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5 font-medium">
                        {skuItem.descricao || 'Sem descrição'}
                      </p>
                    </div>
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${statusColor}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── PAINEL DIREITO: CRONÔMETRO E SUB-PROCESSOS (7 colunas no desktop) ── */}
        <div className="lg:col-span-7 space-y-4">

          {/* Header do SKU Ativo com Navegação das Setas ← → */}
          <div className="bg-[#181b22] border border-slate-800/80 rounded-3xl p-4 flex items-center justify-between">
            <button
              onClick={handlePrevSku}
              disabled={selectedSkuIndex === 0}
              className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="text-center min-w-0 px-4">
              <h1 className="text-lg md:text-xl font-black text-white font-mono tracking-tight truncate">
                {selectedSku ? selectedSku.sku : 'SELECIONE UM SKU'}
              </h1>
              <p className="text-xs text-slate-400 truncate font-medium mt-0.5">
                {selectedSku ? selectedSku.descricao : 'Carregando...'}
              </p>
            </div>

            <button
              onClick={handleNextSku}
              disabled={selectedSkuIndex >= skus.length - 1}
              className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* ── CARD: Informações do Item ── */}
          {selectedSku && (
            <div className="bg-[#181b22] border border-slate-800/80 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400" />
                  Informações do Item
                </h3>
                <button
                  onClick={saveItemInfo}
                  disabled={savingInfo}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                    infoSaved
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg'
                  }`}
                >
                  {savingInfo ? <Loader2 className="w-3 h-3 animate-spin" /> : infoSaved ? <CheckCircle2 className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                  {infoSaved ? 'Salvo!' : 'Salvar'}
                </button>
              </div>

              {/* FORN. */}
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Fornecedor (FORN.)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Peças no KD</label>
                    <input
                      type="number"
                      value={itemInfo.pecas_kd}
                      onChange={e => setItemInfo(p => ({ ...p, pecas_kd: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500 transition-colors font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">TP_Emb Forn.</label>
                    <input
                      type="text"
                      value={itemInfo.tp_emb_forn}
                      onChange={e => setItemInfo(p => ({ ...p, tp_emb_forn: e.target.value }))}
                      placeholder="Tipo..."
                      className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">PD_Emb Forn.</label>
                    <input
                      type="text"
                      value={itemInfo.pd_emb_forn}
                      onChange={e => setItemInfo(p => ({ ...p, pd_emb_forn: e.target.value }))}
                      placeholder="Padrão..."
                      className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* DCC-AÇAÍ */}
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">DCC-AÇAÍ</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">TP_Emb DCC</label>
                    <select
                      value={itemInfo.tp_emb_dcc}
                      onChange={e => setItemInfo(p => ({ ...p, tp_emb_dcc: e.target.value }))}
                      className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="">Selecionar...</option>
                      {['CARRO','IK05','IK10','IK33','SACO P.','MARFINITE','CAIXA','CAIXA MADEIRA','ROLO','SACO RAFIA','-'].map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">PD_Emb DCC</label>
                    <input
                      type="text"
                      value={itemInfo.pd_emb_dcc}
                      onChange={e => setItemInfo(p => ({ ...p, pd_emb_dcc: e.target.value }))}
                      placeholder="Padrão..."
                      className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Carro</label>
                    <input
                      type="text"
                      value={itemInfo.carro}
                      onChange={e => setItemInfo(p => ({ ...p, carro: e.target.value }))}
                      placeholder="Carro..."
                      className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* FORMATAR específicos */}
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Formatar — Configuração</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">Uni. Med.</label>
                    <select
                      value={itemInfo.form_unid}
                      onChange={e => setItemInfo(p => ({ ...p, form_unid: e.target.value }))}
                      className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="">Selecionar...</option>
                      {['PEÇA','CAIXA','CARRO','SACO P.','IK'].map(o => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">QTD</label>
                    <input
                      type="number"
                      value={itemInfo.form_qtd}
                      onChange={e => setItemInfo(p => ({ ...p, form_qtd: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#1e222d] border border-slate-700/70 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500 transition-colors font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Accordion dos 5 Sub-processos */}
          <div className="space-y-3">
            {PROCESS_CONFIGS.map((proc) => {
              const isActive = activeProcessId === proc.id;

              // Extrai as 5 tomadas do SKU para este sub-processo
              const t1 = selectedSku?.[proc.t1Key as keyof SkuTp] as number | null;
              const t2 = selectedSku?.[proc.t2Key as keyof SkuTp] as number | null;
              const t3 = selectedSku?.[proc.t3Key as keyof SkuTp] as number | null;
              const t4 = selectedSku?.[proc.t4Key as keyof SkuTp] as number | null;
              const t5 = selectedSku?.[proc.t5Key as keyof SkuTp] as number | null;
              const tomadas = [t1, t2, t3, t4, t5].filter(t => t != null && t > 0);
              const totalTomadasCount = tomadas.length;

              return (
                <div
                  key={proc.id}
                  className={`rounded-3xl border transition-all duration-300 overflow-hidden ${
                    isActive
                      ? `bg-[#181b22] ${proc.borderColor} border-2 shadow-2xl`
                      : 'bg-[#181b22]/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Cabeçalho do Card de Sub-processo */}
                  <button
                    onClick={() => handleSelectProcess(proc.id)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <span className={`font-black text-base md:text-lg ${proc.textColor}`}>
                      {proc.title}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/50">
                        {totalTomadasCount} de 5
                      </span>
                    </div>
                  </button>

                  {/* Conteúdo Expandido do Sub-processo Ativo (Cronômetro + Botões) */}
                  {isActive && (
                    <div className="px-6 pb-6 pt-0 space-y-6">

                      {/* Display Gigante do Tempo */}
                      <div className="text-center py-2">
                        <div className={`text-6xl md:text-7xl font-black font-mono tracking-tight tabular-nums ${
                          isRunning ? 'text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]' : 'text-white'
                        }`}>
                          {formatSecondsDisplay(time)}
                        </div>

                        {/* Pílulas das 5 tomadas já gravadas: 1T | 2T | 3T | 4T | 5T */}
                        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                          {[
                            { label: '1T', val: t1 },
                            { label: '2T', val: t2 },
                            { label: '3T', val: t3 },
                            { label: '4T', val: t4 },
                            { label: '5T', val: t5 }
                          ].map((pill, idx) => (
                            <div
                              key={idx}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-black flex items-center gap-1.5 ${
                                pill.val != null
                                  ? 'bg-slate-800 text-white border-slate-600'
                                  : 'bg-slate-900/50 text-slate-600 border-slate-800 border-dashed'
                              }`}
                            >
                              <span className="text-slate-400 text-[10px]">{pill.label}</span>
                              <span>{pill.val != null ? pill.val.toFixed(1) + 's' : '--'}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Botões Principais de Ação */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        {/* Botão INICIAR / PAUSAR */}
                        <button
                          onClick={() => setIsRunning(!isRunning)}
                          className={`py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 ${
                            isRunning
                              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                              : `${proc.btnColor} text-white`
                          }`}
                        >
                          {isRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                          {isRunning ? 'Pausar' : 'Iniciar'}
                        </button>

                        {/* Botão CICLO (Grava tomada atual e reinicia o cronômetro sem parar) */}
                        <button
                          onClick={handleCiclo}
                          disabled={time === 0}
                          className="py-4 rounded-2xl font-black text-sm bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 hover:from-orange-400 hover:to-amber-400 disabled:opacity-20 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-98"
                          title="Grava a tomada atual e já inicia a próxima tomada automaticamente"
                        >
                          <Zap className="w-4 h-4 fill-current" />
                          Ciclo
                        </button>

                        {/* Botão GRAVAR (Salva e zera) */}
                        <button
                          onClick={() => recordTimeToProcess(proc, time, false)}
                          disabled={time === 0}
                          className="py-4 rounded-2xl font-black text-sm bg-white text-slate-950 hover:bg-slate-100 disabled:opacity-20 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-98"
                        >
                          <Save className="w-4 h-4" />
                          Gravar
                        </button>

                        {/* Botão REINICIAR / LIMPAR */}
                        <button
                          onClick={() => handleClearProcess(proc)}
                          className="py-4 rounded-2xl bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-all border border-slate-700/50 flex items-center justify-center gap-2 font-bold text-xs"
                          title="Limpar as 5 tomadas deste sub-processo"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Limpar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
