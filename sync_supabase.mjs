/**
 * =============================================================
 * SYNC SUPABASE <-> EXCEL BRIDGE (T&P MAO)
 * =============================================================
 * Executado pelas macros do Excel ou linha de comando:
 *   1. node sync_supabase.mjs upload-saldo [arquivo.xlsb]
 *   2. node sync_supabase.mjs upload-estrutura [arquivo.xlsb]
 *   3. node sync_supabase.mjs pull-dados [saida.csv]
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xeeouapdltkdbejskkme.supabase.co';
const SUPABASE_KEY = 'sb_publishable_VQJ74nSdzd5_2pX5QMzcEw_lIti5-GU';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function upsertBatches(tableName, rows, batchSize = 1000) {
  const batches = chunkArray(rows, batchSize);
  let total = 0;
  for (let i = 0; i < batches.length; i++) {
    const { error } = await supabase.from(tableName).upsert(batches[i], { onConflict: 'id' });
    if (error) { console.error('Erro no lote:', error.message); process.exit(1); }
    total += batches[i].length;
    process.stdout.write(`\r  Enviado: ${total}/${rows.length} registros...`);
  }
  console.log('');
}

// 1. UPLOAD DO SALDO DE ESTOQUE
async function uploadSaldo(filePath) {
  console.log(`\n[1/3] Lendo aba COMPRW3 de: ${filePath}...`);
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets['COMPRW3'];
  if (!sheet) throw new Error("Aba 'COMPRW3' nao encontrada!");
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) throw new Error("Nenhum dado na aba 'COMPRW3'!");
  console.log(`  Linhas lidas: ${rows.length - 1}`);

  const kdMap = new Map();
  let totalItens = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const sku = String(r[0] || '').trim();
    if (!sku) continue;
    const desc = String(r[1] || '').trim();
    const rawChave = String(r[2] || '').trim();
    const chaveNorm = rawChave.replace(/\s+/g, '').replace(/\//g, '_').toUpperCase() || 'SEM_CHAVE';
    const fatura = String(r[6] || '').trim();
    const locacao = String(r[8] || '').trim();
    const qtdeItem = Number(r[10]) || 0;
    const kdCaixa = String(r[11] || '').trim();

    if (!kdMap.has(chaveNorm)) {
      kdMap.set(chaveNorm, { id: chaveNorm, chave_norm: chaveNorm, chave: rawChave, locacao, data: { chave: rawChave, chave_norm: chaveNorm, locacao, itens: [] } });
    }
    kdMap.get(chaveNorm).data.itens.push({ sku, descricao: desc, fatura, locacao, qtde: qtdeItem, kd_caixa: kdCaixa });
    totalItens++;
  }

  const kdDocs = Array.from(kdMap.values());
  console.log(`  KDs unicos: ${kdDocs.length} | Total itens: ${totalItens}`);
  console.log('  Sincronizando saldo com Supabase...');
  await upsertBatches('saldo_estoque', kdDocs, 500);
  console.log(`\nSUCESSO: ${kdDocs.length} KDs de saldo atualizados!\n`);
}

// 2. UPLOAD DA ESTRUTURA IT_IT
async function uploadEstrutura(filePath) {
  console.log(`\n[2/3] Lendo aba IT_IT de: ${filePath}...`);
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets['IT_IT'];
  if (!sheet) throw new Error("Aba 'IT_IT' nao encontrada!");
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 3) throw new Error("Nenhum dado na aba 'IT_IT'!");

  const skuDocs = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const modelo = String(r[1] || '').trim();
    const sku = String(r[2] || '').trim();
    const desc = String(r[3] || '').trim();
    if (!sku) continue;
    skuDocs.push({ id: sku.replace(/\//g, '_'), sku, modelo, descricao: desc, updated_at: new Date().toISOString() });
  }

  console.log(`  Total de SKUs: ${skuDocs.length}`);
  console.log('  Sincronizando com Supabase (medicoes preservadas)...');

  const batches = chunkArray(skuDocs, 1000);
  let total = 0;
  for (let i = 0; i < batches.length; i++) {
    const { error } = await supabase.from('sku_tp').upsert(batches[i], { onConflict: 'id', ignoreDuplicates: false });
    if (error) { console.error('Erro no lote:', error.message); process.exit(1); }
    total += batches[i].length;
    process.stdout.write(`\r  Enviado: ${total}/${skuDocs.length} SKUs...`);
  }
  console.log('');
  console.log(`\nSUCESSO: ${skuDocs.length} SKUs sincronizados sem perder medicoes!\n`);
}

// 3. PUXAR DADOS -> CSV
async function pullDados(outputCsvPath) {
  console.log(`\n[3/3] Buscando dados do Supabase...`);
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase.from('sku_tp').select('*').range(page * pageSize, (page + 1) * pageSize - 1).order('sku', { ascending: true });
    if (error) { console.error('Erro ao buscar:', error.message); process.exit(1); }
    allData = allData.concat(data);
    process.stdout.write(`\r  Baixados: ${allData.length} registros...`);
    if (data.length < pageSize) hasMore = false;
    else page++;
  }

  console.log(`\n  Total: ${allData.length} documentos`);

  const colunas = [
    "id", "sku", "descricao", "modelo", "responsavel", "data_map", "status", "tempo_total",
    "pecas_kd", "tp_emb_forn", "pd_emb_forn", "tp_emb_dcc", "pd_emb_dcc", "carro",
    "pegar_ik_t1", "pegar_ik_t2", "pegar_ik_t3", "pegar_ik_t4", "pegar_ik_t5", "pegar_ik_qtd", "pegar_ik_res",
    "abrir_t1", "abrir_t2", "abrir_t3", "abrir_t4", "abrir_t5", "abrir_qtd", "abrir_res",
    "form_t1", "form_t2", "form_t3", "form_t4", "form_t5", "form_unid", "form_qtd", "form_res",
    "desc_t1", "desc_t2", "desc_t3", "desc_t4", "desc_t5", "desc_qtd", "desc_res",
    "etq_t1", "etq_t2", "etq_t3", "etq_t4", "etq_t5", "etq_qtd", "etq_res",
    "pos_t1", "pos_t2", "pos_t3", "pos_t4", "pos_t5", "pos_qtd", "pos_res",
    "tp_map", "created_at", "updated_at"
  ];

  const esc = (val) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  const linhas = [colunas.join(',')];
  for (const doc of allData) linhas.push(colunas.map(col => esc(doc[col])).join(','));

  const csvPath = outputCsvPath || resolve('./DADOS_SUPABASE.csv');
  writeFileSync(csvPath, linhas.join('\r\n'), 'utf8');
  console.log(`  CSV salvo: ${csvPath}`);
  console.log(`\nSUCESSO: ${allData.length} SKUs exportados!\n`);
}

// MAIN
async function main() {
  const comando = process.argv[2];
  const arquivoParam = process.argv[3] || resolve('./SALDO ESTOQUE v1.xlsb');
  console.log('\n=========================================');
  console.log('   T&P MAO - SYNC SUPABASE');
  console.log('=========================================');
  if (comando === 'upload-saldo') await uploadSaldo(arquivoParam);
  else if (comando === 'upload-estrutura') await uploadEstrutura(arquivoParam);
  else if (comando === 'pull-dados') await pullDados(process.argv[3]);
  else {
    console.log('Uso:');
    console.log('  node sync_supabase.mjs upload-saldo [arquivo]');
    console.log('  node sync_supabase.mjs upload-estrutura [arquivo]');
    console.log('  node sync_supabase.mjs pull-dados [saida.csv]');
  }
}

main().catch(err => { console.error('\nERRO:', err.message || err); process.exit(1); });