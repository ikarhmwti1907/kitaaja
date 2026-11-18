const SUPABASE_URL = "https://qobqlwbethrbiucsview.supabase.co/rest/v1/";  
const SUPABASE_KEY = "sb_publishable_1fNgYpue9FiB_DFnGmY0_g_vFft6Ugo";      

(function () {
  const ok = /^https:\/\/[^/]+/.test(SUPABASE_URL) && !SUPABASE_KEY.startsWith("ISI_");
  const H = { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY };
  const REST = SUPABASE_URL + "/rest/v1/items";
  const STO = SUPABASE_URL + "/storage/v1/object";
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const listeners = new Set();
  let cache = {}, sig = "", timer = null;

  async function req(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(r.status + " " + (await r.text()));
    return r;
  }
  async function load() {
    const r = await req(REST + "?select=id,data&order=created.asc", { headers: H });
    const rows = await r.json();
    cache = {};
    return rows.map(x => {
      cache[x.id] = x.data;
      const o = { id: x.id, ...x.data };
      if (x.data.assetId) o.url = STO + "/public/media/" + x.data.assetId;
      return o;
    });
  }
  async function refresh(force) {
    const rows = await load();
    const s = JSON.stringify(rows);
    if (force || s !== sig) {
      sig = s;
      const snap = { docs: rows.map(r => ({ id: r.id, data: () => { const { id, ...x } = r; return x; } })) };
      listeners.forEach(l => l.next(snap));
    }
  }
  const JSONH = { ...H, "Content-Type": "application/json" };
  const db = {
    collection: () => ({
      onSnapshot(next, error) {
        const l = { next, error };
        listeners.add(l);
        if (!timer) timer = setInterval(() => { if (!document.hidden && listeners.size) refresh().catch(() => {}); }, 6000);
        refresh(true).catch(e => error && error(e));
        return () => listeners.delete(l);
      },
      async add(d) {
        await req(REST, { method: "POST", headers: { ...JSONH, Prefer: "return=minimal" }, body: JSON.stringify({ id: uid(), data: d }) });
        refresh(true).catch(() => {});
      }
    }),
    doc: p => {
      const id = p.split("/")[1];
      const q = REST + "?id=eq." + encodeURIComponent(id);
      return {
        async delete() { await req(q, { method: "DELETE", headers: H }); refresh(true).catch(() => {}); },
        async update(d) {
          await req(q, { method: "PATCH", headers: { ...JSONH, Prefer: "return=minimal" }, body: JSON.stringify({ data: { ...(cache[id] || {}), ...d } }) });
          refresh(true).catch(() => {});
        }
      };
    }
  };
  const assets = {
    async upload(file) {
      const ext = ((file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5)) || "bin";
      const id = uid() + "." + ext;
      await req(STO + "/media/" + id, { method: "POST", headers: { ...H, "Content-Type": file.type || "application/octet-stream" }, body: file });
      return { id, url: STO + "/public/media/" + id };
    },
    async delete(id) { await req(STO + "/media/" + id, { method: "DELETE", headers: H }); }
  };
  const user = { canEdit: () => true };
  window.claude = { use: async n => (ok ? { db, assets, user }[n] || null : null) };
})();
