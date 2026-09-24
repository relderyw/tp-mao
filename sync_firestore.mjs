/**
 * ═══════════════════════════════════════════════════════════════════
 * SYNC FIRESTORE ➔ EXCEL BRIDGE (T&P MAO)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Executado pelas macros do Excel ou linha de comando:
 *   1. node sync_firestore.mjs upload-saldo [arquivo.xlsb]
 *   2. node sync_firestore.mjs upload-estrutura [arquivo.xlsb]
 *   3. node sync_firestore.mjs pull-dados [arquivo.xlsb]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import xlsx from 'xlsx';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Inicializa Firebase Admin ──────────────────────────────────────
const serviceAccountPath = resolve('./service-account.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch (err) {
  console.error('❌ service-account.json não encontrado na raiz do projeto!');
  process.exit(1);
}

const fbConfig = JSON.parse(readFileSync(resolve('./firebase-applet-config.json'), 'utf8'));
initializeApp({ credential: cert(serviceAccount), projectId: fbConfig.projectId });
const db = getFirestore();

// ── Utilitários ────────────────────────────────────────────────────
function cleanDoc(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v === null ? null : v;
  }
  return out;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function commitBatches(collectionName, items, batchSize = 100) {
  const batches = chunkArray(items, batchSize);
  let totalCommitted = 0;

  for (let i = 0; i < batches.length; i++) {
    const chunk = batches[i];
    let retries = 3;
    while (retries > 0) {
      try {
        const batch = db.batch();
        for (const item of chunk) {
          const ref = db.collection(collectionName).doc(String(item.id));
          batch.set(ref, cleanDoc(item.data), { merge: true });
        }
        await batch.commit();
        totalCommitted += chunk.length;
        const pct = ((totalCommitted / items.length) * 100).toFixed(1);
        console.log(`  ✔ [${collectionName}] Lote ${i + 1}/${batches.length}: ${totalCommitted}/${items.length} (${pct}%)`);
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        console.warn(`  ⚠️ Tentativa falhou, tentando novamente...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
}

// ── 1. UPLOAD DE SALDO (COMPRW3) ───────────────────────────────────
async function uploadSaldo(filePath) {
  console.log(`\n📦 [1/3] Lendo aba 'COMPRW3' do arquivo: ${filePath}...`);
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets['COMPRW3'];
  if (!sheet) throw new Error("Aba 'COMPRW3' não encontrada no arquivo!");

  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) throw new Error("Nenhum dado encontrado na aba 'COMPRW3'!");

  console.log(`  Linhas lidas: ${rows.length - 1}`);

  // Agrupa os itens por Chave de KD (1 documento por KD único)
  const kdMap = new Map();
  let totalItens = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const sku = String(r[0] || '').trim();
    if (!sku) continue;

    const desc = String(r[1] || '').trim();
    const rawChave = String(r[2] || '').trim();
    const chaveClean = rawChave.replace(/\s+/g, '');
    const chaveNorm = chaveClean.replace(/\//g, '_').toUpperCase() || 'SEM_CHAVE';

    const fatura = String(r[6] || '').trim();
    const locacao = String(r[8] || '').trim();
    const qtdeItem = Number(r[10]) || 0;
    const kdCaixa = String(r[11] || '').trim();
    const qtdeKd = Number(r[12]) || 0;
    const modelo = String(r[13] || '').trim();
    const modComp = String(r[14] || '').trim();

    const itemObj = {
      sku,
      descricao: desc,
      chave: chaveClean,
      fatura,
      kd: kdCaixa,
      qtde: qtdeItem,
      qtde_kd: qtdeKd,
      locacao,
      modelo,
      mod_comp: modComp
    };

    if (!kdMap.has(chaveNorm)) {
      kdMap.set(chaveNorm, {
        chave: chaveClean,
        chave_norm: chaveNorm,
        locacao,
        itens: []
      });
    }
    kdMap.get(chaveNorm).itens.push(itemObj);
    totalItens++;
  }

  console.log(`🔄 Total de itens válidos: ${totalItens}`);
  console.log(`🔄 KDs agrupados (documentos únicos): ${kdMap.size}`);

  console.log(`🔥 Gravando saldo no Firestore...`);
  const kdDocs = Array.from(kdMap.entries()).map(([keyNorm, data]) => ({
    id: keyNorm,
    data
  }));

  await commitBatches('saldo_estoque', kdDocs, 300);

  // Atualiza metadado de última sincronização
  await db.collection('_meta').doc('saldo').set({
    updatedAt: new Date().toISOString(),
    totalItens,
    totalKds: kdMap.size,
  }, { merge: true });

  console.log(`\n✅ SUCESSO: Saldo de estoque atualizado no Firestore!`);
  console.log(`   ${totalItens} itens distribuídos em ${kdMap.size} KDs.\n`);
}

// ── 2. UPLOAD DE ESTRUTURA (IT_IT) ─────────────────────────────────
// Faz merge sem sobrescrever dados de medição já salvos
async function uploadEstrutura(filePath) {
  console.log(`\n📦 [2/3] Lendo aba 'IT_IT' do arquivo: ${filePath}...`);
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets['IT_IT'];
  if (!sheet) throw new Error("Aba 'IT_IT' não encontrada no arquivo!");

  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 3) throw new Error("Nenhum dado encontrado na aba 'IT_IT'!");

  const skuDocs = [];
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const modelo = String(r[1] || '').trim();
    const sku = String(r[2] || '').trim();
    const desc = String(r[3] || '').trim();

    if (!sku) continue;

    const docId = sku.replace(/\//g, '_');
    skuDocs.push({
      id: docId,
      data: {
        sku,
        modelo,
        descricao: desc,
        // Status inicial apenas para novos SKUs (se já existe, merge: true mantém o atual)
        updated_at: new Date().toISOString()
      }
    });
  }

  console.log(`  Total de SKUs na estrutura: ${skuDocs.length}`);
  console.log(`🔥 Sincronizando estrutura com Firestore (preservando medições anteriores)...`);

  await commitBatches('sku_tp', skuDocs, 300);

  console.log(`\n✅ SUCESSO: Estrutura IT_IT sincronizada no Firestore!`);
  console.log(`   ${skuDocs.length} SKUs atualizados/inseridos sem perder medições.\n`);
}

// ── 3. PUXAR DADOS DO FIRESTORE (sku_tp) ───────────────────────────
async function pullDados(outputCsvPath) {
  console.log(`\n📦 [3/3] Buscando todos os dados de 'sku_tp' do Firestore...`);
  const snap = await db.collection('sku_tp').get();
  console.log(`  Documentos encontrados: ${snap.size}`);

  const colunas = [
    "id", "sku", "descricao", "modelo", "responsavel", "data_map", "status", "tempo_total",
    "pecas_kd", "tp_emb_forn", "pd_emb_forn", "tp_emb_dcc", "pd_emb_dcc", "carro",
    "pegar_ik_t1", "pegar_ik_t2", "pegar_ik_t3", "pegar_ik_t4", "pegar_ik_t5", "pegar_ik_qtd", "pegar_ik_res",
    "abrir_t1", "abrir_t2", "abrir_t3", "abrir_t4", "abrir_t5", "abrir_qtd", "abrir_res",
    "form_t1", "form_t2", "form_t3", "form_t4", "form_t5", "form_unid", "form_qtd", "form_res",
    "desc_t1", "desc_t2", "desc_t3", "desc_t4", "desc_t5", "desc_qtd", "desc_res",
    "etq_t1", "etq_t2", "etq_t3", "etq_t4", "etq_t5", "etq_qtd", "etq_res",
    "pos_t1", "pos_t2", "pos_t3", "pos_t4", "pos_t5", "pos_qtd", "pos_res",
    "created_at", "updated_at"
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [colunas.join(';')];

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const row = colunas.map(col => {
      let v = d[col];
      if (v && v.toDate) v = v.toDate().toISOString();
      return escapeCsv(v);
    });
    lines.push(row.join(';'));
  });

  const targetCsv = outputCsvPath || resolve('./DADOS_FIRESTORE.csv');
  // UTF-8 com BOM para Excel abrir acentos perfeitamente
  writeFileSync(targetCsv, '\uFEFF' + lines.join('\r\n'), 'utf8');

  console.log(`\n✅ SUCESSO: ${snap.size} registros exportados para:`);
  console.log(`   ${targetCsv}\n`);
}

// ── Entrada Principal ──────────────────────────────────────────────
async function main() {
  const comando = process.argv[2];
  const arquivoParam = process.argv[3] || resolve('./SALDO ESTOQUE v1.xlsb');

  if (comando === 'upload-saldo') {
    await uploadSaldo(arquivoParam);
  } else if (comando === 'upload-estrutura') {
    await uploadEstrutura(arquivoParam);
  } else if (comando === 'pull-dados') {
    await pullDados(process.argv[3]);
  } else {
    console.log(`Uso:`);
    console.log(`  node sync_firestore.mjs upload-saldo [arquivo]`);
    console.log(`  node sync_firestore.mjs upload-estrutura [arquivo]`);
    console.log(`  node sync_firestore.mjs pull-dados [saida.csv]`);
  }
}

main().catch(err => {
  console.error('\n❌ ERRO:', err.message || err);
  process.exit(1);
});
