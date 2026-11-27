// Session 8: the outside services a purchase touches, faked for the local browser harnesses (dev/tests/conquest-server.mjs: the
// Telegram edition; dev/tests/webserver.mjs: the website). Test-only: nothing here is a production route. The real Worker talks to
//  - toncenter (GRAM): our wallet's history, an incoming message with the order's memo and nanoGRAM value;
//  - a Solana RPC (SOL): getSignaturesForAddress by the order's reference key, getTransaction (a finalized System transfer);
//  - the Telegram Bot API (Stars): createInvoiceLink (the harness keeps each invoice's payload and amount, so a test can play
//    Telegram: the pre-checkout query, then the successful payment), answerPreCheckoutQuery (recorded), and every other method ok.
import { fakeSol } from './pay.mjs';
export function fakeChain({ tonRecipient, solRecipient }) {
  const ton = [], sol = fakeSol(solRecipient), invoices = new Map(), tgCalls = [];
  let n = 0;
  // a GRAM payment to our wallet: value in nanoGRAM (a string), the memo the order shows
  function tonPay(memo, value, source = 'EQbrowserPayer' + (++n)) {
    ton.unshift({ utime: Math.floor(Date.now() / 1000), in_msg: { source, value: String(value), message: memo }, transaction_id: { lt: String(Date.now() * 1000 + n), hash: 'tonhash' + n + Date.now().toString(36) } });
  }
  // a SOL payment with the order's reference key (what pay.html sends)
  function solPay(ref, lamports) { const sig = 'solsig' + (++n) + Date.now().toString(36); sol.add(sig, { lamports: Number(lamports), ref }); return sig; }
  async function handle(u, init = {}) {
    const url = String(u);
    if (url.startsWith('https://toncenter.com/api/v2/getTransactions')) {
      if (!url.includes('address=' + tonRecipient)) return Response.json({ ok: true, result: [] });
      return Response.json({ ok: true, result: new URL(url).searchParams.get('lt') ? [] : ton.slice(0, 50) });
    }
    if (url.startsWith('https://solana-rpc.publicnode.com') || url.startsWith('https://api.mainnet-beta.solana.com')) return Response.json(sol.handle(init.body || '{}'));
    if (url.startsWith('https://api.telegram.org/bot')) {
      const method = url.split('/').pop(), body = init.body ? JSON.parse(init.body) : {};
      tgCalls.push([method, body]);
      if (method === 'createInvoiceLink') { const link = 'https://t.me/$fakeinvoice' + (++n); invoices.set(link, { payload: body.payload, amount: body.prices && body.prices[0] && body.prices[0].amount }); return Response.json({ ok: true, result: link }); }
      return Response.json({ ok: true, result: true });
    }
    return null;
  }
  return { handle, tonPay, solPay, invoices, tgCalls };
}
