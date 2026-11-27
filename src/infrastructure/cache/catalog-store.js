const STORE = 'snapshots';
const EPOCH = 'invalidation';
const validKey = (key) => key === 'stores' || key === 'online';

export class CatalogStore {
  constructor(factory, scope) {
    this.factory = factory;
    this.name = 'paykr-catalog:' + scope;
  }

  open() {
    if (this.connection) return this.connection;
    this.connection = new Promise((resolve, reject) => {
      const request = this.factory.open(this.name, 2);
      let blocked = false;
      request.onupgradeneeded = () => {
        const db = request.result;
        // This database only contains derived, disposable PayKR catalog records.
        for (const name of [...db.objectStoreNames]) db.deleteObjectStore(name);
        db.createObjectStore(STORE);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Catalog upgrade blocked'));
      };
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          this.connection = null;
        };
        resolve(db);
      };
    }).catch((error) => {
      this.connection = null;
      throw error;
    });
    return this.connection;
  }

  async transaction(mode, schedule) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = schedule(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result?.());
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Catalog transaction failed'));
    });
  }

  readSnapshot(key) {
    if (!validKey(key)) throw new Error('Unsupported cache region');
    return this.transaction('readonly', (store) => {
      const value = store.get(key);
      const epoch = store.get(EPOCH);
      return () => ({ record: value.result, epoch: epoch.result || 0 });
    });
  }

  async read(key) {
    return (await this.readSnapshot(key)).record;
  }

  write(key, record, expectedEpoch) {
    if (!validKey(key)) throw new Error('Unsupported cache region');
    return this.transaction('readwrite', (store) => {
      const epoch = store.get(EPOCH);
      epoch.onsuccess = () => {
        // A different tab can clear the catalog while the source fetch is pending.
        if ((epoch.result || 0) === expectedEpoch) store.put(record, key);
      };
    });
  }

  clear() {
    return this.transaction('readwrite', (store) => {
      const epoch = store.get(EPOCH);
      epoch.onsuccess = () => {
        store.clear();
        store.put((epoch.result || 0) + 1, EPOCH);
      };
    });
  }
}

export function invalidations(scope, receive) {
  const name = 'paykr-catalog-clear:' + scope;
  try {
    const bus = new BroadcastChannel(name);
    bus.onmessage = receive;
    return () => bus.postMessage('clear');
  } catch {
    /* Use storage events when BroadcastChannel is restricted. */
  }
  window.addEventListener('storage', (event) => {
    if (event.key === name) receive();
  });
  return () => {
    try {
      localStorage.setItem(name, String(Date.now()) + ':' + Math.random());
    } catch {
      /* With both mechanisms disabled only the current tab is notified. */
    }
  };
}
