
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import * as fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testSeed() {
    console.log('Testing connection...');
    const docRef = await addDoc(collection(db, 'processes'), {
        name: 'TEST PROCESS',
        sector: 'TEST',
        origin: 'TEST',
        function: 'TEST',
        createdAt: serverTimestamp()
    });
    console.log('Added test process with ID:', docRef.id);
    process.exit(0);
}

testSeed().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
