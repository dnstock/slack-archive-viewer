// Keep this database name and store stable so existing imports survive refactors.
export async function openArchiveDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("voltron-archive-v1", 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      const createStore = () =>
        db.createObjectStore("archives", {
          keyPath: ["workspace.id", "channel.id", "archive_id"],
        });
      if (!db.objectStoreNames.contains("archives")) {
        createStore();
        return;
      }
      // Upgrade the original archive-id-only key without losing saved snapshots.
      const read = request.transaction.objectStore("archives").getAll();
      read.onsuccess = () => {
        db.deleteObjectStore("archives");
        const store = createStore();
        read.result.forEach((archive) => store.put(archive));
      };
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}
export async function readArchives(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction("archives").objectStore("archives").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveArchives(db, archives) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("archives", "readwrite");
    const store = transaction.objectStore("archives");
    store.clear();
    archives.forEach((archive) => store.put(archive));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
