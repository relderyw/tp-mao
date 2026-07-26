import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ScanLine, Search, CheckCircle2, Clock, Play,
  X, AlertCircle, Loader2, Package, RefreshCw,
  ChevronDown, ChevronUp, Boxes, QrCode, Keyboard
} from 'lucide-react';
import { getItensByChave, SaldoEstoque, SkuTp } from '../lib/supabase';

interface CheckKDProps {
  onStartTimer: (skuLabel: string) => void;
}

type ItemComStatus = SaldoEstoque & { tp: SkuTp | null };

// ── Sub-processos do T&P ──────────────────────────────────────────
const SUB_PROCESSOS = [
  { key: 'pegar_ik',  label: 'Pegar IK',          t1: 'pegar_ik_t1', t2: 'pegar_ik_t2', t3: 'pegar_ik_t3', res: 'pegar_ik_res' },
  { key: 'abrir',     label: 'Abrir Caixa',        t1: 'abrir_t1',    t2: 'abrir_t2',    t3: 'abrir_t3',    res: 'abrir_res'    },
  { key: 'form',      label: 'Formatar',            t1: 'form_t1',     t2: 'form_t2',     t3: 'form_t3',     res: 'form_res'     },
  { key: 'desc',      label: 'Descartar Resíduos',  t1: 'desc_t1',     t2: 'desc_t2',     t3: 'desc_t3',     res: 'desc_res'     },
  { key: 'etq',       label: 'Colar Etiqueta',      t1: 'etq_t1',      t2: 'etq_t2',      t3: 'etq_t3',      res: 'etq_res'      },
  { key: 'pos',       label: 'Posicionar IK',       t1: 'pos_t1',      t2: 'pos_t2',      t3: 'pos_t3',      res: 'pos_res'      },
] as const;

function fmt(s?: number | null) {
  if (!s) return '—';
  return s.toFixed(2) + 's';
}

