import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { mappingService, MappingDoc, MappingTime } from '../lib/mappingService';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const AdminSync: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus(null);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          // Processar os dados ignorando as primeiras 3 linhas de cabeçalho
          // Linha 3 (index 2) é onde estão os nomes das colunas
          const rows = data.slice(3);
          const mappings: MappingDoc[] = [];

          rows.forEach((row) => {
            if (!row[1] || !row[5]) return; // Pular linhas vazias (Origem ou Atividade vazias)

            const tempos: MappingTime[] = [];
            // Colunas dos tempos: 1º(8), 2º(13), 3º(18), 4º(23), 5º(28)
            [8, 13, 18, 23, 28].forEach((idx) => {
              if (row[idx] !== undefined) {
                tempos.push({
                  valor: Number(row[idx]) || 0,
                  unidade: String(row[idx + 1] || ''),
                  qtd: Number(row[idx + 2]) || 0,
                  qtd1k: Number(row[idx + 3]) || 0
                });
              }
            });

            mappings.push({
              origem: String(row[1]),
              setor: String(row[2] || ''),
              funcao: String(row[3] || ''),
              atividade_id: String(row[4] || ''),
              atividade: String(row[5] || ''),
              observacao: String(row[6] || ''),
              tempos,
              media: Number(row[33]) || 0
            });
          });

          // Upload em blocos de 500 (limite do Firestore)
          for (let i = 0; i < mappings.length; i += 500) {
            const chunk = mappings.slice(i, i + 500);
            await mappingService.syncMappings(chunk);
          }

          setStatus({ type: 'success', message: `${mappings.length} registros sincronizados com sucesso!` });
        } catch (err: any) {
          setStatus({ type: 'error', message: 'Erro ao processar arquivo: ' + err.message });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      setStatus({ type: 'error', message: 'Erro ao ler arquivo: ' + err.message });
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
          <Upload size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Sincronização de Dados</h2>
          <p className="text-sm text-slate-500">Suba sua planilha Excel consolidada para o banco de dados</p>
        </div>
      </div>

      <div className="relative group">
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          disabled={loading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <div className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-all
          ${loading ? 'bg-slate-50 border-slate-200' : 'bg-slate-50 group-hover:bg-blue-50 border-slate-200 group-hover:border-blue-300'}
        `}>
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-blue-600" size={32} />
              <p className="text-slate-600 font-medium">Sincronizando com Firebase...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="text-slate-400 mb-2" size={32} />
              <p className="text-slate-700 font-semibold">Clique para selecionar ou arraste o arquivo</p>
              <p className="text-xs text-slate-500">Suporta .xlsx e .xls conforme padrão 103ki</p>
            </div>
          )}
        </div>
      </div>

      {status && (
        <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${
          status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
        }`}>
          {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}
    </div>
  );
};
