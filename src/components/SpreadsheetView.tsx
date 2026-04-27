import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Download, Loader2, Table, Zap, ChevronRight, FileSpreadsheet, Save, CheckCircle2 } from 'lucide-react';

export default function SpreadsheetView() {
  const [filterOrigem, setFilterOrigem] = useState<string>('Importado');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any[] | null>(null);

  useEffect(() => {
    loadFullData(filterOrigem);
  }, [filterOrigem]);

  async function loadFullData(origem: string) {
    setLoading(true);
    setData(null);
    try {
      let q = query(collection(db, 'master_mapping'));
      if (origem !== 'Todos') {
        q = query(q, where('origem', '==', origem));
      }
      
      const snap = await getDocs(q);
      const items = snap.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .sort((a, b) => a.order - b.order);

      const processed = processDataWithSums(items);
      setData(processed);
    } catch (error) {
      console.error('Error loading full data:', error);
    } finally {
      setLoading(false);
    }
  }

  const processDataWithSums = (items: any[]) => {
    const results = [...items];
    for (let i = 0; i < results.length; i++) {
      if (results[i].level === 2) {
        let sums = { t: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0 };
        let hasSubs = false;
        for (let j = i + 1; j < results.length; j++) {
          if (results[j].level <= 2) break;
          sums.t += (results[j].referenceTime || 0);
          sums.m1 += (results[j].m1?.t || 0);
          sums.m2 += (results[j].m2?.t || 0);
          sums.m3 += (results[j].m3?.t || 0);
          sums.m4 += (results[j].m4?.t || 0);
          sums.m5 += (results[j].m5?.t || 0);
          hasSubs = true;
        }
        if (hasSubs) {
          results[i] = { 
            ...results[i], 
            referenceTime: sums.t,
            m1: { ...results[i].m1, t: sums.m1 },
            m2: { ...results[i].m2, t: sums.m2 },
            m3: { ...results[i].m3, t: sums.m3 },
            m4: { ...results[i].m4, t: sums.m4 },
            m5: { ...results[i].m5, t: sums.m5 }
          };
        }
      }
    }
    for (let i = 0; i < results.length; i++) {
      if (results[i].level === 1) {
        let sums = { t: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0 };
        let hasChildren = false;
        for (let j = i + 1; j < results.length; j++) {
          if (results[j].level === 1) break;
          if (results[j].level === 2) {
            sums.t += (results[j].referenceTime || 0);
            sums.m1 += (results[j].m1?.t || 0);
            sums.m2 += (results[j].m2?.t || 0);
            sums.m3 += (results[j].m3?.t || 0);
            sums.m4 += (results[j].m4?.t || 0);
            sums.m5 += (results[j].m5?.t || 0);
            hasChildren = true;
          }
        }
        if (hasChildren) {
          results[i] = { 
            ...results[i], 
            referenceTime: sums.t,
            m1: { ...results[i].m1, t: sums.m1 },
            m2: { ...results[i].m2, t: sums.m2 },
            m3: { ...results[i].m3, t: sums.m3 },
            m4: { ...results[i].m4, t: sums.m4 },
            m5: { ...results[i].m5, t: sums.m5 }
          };
        }
      }
    }
    return results;
  };

  const handleUpdate = async (docId: string, field: string, value: any, measurement?: string) => {
    if (!data) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'master_mapping', docId);
      const currentItem = data.find(i => i.id === docId);
      let updateData: any = {};
      if (measurement) {
        updateData[measurement] = {
          ...currentItem[measurement],
          [field]: field === 't' || field === 'q' || field === 'ik' ? Number(value) : value
        };
      } else {
        updateData[field] = field === 'referenceTime' ? Number(value) : value;
      }
      await updateDoc(docRef, updateData);
      const newData = data.map(item => {
        if (item.id === docId) {
          if (measurement) return { ...item, [measurement]: updateData[measurement] };
          return { ...item, [field]: updateData[field] };
        }
        return item;
      });
      setData(processDataWithSums(newData));
    } catch (error) {
      console.error('Error updating:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderEditableCell = (item: any, measurement: string, field: string, className: string) => {
    const val = item[measurement]?.[field] ?? '';
    return (
      <td className={className}>
        <input
          type="text"
          defaultValue={val}
          onBlur={(e) => {
            if (String(e.target.value) !== String(val)) {
              handleUpdate(item.id, field, e.target.value, measurement);
            }
          }}
          className="w-full bg-transparent text-center outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-100 rounded px-1 text-[11px] font-medium text-slate-700 transition-all border-none hover:bg-slate-50"
        />
      </td>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Balanced Header */}
      <div className="bg-white px-8 py-4 flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Matriz de Tempos e Métodos
              {saving ? (
                <span className="text-[9px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Loader2 className="w-2 h-2 animate-spin" /> SALVANDO...
                </span>
              ) : (
                <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-black uppercase tracking-widest">
                  SINCRONIZADO
                </span>
              )}
            </h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.1em]">Engenharia Operacional • {filterOrigem}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
            {['Todos', 'Importado', 'Nacional'].map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterOrigem(opt)}
                className={`px-8 py-2 rounded-lg text-[11px] font-bold transition-all ${
                  filterOrigem === opt ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-slate-200">
            <Save className="w-3.5 h-3.5" /> Salvar Visual
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-[100]">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carregando Planilha...</span>
          </div>
        ) : data && data.length > 0 ? (
          <div className="h-[calc(100vh-140px)] overflow-auto scrollbar-thin scrollbar-thumb-slate-200">
            <table className="border-collapse w-full min-w-max border-separate border-spacing-0">
              <thead className="sticky top-0 z-50">
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 shadow-sm">
                  <th className="w-[450px] px-8 py-4 text-left text-[11px] font-bold uppercase tracking-wider sticky left-0 bg-slate-50 z-[60] border-r border-slate-200 border-b border-slate-200" rowSpan={2}>
                    Estrutura de Atividades
                  </th>
                  {['1º Tempo', '2º Tempo', '3º Tempo', '4º Tempo', '5º Tempo'].map((label, i) => (
                    <th key={i} className="px-2 py-2.5 border-r border-slate-200 text-[10px] font-bold uppercase tracking-widest bg-slate-50/50 border-b border-slate-200" colSpan={4}>
                      {label}
                    </th>
                  ))}
                  <th className="w-32 px-2 py-4 bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-widest border-b border-slate-200" rowSpan={2}>
                    Média
                  </th>
                </tr>
                <tr className="bg-white text-[9px] font-bold uppercase text-slate-400 border-b border-slate-200 shadow-sm">
                  {Array(5).fill(0).map((_, i) => (
                    <React.Fragment key={i}>
                      <th className="w-24 py-2.5 border-r border-slate-100">Tempo</th>
                      <th className="w-14 py-2.5 border-r border-slate-100 bg-slate-50/30">UM</th>
                      <th className="w-12 py-2.5 border-r border-slate-100">QT</th>
                      <th className="w-12 py-2.5 border-r border-slate-100 bg-slate-50/30">IK</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.map((item) => {
                  if (item.level === 1) {
                    return (
                      <tr key={item.id} className="bg-blue-50/70 text-blue-900 border-b border-blue-100 group">
                        <td className="px-8 py-4 text-[11px] font-bold uppercase text-left sticky left-0 bg-blue-50 z-40 border-l-4 border-l-blue-600 border-r border-blue-100">
                          <input
                            type="text"
                            defaultValue={item.name}
                            onBlur={(e) => handleUpdate(item.id, 'name', e.target.value)}
                            className="w-full bg-transparent outline-none font-bold"
                          />
                        </td>
                        {[item.m1, item.m2, item.m3, item.m4, item.m5].map((m, i) => (
                          <React.Fragment key={i}>
                            <td className="font-mono text-[11px] font-bold text-center border-r border-blue-100/50 py-3">{m?.t?.toFixed(1) || '0.0'}s</td>
                            <td className="bg-blue-100/20 border-r border-blue-100/50 opacity-30 text-[10px] text-center">-</td>
                            <td className="bg-blue-100/20 border-r border-blue-100/50 opacity-30 text-[10px] text-center">-</td>
                            <td className="bg-blue-100/20 border-r border-blue-100/50 opacity-30 text-[10px] text-center">-</td>
                          </React.Fragment>
                        ))}
                        <td className="bg-blue-600 text-white font-mono text-[11px] font-bold text-center">{item.referenceTime?.toFixed(2)}s</td>
                      </tr>
                    );
                  }

                  const isHeader = item.level === 2;
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/80 transition-all border-b border-slate-100 ${isHeader ? 'bg-slate-50/40' : ''}`}>
                      <td className={`px-8 py-3 text-[11px] text-left sticky left-0 bg-white z-40 border-r border-slate-100 ${isHeader ? 'text-blue-700 font-bold pl-12' : 'pl-16 text-slate-600'}`}>
                        <div className="flex items-center gap-2">
                          {isHeader && <ChevronRight className="w-3 h-3 text-blue-400" />}
                          <input
                            type="text"
                            defaultValue={item.name}
                            onBlur={(e) => handleUpdate(item.id, 'name', e.target.value)}
                            className="w-full bg-transparent outline-none truncate"
                          />
                        </div>
                      </td>
                      {renderEditableCell(item, 'm1', 't', 'border-r border-slate-100')}
                      {renderEditableCell(item, 'm1', 'u', 'border-r border-slate-100 bg-slate-50/40')}
                      {renderEditableCell(item, 'm1', 'q', 'border-r border-slate-100')}
                      {renderEditableCell(item, 'm1', 'ik', 'border-r border-slate-100 bg-slate-50/40')}
                      
                      {renderEditableCell(item, 'm2', 't', 'border-r border-slate-100')}
                      {renderEditableCell(item, 'm2', 'u', 'border-r border-slate-100 bg-slate-50/40')}
                      {renderEditableCell(item, 'm2', 'q', 'border-r border-slate-100')}
                      {renderEditableCell(item, 'm2', 'ik', 'border-r border-slate-100 bg-slate-50/40')}
                      
                      {renderEditableCell(item, 'm3', 't', 'border-r border-slate-100')}
                      {renderEditableCell(item, 'm3', 'u', 'border-r border-slate-100 bg-slate-50/40')}
                      {renderEditableCell(item, 'm3', 'q', 'border-r border-slate-100')}
                      {renderEditableCell(item, 'm3', 'ik', 'border-r border-slate-100 bg-slate-50/40')}
                      
                      {renderEditableCell(item, 'm4', 't', 'border-r border-slate-100')}
                      {renderEditableCell(item, 'm4', 'u', 'border-r border-slate-100 bg-slate-50/40')}
                      {renderEditableCell(item, 'm4', 'q', 'border-r border-slate-100')}
                      {renderEditableCell(item, 'm4', 'ik', 'border-r border-slate-100 bg-slate-50/40')}
                      
                      {renderEditableCell(item, 'm5', 't', 'border-r border-slate-100')}
                      {renderEditableCell(item, 'm5', 'u', 'border-r border-slate-100 bg-slate-50/40')}
                      {renderEditableCell(item, 'm5', 'q', 'border-r border-slate-100')}
                      {renderEditableCell(item, 'm5', 'ik', 'border-r border-slate-100 bg-slate-50/40')}

                      <td className={`px-1 py-3 font-mono text-[11px] font-bold text-center ${isHeader ? 'text-blue-600 bg-blue-50/50' : 'text-slate-900 bg-slate-50/20'}`}>
                        {item.referenceTime?.toFixed(2)}s
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
