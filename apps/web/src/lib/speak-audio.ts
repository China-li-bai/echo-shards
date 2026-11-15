/**
 * Recordings for the self-intro page live in IndexedDB, not localStorage.
 * The script text uses echo-shards.speak.v1 and is cleared with other practice keys.
 */

export const SPEAK_AUDIO_DB = "echo-shards-speak";
const STORE = "takes";

export interface SpeakTake {
  scriptHash: string;
  chunkIndex: number;
  blob: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SPEAK_AUDIO_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("open speak audio failed"));
  });
}

export async function saveSpeakTake(take: SpeakTake): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(take, `${take.scriptHash}:${take.chunkIndex}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("save speak take failed"));
  });
  db.close();
}

export async function loadSpeakTakes(scriptHash: string): Promise<SpeakTake[]> {
  const db = await openDb();
  const rows = await new Promise<SpeakTake[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => {
      const all = Array.isArray(request.result) ? (request.result as SpeakTake[]) : [];
      resolve(all.filter((row) => row?.scriptHash === scriptHash && row.blob instanceof Blob));
    };
    request.onerror = () => reject(request.error ?? new Error("load speak takes failed"));
  });
  db.close();
  return rows;
}

export function deleteSpeakTakes(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve();
      return;
    }
    const request = indexedDB.deleteDatabase(SPEAK_AUDIO_DB);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
