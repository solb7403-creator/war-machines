# Sends due, approved posts from queue.json to the Telegram channel. Used by .github/workflows/channel-post.yml.
# Queue item: {"id": "unique", "at": "2026-10-26T15:00:00Z", "approved": true, "text": "...", "media": "path/in/repo.jpg|.mp4" (optional), "pin": true (optional)}
# Text supports Telegram HTML (<b>, <i>, <a href>). With media, text becomes the caption (max 1024 chars).
import json, os, sys, time, uuid, urllib.request
from datetime import datetime, timezone

CHAT = '@LUNARmemecoin'
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
TOKEN = os.environ['BOT'].strip()
API = 'https://api.telegram.org/bot' + TOKEN + '/'

def call(method, fields, file_field=None, path=None):
    if path:
        b = uuid.uuid4().hex
        body = b''
        for k, v in fields.items():
            body += ('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (b, k, v)).encode()
        name = os.path.basename(path)
        body += ('--%s\r\nContent-Disposition: form-data; name="%s"; filename="%s"\r\nContent-Type: application/octet-stream\r\n\r\n' % (b, file_field, name)).encode()
        body += open(path, 'rb').read() + ('\r\n--%s--\r\n' % b).encode()
        req = urllib.request.Request(API + method, data=body, headers={'Content-Type': 'multipart/form-data; boundary=' + b})
    else:
        req = urllib.request.Request(API + method, data=json.dumps(fields).encode(), headers={'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        return {'ok': False, 'description': e.read().decode()[:300]}

def check():
    me = call('getMe', {}).get('result') or {}
    m = call('getChatMember', {'chat_id': CHAT, 'user_id': me.get('id')})
    r = m.get('result') or {}
    ok = r.get('status') in ('administrator', 'creator') and (r.get('can_post_messages') or r.get('status') == 'creator')
    print('::notice title=channel check::' + json.dumps({'bot': me.get('username'), 'status': r.get('status'), 'can_post': r.get('can_post_messages'), 'error': m.get('description')}))
    ch = (call('getChat', {'chat_id': CHAT}).get('result') or {})
    pm = ch.get('pinned_message') or {}
    print('::notice title=channel info::' + json.dumps({'title': ch.get('title'), 'description': ch.get('description'), 'pinned': (pm.get('text') or pm.get('caption') or '')[:900], 'pinned_date': pm.get('date')}, ensure_ascii=False))
    return ok

if not check():
    print('::error::The bot is not an admin with Post Messages in ' + CHAT)
    sys.exit(1)
if os.environ.get('MODE') == 'check':
    sys.exit(0)

queue = json.load(open(os.path.join(HERE, 'queue.json')))
sp = os.path.join(HERE, 'sent.json')
sent = json.load(open(sp)) if os.path.exists(sp) else {}
now = datetime.now(timezone.utc)
fail = 0
for p in queue:
    if p['id'] in sent or not p.get('approved'):
        continue
    if datetime.fromisoformat(p['at'].replace('Z', '+00:00')) > now:
        continue
    media = p.get('media')
    if media:
        path = os.path.join(ROOT, media)
        video = media.lower().endswith(('.mp4', '.mov'))
        r = call('sendVideo' if video else 'sendPhoto', {'chat_id': CHAT, 'caption': p['text'], 'parse_mode': 'HTML'}, 'video' if video else 'photo', path)
    else:
        r = call('sendMessage', {'chat_id': CHAT, 'text': p['text'], 'parse_mode': 'HTML', 'link_preview_options': {'is_disabled': bool(p.get('no_preview'))}})
    if r.get('ok'):
        if p.get('pin'):
            pr = call('pinChatMessage', {'chat_id': CHAT, 'message_id': (r.get('result') or {}).get('message_id'), 'disable_notification': True})
            print('::notice title=pin::' + json.dumps({'id': p['id'], 'ok': pr.get('ok'), 'error': pr.get('description')}))
        sent[p['id']] = {'at': now.isoformat(timespec='seconds'), 'msg': (r.get('result') or {}).get('message_id')}
        print('::notice title=sent::' + p['id'])
        time.sleep(2)
    else:
        fail += 1
        print('::error title=failed %s::%s' % (p['id'], r.get('description')))
json.dump(sent, open(sp, 'w'), indent=1)
sys.exit(1 if fail else 0)
