// Minimal in-memory Firebase Realtime Database REST emulator for worker tests (ETags and if-match included, like the real one)
import { createHash } from 'node:crypto';
export function makeDB() {
  const root = {};
  const parts = (p) => p.split('/').filter(Boolean);
  const get = (p) => { let n = root; for (const k of parts(p)) { if (n == null || typeof n !== 'object') return null; n = n[k]; } return n === undefined ? null : n; };
  const resolve = (v, cur) => {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return Date.now();
      if (v['.sv'] && v['.sv'].increment !== undefined) return (typeof cur === 'number' ? cur : 0) + v['.sv'].increment;
      const o = Array.isArray(v) ? [] : {};
      for (const [k, x] of Object.entries(v)) { const r = resolve(x, cur && cur[k]); if (r !== null && r !== undefined) o[k] = r; }
      return o;
    }
    return v;
  };
  const set = (p, v) => {
    const ks = parts(p);
    if (!ks.length) throw new Error('set root');
    let n = root;
    for (let i = 0; i < ks.length - 1; i++) { if (n[ks[i]] == null || typeof n[ks[i]] !== 'object') n[ks[i]] = {}; n = n[ks[i]]; }
    const last = ks[ks.length - 1];
    const val = resolve(v, n[last]);
    if (val === null || val === undefined) delete n[last]; else n[last] = val;
  };
  const query = (node, q) => {
    if (node == null || typeof node !== 'object') return node;
    let entries = Object.entries(node);
    if (q.shallow === 'true') return Object.fromEntries(entries.map(([k, v]) => [k, typeof v === 'object' ? true : v]));
    const ob = q.orderBy ? JSON.parse(q.orderBy) : null;
    if (!ob) return node;
    const keyOf = ([k, v]) => ob === '$key' ? k : ob === '$value' ? v : (v && typeof v === 'object' ? v[ob] ?? null : null);
    if (ob !== '$key' && ob !== '$value' && !q._indexed) throw new Error('Index not defined');
    entries.sort((a, b) => { const x = keyOf(a), y = keyOf(b); if(x===null&&y!==null)return -1;if(y===null&&x!==null)return 1;return x < y ? -1 : x > y ? 1 : (a[0] < b[0] ? -1 : 1); });
    if (q.equalTo !== undefined) { const v = JSON.parse(q.equalTo); entries = entries.filter(e => keyOf(e) === v); }
    if (q.startAt !== undefined) { const v = JSON.parse(q.startAt); entries = entries.filter(e => keyOf(e) >= v); }
    if (q.endAt !== undefined) { const v = JSON.parse(q.endAt); entries = entries.filter(e => keyOf(e) <= v); }
    if (q.limitToLast) entries = entries.slice(-Number(q.limitToLast));
    if (q.limitToFirst) entries = entries.slice(0, Number(q.limitToFirst));
    return Object.fromEntries(entries);
  };
  const log = [];
  const etag = (p) => { const v = get(p); return v === null ? 'null_etag' : createHash('sha1').update(JSON.stringify(v)).digest('base64'); };
  const hdr = (init, k) => { const h = init.headers || {}; if (typeof h.get === 'function') return h.get(k); for (const [a, b] of Object.entries(h)) if (a.toLowerCase() === k.toLowerCase()) return b; return null; };
  async function handle(url, init = {}) {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname.replace(/\.json$/, ''));
    const q = Object.fromEntries(u.searchParams.entries());
    if (q.auth !== 'SECRET') return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 401 });
    const method = (init.method || 'GET').toUpperCase();
    log.push(method + ' ' + path + (u.search.replace(/auth=SECRET&?/, '') ? ' ' + u.search.replace(/[?&]?auth=SECRET/, '') : ''));
    if (method === 'GET') {
      const indexed = ['/players:pts', '/players:ref', '/players:vg', '/players:snapshotRankV1', '/ntf:last', '/ntf:nx', '/gh:pw'].includes(path + ':' + (q.orderBy ? JSON.parse(q.orderBy) : '')) || /^\/(dly|wly)\/\d+$/.test(path);
      const headers = hdr(init, 'X-Firebase-ETag') === 'true' ? { ETag: etag(path) } : {};
      return new Response(JSON.stringify(query(get(path), { ...q, _indexed: indexed })), { status: 200, headers });
    }
    const body = init.body ? JSON.parse(init.body) : null;
    const im = hdr(init, 'if-match');
    // like Firebase: a conditional write can't be combined with print=silent, shallow or query parameters (400)
    if (im !== null && im !== undefined && (q.print === 'silent' || q.shallow || q.orderBy)) return new Response(JSON.stringify({ error: "Mixing 'shallow', querying parameters or 'print=silent' and if-match or if-none-match requests is not supported" }), { status: 400 });
    if (im !== null && im !== undefined && method === 'PUT' && im !== etag(path)) { db.conflicts++; return new Response(JSON.stringify(get(path)), { status: 412, headers: { ETag: etag(path) } }); }
    const reply = (b) => q.print === 'silent' ? new Response(null, { status: 204 }) : new Response(JSON.stringify(b));   // print=silent: no body, like Firebase
    if (method === 'PUT') { set(path, body); return reply(body); }
    if (method === 'PATCH') { for (const [k, v] of Object.entries(body)) set((path + '/' + k).replace(/\/+/g, '/'), v); return reply(body); }
    if (method === 'DELETE') { const ks = parts(path); let n = root; for (let i = 0; i < ks.length - 1; i++) { n = n && n[ks[i]]; } if (n) delete n[ks[ks.length - 1]]; return new Response('null'); }
    return new Response('bad', { status: 400 });
  }
  const db = { root, get, handle, log, conflicts: 0 };
  return db;
}
