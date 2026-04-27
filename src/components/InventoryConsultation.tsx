import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Process } from '../types';
import { 
  Search, 
  Filter, 
  Package, 
  MapPin,
  User,
  Play,
  Loader2,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

interface InventoryConsultationProps {
  onStartProcess: (processId: string) => void;
}

export const InventoryConsultation: React.FC<InventoryConsultationProps> = ({ onStartProcess }) => {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOrigem, setFilterOrigem] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProcesses();
  }, [filterOrigem]);

  const fetchProcesses = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'processes'), orderBy('order', 'asc'));
      
      if (filterOrigem !== 'Todos') {
        q = query(q, where('origin', '==', filterOrigem));
      }

      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Process));
      setProcesses(data);
    } catch (err) {
      console.error('Erro ao buscar processos:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProcesses = processes.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sector.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header com Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar atividade ou setor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="text-slate-400 mr-1" size={18} />
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {['Todos', 'Importado', 'Nacional'].map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterOrigem(opt)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterOrigem === opt 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de Processos Macros */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-white rounded-2xl border border-slate-100 animate-pulse" />
          ))
        ) : filteredProcesses.length > 0 ? (
          filteredProcesses.map((p) => (
            <motion.div
              layout
              key={p.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-400 hover:shadow-xl transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                  p.origin === 'Importado' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {p.origin}
                </span>
              </div>

              <h3 className="text-slate-900 text-lg font-bold leading-tight mb-4 group-hover:text-blue-600 transition-colors">
                {p.name}
              </h3>

              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <MapPin size={14} className="text-slate-400" />
                  <span>{p.sector}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <User size={14} className="text-slate-400" />
                  <span>{p.function}</span>
                </div>
              </div>

              <button 
                onClick={() => onStartProcess(p.id)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl hover:bg-blue-600 transition-all text-xs font-bold shadow-lg"
              >
                <Play size={14} className="fill-current" />
                Iniciar Cronometragem
              </button>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <Package className="mx-auto text-slate-200 mb-4" size={64} />
            <h3 className="text-slate-900 font-bold">Nenhum processo cadastrado</h3>
            <p className="text-sm text-slate-500">A base de dados parece estar vazia para este filtro.</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3 text-blue-800 text-xs">
        <Info size={18} className="flex-shrink-0" />
        <p>Hierarquia Consolidada: Agora os itens estão agrupados por Processos Macros conforme o padrão da sua engenharia. Clique em Iniciar para medir todos os passos de uma vez.</p>
      </div>
    </div>
  );
};
