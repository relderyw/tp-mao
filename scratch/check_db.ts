import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import * as fs from 'fs';
import path from 'path';

const configPath = path.resolve('./firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);

async function checkData() {
  console.log('--- Verificando Coleção master_mapping ---');
  const snap = await getDocs(query(collection(db, 'master_mapping'), limit(5)));
  
  if (snap.empty) {
    console.log('ERRO: A coleção master_mapping está VAZIA!');
  } else {
    console.log(`Sucesso: Encontrados ${snap.size} documentos de teste.`);
    snap.forEach(d => {
      console.log('ID:', d.id);
      console.log('Dados:', JSON.stringify(d.data(), null, 2));
    });
  }
  process.exit(0);
}

checkData().catch(console.error);
