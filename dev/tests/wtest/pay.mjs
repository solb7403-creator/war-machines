// Session 8: the payment flow for the server tests (every purchase is a server quote first: /api/order). Stars: the quote's invoice,
// Telegram's pre-checkout (answered by the Worker: read from the captured Telegram calls) and the successful_payment webhook. GRAM: the
// quote's memo and nanoGRAM amount, the fake toncenter history, the status call. SOL: the quote's reference and lamports, the fake RPC.
// call(path, body), hook(body): the test's own helpers; tgCalls: the captured Telegram API calls ([method, body]).
export function payKit({ call, hook, initData, tgCalls }) {
  const quote = (u, cur, desc, extra = {}) => call('/api/order', { initData: initData(u), a: 'quote', cur, desc, ...extra });
  const status = (u, q) => call('/api/order', { initData: initData(u), a: 'status', q });
  const cancel = (u, q) => call('/api/order', { initData: initData(u), a: 'cancel', q });
  const list = (u) => call('/api/order', { initData: initData(u), a: 'list' });
  // Telegram's pre-checkout for an order (amount: what the invoice says; Telegram sends the invoice's own total)
  async function pre(u, o, amount = o.amt, id = 'pq' + Math.random().toString(36).slice(2, 8)) {
    const n0 = tgCalls.length;
    await hook({ pre_checkout_query: { id, from: { id: u.id, username: u.username }, currency: 'XTR', total_amount: amount, invoice_payload: JSON.stringify({ u: u.id, q: o.oid }) } });
    const ans = tgCalls.slice(n0).find((c) => c[0] === 'answerPreCheckoutQuery' && c[1].pre_checkout_query_id === id);
    return ans ? { ok: ans[1].ok === true, why: ans[1].error_message || '' } : { ok: false, why: 'no answer' };
  }
  // Telegram's successful_payment for an order (payload: the invoice's own, unless a test forges one)
  const paid = (u, o, charge, amount = o.amt, payload = { u: u.id, q: o.oid }) => hook({ message: { from: { id: u.id, username: u.username }, chat: { id: u.id, type: 'private' }, successful_payment: { currency: 'XTR', total_amount: amount, telegram_payment_charge_id: charge, invoice_payload: JSON.stringify(payload) } } });
  const refund = (u, charge, amount = 0) => hook({ message: { from: { id: u.id }, chat: { id: u.id, type: 'private' }, refunded_payment: { currency: 'XTR', total_amount: amount, invoice_payload: '{}', telegram_payment_charge_id: charge } } });
  // one whole Stars purchase: quote, pre-checkout, payment. Returns the quote's reply, the order, the pre-checkout answer
  async function stars(u, desc, charge) {
    const [s, r] = await quote(u, 'STARS', desc);
    if (s !== 200) return { s, r };
    const o = r.order, p = await pre(u, o);
    if (p.ok) await paid(u, o, charge);
    return { s, r, o, pre: p };
  }
  // a GRAM payment on the fake chain for an order (value: nanoGRAM as a string; memo: the order's unless a test forges one)
  const tonTx = (o, hash, { value = o.base, memo = o.memo, source = 'EQpayer' + hash } = {}) => ({ utime: Math.floor(Date.now() / 1000), in_msg: { source, value: String(value), message: memo }, transaction_id: { lt: String(Date.now()), hash } });
  return { quote, status, cancel, list, pre, paid, refund, stars, tonTx };
}
// a fake Solana RPC: transactions by signature, signatures by address (the reference key or our wallet)
export function fakeSol(recipient) {
  const txs = new Map(), byAddr = new Map();
  function add(sig, { from = 'PayerWa11et1111111111111111111111111111111', lamports, ref = null, err = null, to = recipient } = {}) {
    const tx = { meta: { err, preBalances: [0, 0], postBalances: [0, lamports], innerInstructions: [] }, transaction: { message: { accountKeys: [{ pubkey: from }, { pubkey: to }, ...(ref ? [{ pubkey: ref }] : [])], instructions: [{ program: 'system', parsed: { type: 'transfer', info: { source: from, destination: to, lamports } } }] } } };
    txs.set(sig, tx);
    for (const a of [to, ...(ref ? [ref] : [])]) { if (!byAddr.has(a)) byAddr.set(a, []); byAddr.get(a).unshift({ signature: sig, err, blockTime: Math.floor(Date.now() / 1000) }); }
  }
  function handle(body) {
    const { method, params } = JSON.parse(body);
    if (method === 'getSignaturesForAddress') return { jsonrpc: '2.0', id: 1, result: (byAddr.get(params[0]) || []).slice(0, (params[1] && params[1].limit) || 10) };
    if (method === 'getTransaction') return { jsonrpc: '2.0', id: 1, result: txs.get(params[0]) || null };
    return { jsonrpc: '2.0', id: 1, error: { message: 'method' } };
  }
  return { add, handle, txs, byAddr };
}
