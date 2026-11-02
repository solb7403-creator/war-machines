// READ-ONLY owner identity check (Nov 2 2026). Answers one question: is the Telegram admin pinned in cfg/admin/lunarbattle
// the same account (same eco record) as the website account ln_6392735208728? Writes nothing. Logs booleans only.
const DB = 'https://warmachines-a6034-default-rtdb.firebaseio.com', OWNER = 'ln_6392735208728';
const secret = (process.env.FIREBASE_DB_SECRET || '').trim();
if (!secret) throw new Error('no credential');
const get = async (p, q = '') => { const r = await fetch(`${DB}/${p}.json?auth=${encodeURIComponent(secret)}${q}`); if (!r.ok) throw new Error('read ' + r.status); return r.json(); };
const pin = await get('cfg/admin/lunarbattle');
const tgId = Number(pin);
const link = Number.isSafeInteger(tgId) && tgId > 0 ? await get('telegramLinks/' + tgId) : null;
const acc = await get('lunarAccounts/' + OWNER);
const eco = await get('eco/' + OWNER, '&shallow=true');
const legacy = Number.isSafeInteger(tgId) && tgId > 0 ? await get('eco/tg_' + tgId, '&shallow=true') : null;
console.log('RESULT ' + JSON.stringify({
  adminPinned: !!pin, pinIsNumericId: Number.isSafeInteger(tgId) && tgId > 0,
  telegramLinkExists: link !== null, telegramLinkIsOwner: link === OWNER,
  ownerAccountExists: !!acc, ownerAccountIdMatches: !!acc && acc.id === OWNER,
  ownerAccountTelegramIdIsAdminPin: !!acc && String(acc.telegramId) === String(pin),
  ownerEcoExists: !!eco, legacyTgEcoExists: !!legacy,
  linkedSameEco: link === OWNER && !!acc && acc.id === OWNER && !!eco,
}));