// ── Card de item ──────────────────────────────────────────────────
function ItemCard({ item, onMapear }: { item: ItemComStatus; onMapear: (sku: string) => void; key?: string }) {
  const [expanded, setExpanded] = useState(false);
  const mapeado = item.tp?.status === 'mapeado';

  const countMapeados = SUB_PROCESSOS.filter(sp => {
    const res = item.tp?.[sp.res as keyof SkuTp];
    return res != null && (res as number) > 0;
  }).length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border overflow-hidden transition-all ${
        mapeado
          ? 'border-emerald-200 bg-emerald-50/60'
          : 'border-amber-200 bg-amber-50/60'
      }`}
    >
      {/* Header do card */}
      <div className="flex items-start gap-3 p-4">
        <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          mapeado ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
        }`}>
          {mapeado ? <CheckCircle2 size={18} /> : <Clock size={18} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {item.modelo || '—'}
            </span>
            {item.locacao && (
              <span className="text-[10px] font-bold text-slate-300 bg-slate-100 px-1.5 py-0.5 rounded">
                {item.locacao}
              </span>
            )}
          </div>
          <p className="font-black text-slate-800 text-sm leading-tight font-mono">{item.sku}</p>
          <p className="text-xs text-slate-500 truncate">{item.descricao?.trim()}</p>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] font-semibold text-slate-400">
              Qtde: <strong className="text-slate-600">{item.qtde}</strong>
            </span>
            {item.qtde_kd > 0 && (
              <span className="text-[10px] font-semibold text-slate-400">
                Por KD: <strong className="text-slate-600">{item.qtde_kd}</strong>
              </span>
            )}
            {!mapeado && item.tp && (
              <span className="text-[10px] font-bold text-amber-600">
                {countMapeados}/6 sub-processos
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {mapeado ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
              <CheckCircle2 size={10} /> CHECK OK
            </span>
          ) : (
            <button
              onClick={() => onMapear(item.sku)}
              className="flex items-center gap-1.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-95 px-3 py-1.5 rounded-xl transition-all shadow-md shadow-blue-200"
            >
              <Play size={11} className="fill-current" /> MAPEAR
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-slate-300 hover:text-slate-500 transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Detalhe expandido: tempos por sub-processo */}
      <AnimatePresence>
        {expanded && item.tp && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-slate-100 mt-0 pt-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SUB_PROCESSOS.map(sp => {
                  const res = item.tp?.[sp.res as keyof SkuTp] as number | undefined;
                  const feito = res != null && res > 0;
                  return (
                    <div key={sp.key} className={`rounded-xl p-2 text-center border ${
                      feito ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block leading-tight">
                        {sp.label}
                      </span>
                      <span className={`text-sm font-black font-mono ${feito ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {fmt(res)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {item.tp.tempo_total && (
                <div className="mt-2 text-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tempo Total: </span>
                  <span className="text-base font-black text-slate-700 font-mono">{fmt(item.tp.tempo_total)}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Componente principal ──────────────────────────────────────────
export default function CheckKD({ onStartTimer }: CheckKDProps) {
  const [mode, setMode] = useState<'qr' | 'manual'>('qr');
  const [inputValue, setInputValue] = useState(() => sessionStorage.getItem('LAST_CHECKED_KD_KEY') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemComStatus[] | null>(null);
  const [chaveAtual, setChaveAtual] = useState(() => sessionStorage.getItem('LAST_CHECKED_KD_KEY') || '');
  const inputRef = useRef<HTMLInputElement>(null);

  const buscar = useCallback(async (raw: string) => {
    const chave = raw.replace(/\s+/g, '').toUpperCase().trim();
    if (!chave) return;

    setLoading(true);
    setError(null);
    setChaveAtual(chave);
    sessionStorage.setItem('LAST_CHECKED_KD_KEY', chave);

    try {
      const resultado = await getItensByChave(chave);
      if (resultado.length === 0) {
        setError(`Nenhum item encontrado para a chave: ${chave}`);
      } else {
        setItens(resultado);
      }
    } catch (err: any) {
      setError('Erro ao consultar o banco: ' + (err.message || 'Falha de conexão'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-foco e auto-recarregamento ao voltar para a aba
  useEffect(() => {
    const saved = sessionStorage.getItem('LAST_CHECKED_KD_KEY');
    if (saved) {
      buscar(saved);
    }
  }, [buscar]);

  useEffect(() => {
    if (mode === 'qr' || mode === 'manual') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mode]);

  // Detecta leitura do scanner (Enter automático ou string rápida)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      buscar(inputValue);
    }
  };

  const handleLimpar = () => {
    setInputValue('');
    setItens(null);
    setError(null);
    setChaveAtual('');
    sessionStorage.removeItem('LAST_CHECKED_KD_KEY');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const mapeados = itens?.filter(i => i.tp?.status === 'mapeado').length ?? 0;
  const pendentes = itens ? itens.length - mapeados : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">

      {/* ── Header ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(0,102,178,0.1)' }}>
            <QrCode size={22} style={{ color: '#0066b2' }} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 tracking-tight">Check de KD</h2>
            <p className="text-xs text-slate-400">Escaneie o QR Code da caixa ou digite a chave</p>
          </div>
        </div>

        {/* Toggle QR / Manual */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1 mb-4">
          <button
            onClick={() => setMode('qr')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'qr' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ScanLine size={14} /> Scanner / QR Code
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              mode === 'manual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Keyboard size={14} /> Digitar Chave
          </button>
        </div>

        {/* Campo de entrada (funciona para scanner e digitação) */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
            {mode === 'qr' ? <ScanLine size={18} /> : <Search size={18} />}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'qr'
                ? 'Aguardando leitura do scanner... (Enter para buscar)'
                : 'Ex: HDAK80F09003/201800125449 (espaços são ignorados)'
            }
            className="w-full pl-10 pr-24 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-700 outline-none focus:ring-2 focus:border-transparent transition-all"
            style={{ '--tw-ring-color': '#0066b2' } as any}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            {inputValue && (
              <button onClick={handleLimpar} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                <X size={16} />
              </button>
            )}
            <button
              onClick={() => buscar(inputValue)}
              disabled={!inputValue.trim() || loading}
              className="flex items-center gap-1.5 text-xs font-black text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
              style={{ background: '#0066b2' }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              {loading ? '' : 'Buscar'}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-slate-300 mt-2 text-center">
          💡 Espaços na chave são removidos automaticamente antes da busca
        </p>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="animate-spin text-blue-600" size={36} />
          <p className="text-sm text-slate-400 font-medium">Consultando base de dados...</p>
        </div>
      )}

      {/* ── Erro ── */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3"
        >
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold text-red-700 text-sm">Não encontrado</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
            <button
              onClick={handleLimpar}
              className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1 hover:text-red-800 transition-colors"
            >
              <RefreshCw size={12} /> Tentar novamente
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Resultados ── */}
      {itens && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Sumário do KD */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Boxes size={18} className="text-slate-400" />
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">KD Encontrado</span>
              </div>
              <button
                onClick={() => buscar(chaveAtual)}
                className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-800 transition-colors"
              >
                <RefreshCw size={12} /> Atualizar
              </button>
            </div>

            <p className="font-mono text-xs text-slate-400 mb-3 break-all">{chaveAtual}</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center bg-slate-50 rounded-xl p-2">
                <span className="text-2xl font-black text-slate-800">{itens.length}</span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total SKUs</p>
              </div>
              <div className="text-center bg-emerald-50 rounded-xl p-2">
                <span className="text-2xl font-black text-emerald-600">{mapeados}</span>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Mapeados</p>
              </div>
              <div className="text-center bg-amber-50 rounded-xl p-2">
                <span className="text-2xl font-black text-amber-600">{pendentes}</span>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pendentes</p>
              </div>
            </div>

            {/* Barra de progresso */}
            <div className="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${itens.length > 0 ? (mapeados / itens.length) * 100 : 0}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full bg-emerald-500"
              />
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-1">
              {itens.length > 0 ? Math.round((mapeados / itens.length) * 100) : 0}% mapeado
            </p>
          </div>

          {/* Lista de itens */}
          <div className="space-y-3">
            {/* Pendentes primeiro */}
            {itens
              .sort((a, b) => {
                const aM = a.tp?.status === 'mapeado' ? 1 : 0;
                const bM = b.tp?.status === 'mapeado' ? 1 : 0;
                return aM - bM;
              })
              .map((item, idx) => (
                <ItemCard
                  key={`${item.sku}-${idx}`}
                  item={item}
                  onMapear={(sku) => onStartTimer(sku)}
                />
              ))}
          </div>

          {pendentes === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <h3 className="text-lg font-black text-slate-700">KD 100% Mapeado!</h3>
              <p className="text-sm text-slate-400 mt-1">Todos os itens deste KD possuem T&P registrado.</p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ── Estado inicial ── */}
      {!itens && !loading && !error && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Package size={36} className="text-slate-200" />
          </div>
          <h3 className="text-base font-bold text-slate-400">Aguardando leitura</h3>
          <p className="text-xs text-slate-300 mt-1">
            {mode === 'qr'
              ? 'Aponte o scanner para o QR Code da caixa'
              : 'Digite ou cole a chave do KD acima'}
          </p>
        </div>
      )}
    </div>
  );
}
