// Keep this database name and store stable so existing imports survive refactors.
export async function openArchiveDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("voltron-archive-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("archives", { keyPath: "archive_id" });
    request.onsuccess = () => resolve(request.result);
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
