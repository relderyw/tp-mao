import { 
  collection, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';

export type UserRole = 'administrador' | 'usuario';

export interface AppUser {
  id: string;
  username: string;
  password?: string; // Mantido apenas para validação, não deve ser retornado sempre por segurança
  displayName: string;
  cargo: string;
  role: UserRole;
  createdAt: string;
}

const USERS_COLLECTION = 'users';
const SESSION_KEY = 'tp_session';

// Admin padrão para garantir acesso inicial
const DEFAULT_ADMIN = {
  username: 'reldery_assuncao',
  password: 'rw_admin',
  displayName: 'Reldery Assunção',
  cargo: 'Engenheiro de Processos',
  role: 'administrador' as UserRole,
};

/** Inicializa o admin se a base estiver vazia */
async function ensureAdminExists() {
  const q = query(collection(db, USERS_COLLECTION), where('username', '==', DEFAULT_ADMIN.username));
  const snap = await getDocs(q);
  if (snap.empty) {
    const newDoc = doc(collection(db, USERS_COLLECTION));
    await setDoc(newDoc, {
      ...DEFAULT_ADMIN,
      id: newDoc.id,
      createdAt: new Date().toISOString()
    });
  }
}

/** Retorna todos os usuários (Real-time do banco) */
export async function getUsers(): Promise<AppUser[]> {
  const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
}

/** Valida credenciais direto no Firestore */
export async function validateLogin(username: string, password: string): Promise<AppUser | null> {
  // Primeiro garantimos que o admin existe (auto-recuperação)
  await ensureAdminExists();

  const q = query(
    collection(db, USERS_COLLECTION), 
    where('username', '==', username),
    where('password', '==', password)
  );
  
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as AppUser;
    return { ...userData, id: userDoc.id };
  }
  
  return null;
}

/** Cria novo usuário no Firestore */
export async function createUser(data: Omit<AppUser, 'id' | 'createdAt'>): Promise<string | null> {
  const q = query(collection(db, USERS_COLLECTION), where('username', '==', data.username));
  const snap = await getDocs(q);
  if (!snap.empty) return 'Nome de usuário já existe.';

  try {
    const newDoc = doc(collection(db, USERS_COLLECTION));
    await setDoc(newDoc, {
      ...data,
      id: newDoc.id,
      createdAt: new Date().toISOString()
    });
    return null;
  } catch (err: any) {
    return err.message;
  }
}

/** Atualiza usuário no Firestore */
export async function updateUser(updated: AppUser): Promise<string | null> {
  try {
    const userRef = doc(db, USERS_COLLECTION, updated.id);
    await updateDoc(userRef, { ...updated });
    return null;
  } catch (err: any) {
    return err.message;
  }
}

/** Deleta usuário no Firestore */
export async function deleteUser(id: string): Promise<string | null> {
  try {
    await deleteDoc(doc(db, USERS_COLLECTION, id));
    return null;
  } catch (err: any) {
    return err.message;
  }
}

// ── Session ──────────────────────────────────────────────────────────────────
export function getSession(): AppUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(user: AppUser): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
