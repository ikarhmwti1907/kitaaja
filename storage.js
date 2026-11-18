(function () {
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open("ruang-kenangan", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("items", { keyPath: "id" });
      r.result.createObjectStore("blobs", { keyPath: "id" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  let dbp = null;
  const getDb = () => dbp || (dbp = open());
  const tx = async (store, mode, fn) => {
    const d = await getDb();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => res(r && r.result);
      t.onerror = t.onabort = () => rej(t.error);
    });
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const urls = {};
  const listeners = new Set();

  async function all() {
    const rows = await tx("items", "readonly", s => s.getAll());
    const out = [];
    for (const r of rows) {
      const o = { ...r };
      if (o.assetId) {
        if (!urls[o.assetId]) {
          const b = await tx("blobs", "readonly", s => s.get(o.assetId));
          if (b) urls[o.assetId] = URL.createObjectURL(b.blob);
        }
        o.url = urls[o.assetId] || "";
      }
      out.push(o);
    }
    return out;
  }
  async function notify() {
    const rows = await all();
    const snap = { docs: rows.map(r => ({ id: r.id, data: () => { const { id, ...x } = r; return x; } })) };
    listeners.forEach(f => f(snap));
  }

  const db = {
    collection: () => ({
      onSnapshot(next) { listeners.add(next); notify(); return () => listeners.delete(next); },
      async add(d) { const id = uid(); await tx("items", "readwrite", s => s.put({ ...d, id })); notify(); }
    }),
    doc: p => {
      const id = p.split("/")[1];
      return {
        async delete() { await tx("items", "readwrite", s => s.delete(id)); notify(); },
        async update(d) {
          const cur = await tx("items", "readonly", s => s.get(id));
          await tx("items", "readwrite", s => s.put({ ...cur, ...d, id }));
          notify();
        }
      };
    }
  };
  const assets = {
    async upload(file) {
      const id = uid();
      await tx("blobs", "readwrite", s => s.put({ id, blob: file }));
      urls[id] = URL.createObjectURL(file);
      return { id, url: urls[id] };
    },
    async delete(id) {
      await tx("blobs", "readwrite", s => s.delete(id));
      if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; }
    }
  };
  const user = { canEdit: () => true };
  window.claude = { use: async n => ({ db, assets, user }[n] || null) };
})();