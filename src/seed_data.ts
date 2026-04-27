import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as fs from 'fs';
import path from 'path';

const configPath = path.resolve('./firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function cleanAndSeed() {
  console.log('Restaurando integridade dos dados...');
  const colls = ['processes', 'master_mapping'];
  for (const cName of colls) {
    const snap = await getDocs(collection(db, cName));
    for (const d of snap.docs) {
      if (cName === 'processes') {
        const stepsSnap = await getDocs(collection(db, `processes/${d.id}/steps`));
        for (const sd of stepsSnap.docs) {
          const subsSnap = await getDocs(collection(db, `processes/${d.id}/steps/${sd.id}/substeps`));
          for (const ssd of subsSnap.docs) await deleteDoc(ssd.ref);
          await deleteDoc(sd.ref);
        }
      }
      await deleteDoc(d.ref);
    }
  }

  const rows = JSON.parse(fs.readFileSync(path.resolve('./mapping_raw.json'), 'utf8'));
  
  let currentProcessId: string | null = null;
  let currentStepId: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawId = String(row[4] || '').trim();
    if (!rawId || rawId === 'ID' || rawId === 'None' || rawId === 'null') continue;

    const idParts = rawId.split(' ');
    const idStr = idParts[0];
    const dots = (idStr.match(/\./g) || []).length;
    const atividade = String(row[5] || '').trim();
    
    // CORREÇÃO DO NOME: Se a atividade não estiver no ID, junta os dois.
    let fullName = rawId;
    if (atividade && atividade !== 'None' && atividade !== 'null' && !rawId.includes(atividade)) {
      fullName = `${rawId} - ${atividade}`;
    }

    const m1 = { t: Number(row[6]) || 0, u: String(row[7] || '').trim(), q: Number(row[8]) || 0, ik: Number(row[9]) || 0 };
    const m2 = { t: Number(row[10]) || 0, u: String(row[11] || '').trim(), q: Number(row[12]) || 0, ik: Number(row[13]) || 0 };
    const m3 = { t: Number(row[14]) || 0, u: String(row[15] || '').trim(), q: Number(row[16]) || 0, ik: Number(row[17]) || 0 };
    const m4 = { t: Number(row[18]) || 0, u: String(row[19] || '').trim(), q: Number(row[20]) || 0, ik: Number(row[21]) || 0 };
    const m5 = { t: Number(row[22]) || 0, u: String(row[23] || '').trim(), q: Number(row[24]) || 0, ik: Number(row[25]) || 0 };
    const media = Number(row[26]) || Number(row[25]) || 0;

    const baseData = {
      excelId: rawId,
      name: fullName,
      level: dots + 1,
      order: i,
      origem: String(row[1] || 'Importado').trim(),
      sector: String(row[2] || '').trim(),
      function: String(row[3] || '').trim(),
      m1, m2, m3, m4, m5,
      referenceTime: media
    };

    const masterRef = doc(collection(db, 'master_mapping'));
    await setDoc(masterRef, { ...baseData, id: masterRef.id });

    if (dots === 0) {
      const procRef = doc(collection(db, 'processes'));
      currentProcessId = procRef.id;
      currentStepId = null;
      await setDoc(procRef, { ...baseData, id: currentProcessId });
    } else if (dots === 1 && currentProcessId) {
      const stepRef = doc(collection(db, `processes/${currentProcessId}/steps`));
      currentStepId = stepRef.id;
      await setDoc(stepRef, { ...baseData, id: currentStepId, processId: currentProcessId });
    } else if (dots >= 2 && currentProcessId && currentStepId) {
      const subRef = doc(collection(db, `processes/${currentProcessId}/steps/${currentStepId}/substeps`));
      await setDoc(subRef, { ...baseData, id: subRef.id, processId: currentProcessId, stepId: currentStepId });
    }
  }

  console.log(`\nINTEGRIDADE RESTAURADA!`);
  process.exit(0);
}

cleanAndSeed().catch(err => {
  console.error('Erro Fatal:', err);
  process.exit(1);
});
