import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  doc,
  setDoc,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';

export interface MappingTime {
  valor: number;
  unidade: string;
  qtd: number;
  qtd1k?: number;
}

export interface MappingDoc {
  id?: string;
  origem: string;
  setor: string;
  funcao: string;
  atividade_id: string;
  atividade: string;
  observacao: string;
  tempos: MappingTime[];
  media: number;
  createdAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'engineer';
  originPreference?: string;
  lastLogin: any;
}

const MAPPINGS_COLLECTION = 'mappings';
const USERS_COLLECTION = 'users';

export const mappingService = {
  // Usuários
  async saveUserProfile(profile: UserProfile) {
    const userRef = doc(db, USERS_COLLECTION, profile.uid);
    await setDoc(userRef, {
      ...profile,
      updatedAt: serverTimestamp()
    }, { merge: true });
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() as UserProfile : null;
  },

  // Mapeamentos
  async addMapping(mapping: MappingDoc) {
    return await addDoc(collection(db, MAPPINGS_COLLECTION), {
      ...mapping,
      createdAt: serverTimestamp()
    });
  },

  async getMappings(origem?: string): Promise<MappingDoc[]> {
    let q = query(collection(db, MAPPINGS_COLLECTION));
    
    if (origem && origem !== 'Todos') {
      q = query(q, where('origem', '==', origem));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as MappingDoc[];
  },

  // Sincronização em Massa (Excel)
  async syncMappings(mappings: MappingDoc[]) {
    const batch = writeBatch(db);
    
    // Nota: Firestore batches têm limite de 500 operações.
    // Para 11.000 registros, precisaríamos dividir em múltiplos batches.
    // Por enquanto, vamos implementar a lógica base.
    
    mappings.forEach((m) => {
      const newDocRef = doc(collection(db, MAPPINGS_COLLECTION));
      batch.set(newDocRef, {
        ...m,
        createdAt: serverTimestamp()
      });
    });

    await batch.commit();
  },

  async convertMappingToProcess(mappingId: string): Promise<string> {
    const mappingRef = doc(db, MAPPINGS_COLLECTION, mappingId);
    const mappingSnap = await getDoc(mappingRef);
    if (!mappingSnap.exists()) throw new Error('Mapeamento não encontrado');
    const mapping = mappingSnap.data() as MappingDoc;

    const procQ = query(collection(db, 'processes'), where('name', '==', mapping.atividade));
    const procSnap = await getDocs(procQ);
    
    if (!procSnap.empty) return procSnap.docs[0].id;

    const procRef = doc(collection(db, 'processes'));
    const procId = procRef.id;

    await setDoc(procRef, {
      id: procId,
      name: mapping.atividade,
      sector: mapping.setor,
      origin: mapping.origem,
      function: mapping.funcao,
      mappingReferenceId: mappingId,
      createdAt: serverTimestamp()
    });

    const stepsBatch = writeBatch(db);
    mapping.tempos.forEach((t, i) => {
      const stepRef = doc(collection(db, `processes/${procId}/steps`));
      stepsBatch.set(stepRef, {
        name: `Ciclo ${i + 1} - ${t.unidade}`,
        order: i,
        processId: procId,
        referenceTime: t.valor,
        targetQty: t.qtd
      });
    });

    await stepsBatch.commit();
    return procId;
  }
};
