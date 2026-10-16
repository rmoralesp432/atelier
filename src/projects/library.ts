import type { Message } from '../intelligence/client';
export type WorkspaceSnapshot = { session: string; messages: Message[] };
export type SavedProject = WorkspaceSnapshot & {
  id: string;
  name: string;
  updatedAt: number;
};
let database: Promise<IDBDatabase> | null = null;
function db() {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('atelier-projects', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('projects', { keyPath: 'id' });
      request.result.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = null;
      reject(
        new Error(
          'Project storage is unavailable. Export a backup before leaving.',
        ),
      );
    };
    request.onblocked = () => {
      database = null;
      reject(new Error('Close other ATELIER tabs to open project storage.'));
    };
  }));
}
export async function listProjects(): Promise<SavedProject[]> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction('projects').objectStore('projects').getAll();
    r.onsuccess = () =>
      resolve(
        r.result.sort(
          (a: SavedProject, b: SavedProject) => b.updatedAt - a.updatedAt,
        ),
      );
    r.onerror = () => reject(r.error);
  });
}
export async function activeProject(): Promise<SavedProject | null> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(['projects', 'meta']);
    const r = t.objectStore('meta').get('active');
    r.onsuccess = () => {
      if (!r.result) {
        resolve(null);
        return;
      }
      const p = t.objectStore('projects').get(r.result);
      p.onsuccess = () => resolve(p.result ?? null);
      p.onerror = () => reject(p.error);
    };
    r.onerror = () => reject(r.error);
  });
}
export async function saveProject(project: SavedProject, activate = false) {
  const d = await db();
  return new Promise<void>((resolve, reject) => {
    const t = d.transaction(['projects', 'meta'], 'readwrite');
    t.objectStore('projects').put(project);
    if (activate) t.objectStore('meta').put(project.id, 'active');
    t.oncomplete = () => resolve();
    t.onerror = t.onabort = () =>
      reject(
        new Error(
          'Could not save this project. Storage may be full. Export a backup; your current workspace has not been switched.',
        ),
      );
  });
}
