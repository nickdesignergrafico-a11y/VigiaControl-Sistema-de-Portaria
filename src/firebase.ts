import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Keep the original firebase app and auth for authentication state / persistence
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Set persistence to local so the user stays logged in
setPersistence(auth, browserLocalPersistence).catch(() => {
  // Persistence may fail in iframe/sandboxed environments, fallback gracefully
});

// Mock Firestore client database reference
export const db = { isMock: true };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.warn('Firestore Warning: ', error, 'Operation: ', operationType, 'Path: ', path);
}

// Custom Mock Classes to emulate Firebase Firestore SDK classes
export class Timestamp {
  constructor(public seconds: number, public nanoseconds: number) {}
  toDate() {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1000000);
  }
  static now() {
    const d = new Date();
    return new Timestamp(Math.floor(d.getTime() / 1000), (d.getTime() % 1000) * 1000000);
  }
  static fromDate(date: Date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1000000);
  }
}

function deserializeTimestamps(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === 'object') {
    if (obj.__type === 'timestamp') {
      return new Timestamp(obj.seconds, obj.nanoseconds);
    }
    const result: any = Array.isArray(obj) ? [] : {};
    for (const key of Object.keys(obj)) {
      result[key] = deserializeTimestamps(obj[key]);
    }
    return result;
  }
  return obj;
}

export class MockDocRef {
  constructor(public path: string) {}
  get id() {
    return this.path.split('/').pop() || '';
  }
}

export class MockCollectionRef {
  constructor(public path: string) {}
}

export class MockQuery {
  public constraints: any[] = [];
  constructor(public collectionRef: MockCollectionRef) {}
  get path() {
    return this.collectionRef.path;
  }
}

export class MockDocSnapshot {
  private _data: any;
  constructor(public id: string, rawData: any, private _exists: boolean) {
    this._data = deserializeTimestamps(rawData);
  }
  exists() {
    return this._exists;
  }
  data() {
    return this._data;
  }
  get ref() {
    return new MockDocRef('');
  }
}

export class MockQuerySnapshot {
  public docs: MockDocSnapshot[] = [];
  constructor(docsData: { id: string, data: any }[] = []) {
    this.docs = (docsData || []).map(d => new MockDocSnapshot(d.id, d.data, true));
  }
  forEach(callback: (doc: MockDocSnapshot) => void) {
    this.docs.forEach(callback);
  }
  get empty() {
    return this.docs.length === 0;
  }
  get size() {
    return this.docs.length;
  }
}

// Export emulated Firestore functions
export function collection(dbInstance: any, path: string) {
  return new MockCollectionRef(path);
}

export function doc(parent: any, ...pathSegments: string[]) {
  let basePath = '';
  if (parent && typeof parent === 'object' && 'path' in parent) {
    basePath = parent.path;
  }
  const allSegments = [basePath, ...pathSegments].filter(Boolean);
  return new MockDocRef(allSegments.join('/'));
}

export function query(collectionRef: MockCollectionRef, ...constraints: any[]) {
  const q = new MockQuery(collectionRef);
  q.constraints = constraints.filter(Boolean);
  return q;
}

export function where(field: string, operator: string, value: any) {
  return { type: 'where', field, operator, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(n: number) {
  return { type: 'limit', value: n };
}

export async function getDocs(q: MockQuery | MockCollectionRef): Promise<MockQuerySnapshot> {
  const path = (q as any).path || (q as any).collectionRef?.path;
  const constraints = q instanceof MockQuery ? q.constraints : [];
  
  try {
    const res = await fetch('/api/firestore-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getDocs',
        path,
        constraints
      })
    });
    if (!res.ok) {
      return new MockQuerySnapshot([]);
    }
    const data = await res.json();
    return new MockQuerySnapshot(data.docs || []);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, path);
    return new MockQuerySnapshot([]);
  }
}

export async function getDoc(docRef: MockDocRef): Promise<MockDocSnapshot> {
  try {
    const res = await fetch('/api/firestore-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getDoc',
        path: docRef.path
      })
    });
    if (!res.ok) {
      return new MockDocSnapshot(docRef.id, null, false);
    }
    const data = await res.json();
    return new MockDocSnapshot(data.id || docRef.id, data.data, !!data.exists);
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, docRef.path);
    return new MockDocSnapshot(docRef.id, null, false);
  }
}

export async function addDoc(collectionRef: MockCollectionRef, data: any) {
  try {
    const res = await fetch('/api/firestore-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addDoc',
        path: collectionRef.path,
        data
      })
    });
    const resData = await res.json();
    return new MockDocRef(`${collectionRef.path}/${resData.id || Date.now().toString()}`);
  } catch (e) {
    handleFirestoreError(e, OperationType.CREATE, collectionRef.path);
    return new MockDocRef(`${collectionRef.path}/${Date.now().toString()}`);
  }
}

export async function updateDoc(docRef: MockDocRef, data: any) {
  try {
    const res = await fetch('/api/firestore-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateDoc',
        path: docRef.path,
        data
      })
    });
    return await res.json();
  } catch (e) {
    handleFirestoreError(e, OperationType.UPDATE, docRef.path);
    return { success: false };
  }
}

export async function setDoc(docRef: MockDocRef, data: any) {
  try {
    const res = await fetch('/api/firestore-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setDoc',
        path: docRef.path,
        data
      })
    });
    return await res.json();
  } catch (e) {
    handleFirestoreError(e, OperationType.WRITE, docRef.path);
    return { success: false };
  }
}

export async function deleteDoc(docRef: MockDocRef) {
  try {
    const res = await fetch('/api/firestore-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deleteDoc',
        path: docRef.path
      })
    });
    return await res.json();
  } catch (e) {
    handleFirestoreError(e, OperationType.DELETE, docRef.path);
    return { success: false };
  }
}

// Polling-based implementation of real-time snapshots
export function onSnapshot(
  target: MockQuery | MockCollectionRef | MockDocRef,
  next: (snapshot: any) => void,
  error?: (error: any) => void
) {
  let active = true;
  
  const poll = async () => {
    if (!active) return;
    try {
      if (target instanceof MockDocRef) {
        const snap = await getDoc(target);
        if (active && snap) next(snap);
      } else {
        const snap = await getDocs(target);
        if (active && snap) next(snap);
      }
    } catch (e) {
      if (active && error) {
        // quiet error call without unhandled crash
        error(e);
      }
    }
    
    // Poll every 3 seconds for updates
    if (active) {
      setTimeout(poll, 3000);
    }
  };
  
  // Start polling
  poll();
  
  // Return unsubscribe handler
  return () => {
    active = false;
  };
}

export const increment = (value: number) => ({ __type: 'increment', value });
export const serverTimestamp = () => ({ __type: 'serverTimestamp' });
