import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ScanLine, Search, CheckCircle2, Clock, Play,
  X, AlertCircle, Loader2, Package, RefreshCw,
  ChevronDown, ChevronUp, Boxes, QrCode, Keyboard, Camera,
  MapPin, Filter, Layers, Building2, SwitchCamera, Lightbulb, ZoomIn, Minus, Plus
} from 'lucide-react';
import jsQR from 'jsqr';
import {
  getItensByChave, getResumoLocacoes, SaldoEstoque, SkuTp,
  LocacaoResumo, LocacaoItem
} from '../lib/supabase';

/** Mensagem amigável para erros comuns de getUserMedia / câmera. */
function mensagemErroCamera(err: unknown): string {
  const name = (err as any)?.name || '';
  const msg = String((err as any)?.message || err || '');
  if (name === 'NotAllowedError' || /permission/i.test(msg)) {
    return 'Permissão da câmera negada. Clique no ícone de cadeado na barra do navegador, permita a câmera e tente novamente.';
  }
  if (name === 'NotFoundError' || /not found|no device/i.test(msg)) {
    return 'Nenhuma câmera encontrada neste dispositivo.';
  }
  if (name === 'NotReadableError' || /in use|busy/i.test(msg)) {
    return 'A câmera está em uso por outro aplicativo. Feche outros apps que usam a câmera e tente novamente.';
  }
  if (name === 'OverconstrainedError' || /constraint/i.test(msg)) {
    return 'Configuração da câmera não suportada neste dispositivo. Tentando modo simplificado…';
  }
  if (/secure context|https/i.test(msg)) {
    return 'A câmera só funciona em HTTPS ou localhost. Acesse o site por uma conexão segura.';
  }
  if (/cannot transition|already under transition|already started/i.test(msg)) {
    return 'A câmera ficou em estado inconsistente. Clique em "Tentar novamente" para reiniciar o leitor.';
  }
  return msg || 'Não foi possível acessar a câmera. Verifique a permissão do navegador.';
}

/** Solicita permissão no contexto do clique do usuário (exigido por Chrome/Safari). */
async function preflightCameraPermission(facingMode: 'environment' | 'user' = 'environment'): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Seu navegador não suporta acesso à câmera.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode },
  });
  stream.getTracks().forEach(t => t.stop());
}

interface CheckKDProps {
  onStartTimer: (skuLabel: string) => void;
  mappingDirtyCounter?: number;
}

type ItemComStatus = SaldoEstoque & { tp: SkuTp | null };

function cmpStr(a: string, b: string): number {
  return String(a || '').localeCompare(String(b || ''), 'pt-BR', {
    sensitivity: 'base',
    numeric: true,
  });
}

function ordenarItens<T extends { descricao: string; sku: string; locacao?: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const r1 = cmpStr(a.sku, b.sku);
    if (r1 !== 0) return r1;
    const r2 = cmpStr(a.descricao, b.descricao);
    if (r2 !== 0) return r2;
    if (a.locacao || b.locacao) return cmpStr(a.locacao || '', b.locacao || '');
    return 0;
  });
}

function ordenarLocacoes(arr: LocacaoResumo[]): LocacaoResumo[] {
  return [...arr]
    .map(l => ({ ...l, itens: ordenarItens(l.itens || []) }))
    .sort((a, b) => cmpStr(a.locacao, b.locacao));
}

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

// ── Card de item individual (usado na aba Check por KD) ────────────────
function ItemCard({ item, onMapear }: { item: ItemComStatus; onMapear: (sku: string) => void; key?: React.Key }) {
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
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
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

// ── Componente Card de Locação (para a aba de resumo por locação) ─────
function LocacaoCard({
  resumo,
  expanded,
  onToggleExpand,
  onMapear
}: {
  resumo: LocacaoResumo;
  expanded: boolean;
  onToggleExpand: () => void;
  onMapear: (sku: string) => void;
  key?: React.Key;
}) {
  const percentMapeado = resumo.totalItens > 0
    ? Math.round((resumo.mapeados / resumo.totalItens) * 100)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all hover:border-slate-300"
    >
      {/* Cards Header */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
            <MapPin size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-800 text-base font-mono tracking-tight">
                {resumo.locacao}
              </h3>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {resumo.totalItens} {resumo.totalItens === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Progresso de mapeamento: <strong className="text-slate-700 font-mono">{percentMapeado}%</strong>
            </p>
          </div>
        </div>

        {/* Badges de Contagem */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mapeados */}
          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-xl text-xs font-black">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>{resumo.mapeados} Mapeados</span>
          </div>

          {/* Pendentes */}
          {resumo.pendentes > 0 && (
            <div className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-1 rounded-xl text-xs font-black">
              <Clock size={13} className="text-amber-500" />
              <span>{resumo.pendentes} Pendentes</span>
            </div>
          )}

          {/* Fora da Estrutura */}
          {resumo.naoNaEstrutura > 0 && (
            <div className="flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200/60 px-2.5 py-1 rounded-xl text-xs font-black">
              <AlertCircle size={13} className="text-rose-500" />
              <span>{resumo.naoNaEstrutura} Fora da Estrutura</span>
            </div>
          )}

          <button
            onClick={onToggleExpand}
            className="ml-auto sm:ml-2 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Barra de Progresso Tricolor da Locação */}
      <div className="w-full bg-slate-100 h-1.5 flex overflow-hidden">
        <div
          className="bg-emerald-500 transition-all duration-500"
          style={{ width: `${resumo.totalItens > 0 ? (resumo.mapeados / resumo.totalItens) * 100 : 0}%` }}
          title={`${resumo.mapeados} mapeados`}
        />
        <div
          className="bg-amber-400 transition-all duration-500"
          style={{ width: `${resumo.totalItens > 0 ? (resumo.pendentes / resumo.totalItens) * 100 : 0}%` }}
          title={`${resumo.pendentes} pendentes`}
        />
        <div
          className="bg-rose-400 transition-all duration-500"
          style={{ width: `${resumo.totalItens > 0 ? (resumo.naoNaEstrutura / resumo.totalItens) * 100 : 0}%` }}
          title={`${resumo.naoNaEstrutura} fora da estrutura`}
        />
      </div>

      {/* Lista Expandida de Itens */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-slate-50/60 border-t border-slate-100 p-4 space-y-2.5"
          >
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Itens na Locação ({resumo.itens.length})
              </span>
            </div>

            {resumo.itens.map((item, idx) => {
              const isMapeado = item.statusCategoria === 'mapeado';
              const isPendente = item.statusCategoria === 'pendente';
              const isNaoEstrutura = item.statusCategoria === 'nao_na_estrutura';

              return (
                <div
                  key={`${item.sku}-${idx}`}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isMapeado
                      ? 'bg-emerald-50/40 border-emerald-200/60'
                      : isPendente
                      ? 'bg-amber-50/40 border-amber-200/60'
                      : 'bg-rose-50/40 border-rose-200/60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono font-black text-slate-800 text-sm">{item.sku}</span>
                      {item.modelo && (
                        <span className="text-[10px] font-bold bg-white text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded">
                          {item.modelo}
                        </span>
                      )}
                      {item.chave && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded truncate max-w-[140px]">
                          KD: {item.chave}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{item.descricao}</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      Qtde Saldo: <strong className="text-slate-600">{item.qtde}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 justify-between sm:justify-end shrink-0">
                    {isMapeado && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 size={11} /> MAPEADO
                      </span>
                    )}

                    {isPendente && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
                        <Clock size={11} /> PENDENTE
                      </span>
                    )}

                    {isNaoEstrutura && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg">
                        <AlertCircle size={11} /> FORA DA ESTRUTURA
                      </span>
                    )}

                    {!isMapeado && (
                      <button
                        onClick={() => onMapear(item.sku)}
                        className="flex items-center gap-1 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 active:scale-95 px-3 py-1.5 rounded-xl transition-all shadow-sm shadow-blue-200"
                      >
                        <Play size={11} className="fill-current" /> MAPEAR
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Vista da Aba Resumo por Locação ──────────────────────────────────
function ResumoLocacoesView({ onStartTimer }: CheckKDProps) {
  const [locacoes, setLocacoes] = useState<LocacaoResumo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendentes' | 'fora' | 'mapeados'>('todos');
  const [expandedLocs, setExpandedLocs] = useState<Set<string>>(new Set());

  const carregarLocacoes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dados = await getResumoLocacoes();
      setLocacoes(ordenarLocacoes(dados));
    } catch (err: any) {
      console.error("Erro ao carregar locações:", err);
      setError("Erro ao carregar resumo de locações: " + (err.message || 'Falha na conexão'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarLocacoes();
  }, [carregarLocacoes]);

  const toggleExpand = (loc: string) => {
    setExpandedLocs(prev => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc);
      else next.add(loc);
      return next;
    });
  };

  // Filtragem local
  const locacoesFiltradas = (locacoes || []).filter(l => {
    const matchesSearch = l.locacao.toLowerCase().includes(searchTerm.toLowerCase().trim());
    if (!matchesSearch) return false;

    if (statusFilter === 'pendentes') return l.pendentes > 0;
    if (statusFilter === 'fora') return l.naoNaEstrutura > 0;
    if (statusFilter === 'mapeados') return l.mapeados === l.totalItens && l.totalItens > 0;

    return true;
  });

  // Totais Globais
  const totalLocacoesCount = locacoes?.length || 0;
  const totalItensCount = locacoes?.reduce((acc, l) => acc + l.totalItens, 0) || 0;
  const totalMapeadosCount = locacoes?.reduce((acc, l) => acc + l.mapeados, 0) || 0;
  const totalPendentesCount = locacoes?.reduce((acc, l) => acc + l.pendentes, 0) || 0;
  const totalNaoEstruturaCount = locacoes?.reduce((acc, l) => acc + l.naoNaEstrutura, 0) || 0;

  return (
    <div className="space-y-6">

      {/* ── KPIs Totais ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={16} className="text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Locações</span>
          </div>
          <span className="text-2xl font-black text-slate-800 font-mono">{totalLocacoesCount}</span>
          <p className="text-[11px] text-slate-400 mt-0.5">{totalItensCount} itens totais</p>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Mapeados</span>
          </div>
          <span className="text-2xl font-black text-emerald-700 font-mono">{totalMapeadosCount}</span>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">Na estrutura T&P</p>
        </div>

        <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-amber-500" />
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Pendentes</span>
          </div>
          <span className="text-2xl font-black text-amber-700 font-mono">{totalPendentesCount}</span>
          <p className="text-[11px] text-amber-600/80 mt-0.5">Aguardando medição</p>
        </div>

        <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={16} className="text-rose-500" />
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Fora Estrutura</span>
          </div>
          <span className="text-2xl font-black text-rose-700 font-mono">{totalNaoEstruturaCount}</span>
          <p className="text-[11px] text-rose-600/80 mt-0.5">Sem cadastro T&P</p>
        </div>
      </div>

      {/* ── Barra de Busca e Filtros de Locação ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Campo de Filtro por Locação */}
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filtrar por locação (ex: FARA1000, FARA1102)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono text-slate-700 outline-none focus:ring-2 focus:border-transparent transition-all"
              style={{ '--tw-ring-color': '#0066b2' } as any}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            onClick={carregarLocacoes}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3.5 py-2.5 rounded-xl transition-all shrink-0"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Botões de Filtro Rápido */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1 shrink-0">Status:</span>
          
          <button
            onClick={() => setStatusFilter('todos')}
            className={`px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 ${
              statusFilter === 'todos'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas ({totalLocacoesCount})
          </button>

          <button
            onClick={() => setStatusFilter('pendentes')}
            className={`px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 ${
              statusFilter === 'pendentes'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Com Pendências
          </button>

          <button
            onClick={() => setStatusFilter('fora')}
            className={`px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 ${
              statusFilter === 'fora'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Com Fora da Estrutura
          </button>

          <button
            onClick={() => setStatusFilter('mapeados')}
            className={`px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 ${
              statusFilter === 'mapeados'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            100% Mapeadas
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="animate-spin text-blue-600" size={36} />
          <p className="text-sm text-slate-400 font-medium">Carregando resumo das locações...</p>
        </div>
      )}

      {/* ── Erro ── */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-bold text-red-700 text-sm">Falha ao carregar</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
            <button
              onClick={carregarLocacoes}
              className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1 hover:text-red-800 transition-colors"
            >
              <RefreshCw size={12} /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* ── Lista de Locações ── */}
      {!loading && !error && (
        <div className="space-y-3">
          {locacoesFiltradas.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
              <MapPin size={32} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">Nenhuma locação encontrada</p>
              <p className="text-xs text-slate-400 mt-0.5">Tente ajustar o termo de busca ou o filtro selecionado.</p>
            </div>
          ) : (
            locacoesFiltradas.map(l => (
              <LocacaoCard
                key={l.locacao}
                resumo={l}
                expanded={expandedLocs.has(l.locacao)}
                onToggleExpand={() => toggleExpand(l.locacao)}
                onMapear={onStartTimer}
              />
            ))
          )}
        </div>
      )}

    </div>
  );
}

// ── Componente principal CheckKD ──────────────────────────────────────
export default function CheckKD({ onStartTimer, mappingDirtyCounter = 0 }: CheckKDProps) {
  // Aba principal: 'kd' (Check por KD) ou 'locacao' (Resumo por Locação)
  const [mainTab, setMainTab] = useState<'kd' | 'locacao'>('kd');

  // Estados para a aba Check por KD
  const [mode, setMode] = useState<'camera' | 'qr' | 'manual'>('qr');
  const [inputValue, setInputValue] = useState(() => sessionStorage.getItem('LAST_CHECKED_KD_KEY') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemComStatus[] | null>(null);
  const [chaveAtual, setChaveAtual] = useState(() => sessionStorage.getItem('LAST_CHECKED_KD_KEY') || '');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraRestartKey, setCameraRestartKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [itemStatusFilter, setItemStatusFilter] = useState<'todos' | 'pendentes' | 'mapeados' | 'fora'>('todos');
  // QR Code: controles de lanterna (torch) e zoom digital para melhorar leitura
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const torchRef = useRef<boolean>(false);
  const zoomRef = useRef<number>(1);
  const kdPollingRef = useRef<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const isStoppingRef = useRef(false);
  const isStartingRef = useRef(false);
  const preflightFailedRef = useRef(false);
  const cameraSessionRef = useRef(0);
  const lastDecodedRef = useRef<string | null>(null);
  const facingModeRef = useRef<'environment' | 'user'>('environment');
  const buscarRef = useRef<(raw: string) => Promise<void>>(async () => {});

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
        setItens(null);
      } else {
        setItens(ordenarItens(resultado));
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      setError('Erro ao consultar o banco: ' + (err.message || 'Falha de conexão'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { buscarRef.current = buscar; }, [buscar]);

  /** Ativa câmera — permissão pedida aqui, no clique do usuário. */
  const ativarModoCamera = useCallback(async () => {
    setCameraError(null);
    preflightFailedRef.current = false;
    try {
      await preflightCameraPermission(facingModeRef.current);
      setMode('camera');
    } catch (err) {
      console.error('Permissão da câmera:', err);
      preflightFailedRef.current = true;
      setCameraError(mensagemErroCamera(err));
      setMode('camera');
    }
  }, []);

  // 1) Sincronização: quando MappingWorkspace salva algo (dirtyCounter++), atualiza CheckKD automaticamente
  useEffect(() => {
    if (mappingDirtyCounter === 0) return;
    if (chaveAtual) {
      // Silent refresh — não mostra loading spinner para não atrapalhar
      const chave = chaveAtual;
      (async () => {
        try {
          const resultado = await getItensByChave(chave);
          if (resultado.length > 0) {
            setItens(ordenarItens(resultado));
            setLastUpdated(new Date());
          }
        } catch {}
      })();
    }
  }, [mappingDirtyCounter, chaveAtual]);

  // 2) Polling leve a cada 20s — atualiza o KD atual em silêncio (evita precisar de F5)
  // Aumentado de 12s → 20s: reduz ~40% requisições; o dado do KD é estável
  useEffect(() => {
    if (kdPollingRef.current) { window.clearInterval(kdPollingRef.current); kdPollingRef.current = null; }

    kdPollingRef.current = window.setInterval(() => {
      if (mainTab === 'kd' && chaveAtual && itens != null) {
        const chave = chaveAtual;
        (async () => {
          try {
            const resultado = await getItensByChave(chave);
            if (resultado.length > 0) {
              setItens(ordenarItens(resultado));
              setLastUpdated(new Date());
            }
          } catch {}
        })();
      }
      if (mainTab === 'locacao') {
        // Também atualiza a aba de locações em silêncio periodicamente
      }
    }, 20000);

    return () => {
      if (kdPollingRef.current) { window.clearInterval(kdPollingRef.current); kdPollingRef.current = null; }
    };
  }, [mainTab, chaveAtual, itens != null]);

  // Helper: aplica resolução, lanterna (torch) e zoom na track de vídeo ativa
  const aplicarCameraConstraints = useCallback(async () => {
    try {
      const stream = mediaStreamRef.current;
      if (!stream) return;
      const tracks = stream.getVideoTracks();
      if (!tracks.length) return;
      const track = tracks[0];
      const caps = (track as any).getCapabilities ? (track as any).getCapabilities() : {};
      const apply: any = {};
      if (caps.width) {
        try { apply.width = { ideal: 1280 }; } catch {}
      }
      if (caps.height) {
        try { apply.height = { ideal: 720 }; } catch {}
      }
      if (caps.torch && torchRef.current !== undefined) {
        try { apply.advanced = [...(apply.advanced || []), { torch: torchRef.current }]; } catch {}
      }
      if (caps.zoom && zoomRef.current && zoomRef.current >= 1) {
        try { apply.advanced = [...(apply.advanced || []), { zoom: zoomRef.current }]; } catch {}
      }
      if (Object.keys(apply).length > 0) {
        try { await (track as any).applyConstraints(apply); } catch {}
      }
    } catch {}
  }, []);

  // Sincroniza refs com estados de torch/zoom e aplica
  useEffect(() => { torchRef.current = torchOn; aplicarCameraConstraints(); }, [torchOn]);
  useEffect(() => { zoomRef.current = zoomLevel; aplicarCameraConstraints(); }, [zoomLevel]);

  // Controlar câmera 100% NATIVA (getUserMedia) + decodificação QR pura via jsQR
  // NÃO há state machine, NÃO há lifecycle de scanner — sem erros de transição.
  useEffect(() => {
    let isMounted = true;
    const sessionId = ++cameraSessionRef.current;

    function cleanupScanLoop(): void {
      if (scanLoopRef.current !== null) {
        window.clearInterval(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    }

    function cleanupStream(): void {
      try {
        cleanupScanLoop();
        const stream = mediaStreamRef.current;
        if (stream) {
          stream.getTracks().forEach(t => {
            try {
              if (typeof (t as any).applyConstraints === 'function') {
                try { (t as any).applyConstraints({ advanced: [{ torch: false }] }); } catch {}
              }
              t.stop();
            } catch {}
          });
        }
      } finally {
        mediaStreamRef.current = null;
        if (videoRef.current) {
          try {
            videoRef.current.pause();
            videoRef.current.srcObject = null;
            try { videoRef.current.load(); } catch {}
          } catch {}
        }
      }
    }

    async function stopTudo(): Promise<void> {
      if (isStoppingRef.current) return;
      isStoppingRef.current = true;
      try {
        cleanupStream();
      } finally {
        isStoppingRef.current = false;
        if (isMounted) {
          setCameraActive(false);
          setTorchOn(false); torchRef.current = false;
          setZoomLevel(1); zoomRef.current = 1;
        }
      }
    }

    function tentarDecodificarFrame(): string | null {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) return null;
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (decoded && decoded.data && decoded.data.trim()) return decoded.data.trim();
        return null;
      } catch {
        return null;
      }
    }

    async function onChaveDetectada(chave: string): Promise<void> {
      if (!isMounted || sessionId !== cameraSessionRef.current) return;
      if (lastDecodedRef.current === chave) return;
      lastDecodedRef.current = chave;

      try { if (navigator.vibrate) navigator.vibrate(40); } catch {}
      await stopTudo();
      if (!isMounted) return;

      setInputValue(chave);
      setMode('qr');
      buscarRef.current(chave);
      setTimeout(() => { lastDecodedRef.current = null; }, 2500);
    }

    if (mainTab === 'kd' && mode === 'camera') {
      const start = async () => {
        if (isStartingRef.current) return;
        if (preflightFailedRef.current) {
          preflightFailedRef.current = false;
          return;
        }
        isStartingRef.current = true;
        try {
          await stopTudo();
          if (!isMounted || sessionId !== cameraSessionRef.current) return;

          // Prepara canvas (invisível) para decodificação via jsQR
          try {
            const container = document.getElementById("qr-reader");
            if (container && !container.querySelector('canvas.tp-decode-canvas')) {
              const cvs = document.createElement('canvas');
              cvs.className = 'tp-decode-canvas';
              cvs.style.width = '0';
              cvs.style.height = '0';
              cvs.style.position = 'absolute';
              cvs.style.top = '0';
              cvs.style.left = '0';
              cvs.style.opacity = '0';
              cvs.style.pointerEvents = 'none';
              container.appendChild(cvs);
            }
            const decoderEl = document.querySelector<HTMLCanvasElement>('#qr-reader .tp-decode-canvas');
            if (decoderEl) canvasRef.current = decoderEl;
          } catch {}

          const facing = facingModeRef.current;
          const constraints: MediaStreamConstraints = {
            audio: false,
            video: {
              facingMode: facing,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          };

          let stream: MediaStream | null = null;
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
          } catch (err1) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing } });
            } catch (err2) {
              if (isMounted && sessionId === cameraSessionRef.current) {
                setCameraError(mensagemErroCamera(err2));
                setCameraActive(false);
              }
              return;
            }
          }

          if (!isMounted || sessionId !== cameraSessionRef.current) {
            try { stream.getTracks().forEach(t => t.stop()); } catch {}
            return;
          }
          mediaStreamRef.current = stream;

          // Garante que o vídeo existe no DOM (criamos nós mesmos)
          const containerEl = document.getElementById("qr-reader");
          let videoEl = videoRef.current;
          if (containerEl) {
            let v = containerEl.querySelector<HTMLVideoElement>('video.tp-native-video');
            if (!v) {
              v = document.createElement('video');
              v.className = 'tp-native-video';
              v.setAttribute('playsinline', 'true');
              v.setAttribute('autoplay', 'true');
              v.setAttribute('muted', 'true');
              v.setAttribute('playsInline', 'true');
              v.style.width = '100%';
              v.style.height = '100%';
              v.style.objectFit = 'cover';
              v.style.display = 'block';
              containerEl.prepend(v);
            }
            videoEl = v;
            videoRef.current = v;
          }

          if (videoEl && stream) {
            try {
              videoEl.srcObject = stream;
              await videoEl.play();
            } catch (playErr) {
              if (isMounted && sessionId === cameraSessionRef.current) {
                setCameraError(mensagemErroCamera(playErr));
              }
              return;
            }
          }

          if (!isMounted || sessionId !== cameraSessionRef.current) return;
          setCameraActive(true);
          setCameraError(null);
          aplicarCameraConstraints();

          // Loop de decodificação: a cada 50ms (20fps) — decodifica QR nativamente
          cleanupScanLoop();
          let quadro = 0;
          scanLoopRef.current = window.setInterval(() => {
            if (!isMounted || sessionId !== cameraSessionRef.current) return;
            quadro++;
            // Alterna alguns frames sem ocupar a thread principal
            if (quadro % 2 === 0) return;
            const chave = tentarDecodificarFrame();
            if (chave) {
              void onChaveDetectada(chave);
            }
          }, 50);

        } catch (err: any) {
          if (isMounted && sessionId === cameraSessionRef.current) {
            console.error("Erro na câmera:", err);
            setCameraError(mensagemErroCamera(err));
            setCameraActive(false);
          }
        } finally {
          isStartingRef.current = false;
        }
      };

      void start();

      return () => {
        isMounted = false;
        cameraSessionRef.current++;
        void stopTudo();
      };
    }

    setCameraActive(false);
    void stopTudo();
    return () => {
      isMounted = false;
      cameraSessionRef.current++;
    };
  }, [mainTab, mode, cameraRestartKey, aplicarCameraConstraints]);

  // Auto-foco e auto-recarregamento ao voltar para a aba
  useEffect(() => {
    if (mainTab === 'kd') {
      const saved = sessionStorage.getItem('LAST_CHECKED_KD_KEY');
      if (saved) {
        buscar(saved);
      }
    }
  }, [mainTab, buscar]);

  useEffect(() => {
    if (mainTab === 'kd' && (mode === 'qr' || mode === 'manual')) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mainTab, mode]);

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

  const statusItem = (i: ItemComStatus): 'mapeado' | 'pendente' | 'fora' => {
    if (i.tp?.status === 'mapeado') return 'mapeado';
    if (!i.tp) return 'fora';
    return 'pendente';
  };

  const itensFiltrados = React.useMemo(() => {
    if (!itens) return [];
    const term = itemSearch.trim().toLowerCase();
    return itens.filter(i => {
      if (itemStatusFilter === 'pendentes' && statusItem(i) !== 'pendente') return false;
      if (itemStatusFilter === 'mapeados' && statusItem(i) !== 'mapeado') return false;
      if (itemStatusFilter === 'fora' && statusItem(i) !== 'fora') return false;
      if (term) {
        const hay = `${i.sku} ${i.descricao} ${i.locacao || ''} ${i.modelo || ''} ${i.mod_comp || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [itens, itemSearch, itemStatusFilter]);

  const countFiltMapeados = itensFiltrados.filter(i => statusItem(i) === 'mapeado').length;
  const countFiltPendentes = itensFiltrados.filter(i => statusItem(i) === 'pendente').length;
  const countFiltFora = itensFiltrados.filter(i => statusItem(i) === 'fora').length;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">

      {/* ── Navegação por Abas do Check KD ── */}
      <div className="flex bg-slate-200/80 p-1.5 rounded-2xl gap-1 shadow-inner">
        <button
          onClick={() => setMainTab('kd')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${
            mainTab === 'kd'
              ? 'bg-white text-slate-800 shadow-md scale-[1.01]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <QrCode size={16} style={{ color: mainTab === 'kd' ? '#0066b2' : undefined }} />
          <span>Check por KD</span>
        </button>

        <button
          onClick={() => setMainTab('locacao')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all ${
            mainTab === 'locacao'
              ? 'bg-white text-slate-800 shadow-md scale-[1.01]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin size={16} style={{ color: mainTab === 'locacao' ? '#0066b2' : undefined }} />
          <span>Resumo por Locação</span>
        </button>
      </div>

      {/* ── Conteúdo da Aba Resumo por Locação ── */}
      {mainTab === 'locacao' && (
        <ResumoLocacoesView onStartTimer={onStartTimer} />
      )}

      {/* ── Conteúdo da Aba Check por KD ── */}
      {mainTab === 'kd' && (
        <>
          {/* Header da busca KD */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,102,178,0.1)' }}>
                <QrCode size={22} style={{ color: '#0066b2' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Check de KD</h2>
                <p className="text-xs text-slate-400 truncate">
                  Escaneie o QR Code da caixa ou digite a chave
                  {lastUpdated && (
                    <span className="ml-2 text-[10px] text-slate-400 font-mono">
                      · Última atualização: {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => chaveAtual ? buscar(chaveAtual) : null}
                disabled={!chaveAtual || loading}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 px-3 py-2 rounded-xl transition-all shrink-0"
                title={chaveAtual ? 'Atualizar dados do KD atual' : 'Nenhum KD consultado ainda'}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </div>

            {/* Toggle 3 Modos: Câmera | Leitor USB | Digitar */}
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1 mb-4 overflow-x-auto">
              <button
                onClick={() => {
                  if (mode === 'camera') {
                    if (cameraError || !cameraActive) {
                      setMode('qr');
                      setTimeout(() => {
                        setCameraRestartKey(k => k + 1);
                        void ativarModoCamera();
                      }, 50);
                    }
                  } else {
                    void ativarModoCamera();
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  mode === 'camera' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera size={14} /> Câmera ao Vivo
              </button>
              <button
                onClick={() => setMode('qr')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  mode === 'qr' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ScanLine size={14} /> Leitor Bip / USB
              </button>
              <button
                onClick={() => setMode('manual')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  mode === 'manual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Keyboard size={14} /> Digitar Chave
              </button>
            </div>

            {/* Câmera Scanner interativo (sempre no DOM — exibição via CSS) */}
            <div className={`mb-4 space-y-2 ${mode === 'camera' ? 'block' : 'hidden'}`}>
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
                <div id="qr-reader" className="w-full h-full border-none [&_video]:object-cover" />
                {/* Overlay Scanner de 4 Cantos + Linha de Scan animada */}
                {cameraActive && !cameraError && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative w-4/5 max-w-[340px] aspect-square">
                      {/* Linha central animada de scan */}
                      <motion.div
                        animate={{ y: ['0%', '100%', '0%'] }}
                        transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
                        className="absolute left-0 right-0 h-[2px] bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
                      />
                      {/* Cantos */}
                      <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
                      <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
                      <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
                      <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />
                    </div>
                  </div>
                )}
                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-950/80 gap-2">
                    <Loader2 className="animate-spin text-blue-500" size={28} />
                    <span className="text-xs font-medium">Iniciando câmera...</span>
                  </div>
                )}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 bg-slate-950/90 p-4 text-center gap-2">
                    <AlertCircle size={28} />
                    <span className="text-xs font-bold max-w-sm">{cameraError}</span>
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      <button
                        onClick={() => {
                          setMode('qr');
                          setTimeout(() => {
                            setCameraRestartKey(k => k + 1);
                            void ativarModoCamera();
                          }, 50);
                        }}
                        className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-500 font-bold"
                      >
                        Tentar novamente
                      </button>
                      <button
                        onClick={() => setMode('qr')}
                        className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700"
                      >
                        Usar Leitor USB / Digitação
                      </button>
                    </div>
                  </div>
                )}
                {/* Botões auxiliares da câmera: lanterna + zoom + inverter */}
                {cameraActive && !cameraError && (
                  <>
                    {/* LANTERNA (torch) */}
                    <button
                      onClick={() => setTorchOn(t => !t)}
                      className={`absolute top-3 left-3 p-2 rounded-full border backdrop-blur active:scale-95 transition-all ${
                        torchOn
                          ? 'bg-amber-400/90 border-amber-300 text-slate-900 shadow-[0_0_16px_rgba(251,191,36,0.55)]'
                          : 'bg-slate-900/70 border-slate-700/60 text-white hover:bg-slate-800'
                      }`}
                      title={torchOn ? 'Desligar lanterna' : 'Ligar lanterna'}
                    >
                      <Lightbulb size={18} />
                    </button>

                    {/* ZOOM - */}
                    <button
                      onClick={() => setZoomLevel(z => Math.max(1, +(z - 0.5).toFixed(1)))}
                      disabled={zoomLevel <= 1}
                      className="absolute top-3 left-[52px] p-2 rounded-full bg-slate-900/70 border border-slate-700/60 text-white backdrop-blur hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-30"
                      title="Diminuir zoom"
                    >
                      <Minus size={18} />
                    </button>

                    {/* ZOOM + */}
                    <button
                      onClick={() => setZoomLevel(z => Math.min(5, +(z + 0.5).toFixed(1)))}
                      disabled={zoomLevel >= 5}
                      className="absolute top-3 left-[88px] p-2 rounded-full bg-slate-900/70 border border-slate-700/60 text-white backdrop-blur hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-30"
                      title="Aumentar zoom (melhora leitura de QR pequeno)"
                    >
                      <Plus size={18} />
                    </button>

                    {/* Badge de zoom atual */}
                    {zoomLevel > 1 && (
                      <div className="absolute top-3 left-[124px] px-2 py-[7px] rounded-full bg-slate-900/70 border border-slate-700/60 text-white text-[11px] font-black backdrop-blur flex items-center gap-1">
                        <ZoomIn size={12} /> {zoomLevel.toFixed(1)}x
                      </div>
                    )}

                    {/* INVERTER CÂMERA */}
                    <button
                      onClick={() => {
                        facingModeRef.current = facingModeRef.current === 'environment' ? 'user' : 'environment';
                        setCameraRestartKey(k => k + 1);
                      }}
                      className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/70 border border-slate-700/60 text-white backdrop-blur hover:bg-slate-800 active:scale-95 transition-all"
                      title="Inverter câmera (frente/traseira)"
                    >
                      <SwitchCamera size={18} />
                    </button>
                  </>
                )}
              </div>
              <div className="space-y-1 text-center">
                <p className="text-[11px] text-slate-400 font-medium">
                  📷 Encaixe o QR Code no quadrado verde — leitura automática
                </p>
                <p className="text-[10px] text-slate-500 font-semibold">
                  💡 Dicas: use LANTERNA em ambientes escuros · use ZOOM para QR Codes pequenos/distantes
                </p>
              </div>
            </div>

            {/* Campo de entrada (funciona para scanner e digitação) */}
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
                {mode === 'camera' ? <Camera size={18} /> : mode === 'qr' ? <ScanLine size={18} /> : <Search size={18} />}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === 'camera'
                    ? 'Chave lida pela câmera aparecerá aqui...'
                    : mode === 'qr'
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
        </>
      )}
    </div>
  );
}
