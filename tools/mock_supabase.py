"""A tiny fake Supabase server for testing cloud sync locally, without a real account.
It imitates only what Sebas XP uses: email/password auth and the `entries` + `docs` tables.
Data lives in memory and disappears when you stop it.

Run:   python3 tools/mock_supabase.py            (listens on http://127.0.0.1:54321, key: test-key)
Then, in the browser console of the app (each "device" = a different address, e.g. localhost vs 127.0.0.1):
  localStorage.setItem('sebasxp_sync_server', JSON.stringify({url: 'http://127.0.0.1:54321', key: 'test-key'})); location.reload()
Undo:  localStorage.removeItem('sebasxp_sync_server')"""
import json
import os
import secrets
import threading
import uuid
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs

KEY = os.environ.get('MOCK_KEY', 'test-key')
PORT = int(os.environ.get('MOCK_PORT', 54321))
EXPIRES_IN = int(os.environ.get('MOCK_EXPIRES_IN', 3600))

lock = threading.Lock()
users = {}      # email -> {id, password}
tokens = {}     # access token -> (user id, expires at)
refresh = {}    # refresh token -> user id
tables = {'entries': {}, 'docs': {}}   # table -> {(user_id, pk): row}
PK = {'entries': 'id', 'docs': 'key'}
last_ts = [datetime.now(timezone.utc)]


def now_iso():
    """Strictly increasing server timestamps, formatted like Postgres/Supabase (microseconds, +00:00)."""
    t = datetime.now(timezone.utc)
    if t <= last_ts[0]:
        t = last_ts[0] + timedelta(microseconds=1)
    last_ts[0] = t
    return t.isoformat()


def parse_ts(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00'))


def session_for(uid, email):
    at, rt = secrets.token_hex(16), secrets.token_hex(16)
    tokens[at] = (uid, datetime.now(timezone.utc) + timedelta(seconds=EXPIRES_IN))
    refresh[rt] = uid
    return {'access_token': at, 'refresh_token': rt, 'expires_in': EXPIRES_IN, 'token_type': 'bearer', 'user': {'id': uid, 'email': email}}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print('[mock]', self.command, self.path.split('?')[0], fmt % args if 'code' in fmt else '')

    def send(self, code, body=None):
        data = b'' if body is None else json.dumps(body).encode()
        self.send_response(code)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'apikey, authorization, content-type, prefer, range, x-client-info')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        if body is not None:
            self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send(204)

    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'null')

    def user(self):
        auth = self.headers.get('Authorization', '')
        tok = auth[7:] if auth.startswith('Bearer ') else ''
        hit = tokens.get(tok)
        if not hit or hit[1] < datetime.now(timezone.utc):
            return None
        return hit[0]

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == '/__dump':
            with lock:
                return self.send(200, {t: [r for r in rows.values()] for t, rows in tables.items()})
        if self.headers.get('apikey') != KEY:
            return self.send(401, {'message': 'Invalid API key'})
        table = u.path.rsplit('/', 1)[-1]
        if not u.path.startswith('/rest/v1/') or table not in tables:
            return self.send(404, {'message': 'not found'})
        uid = self.user()
        if not uid:
            return self.send(401, {'message': 'JWT expired'})
        q = parse_qs(u.query)
        with lock:
            rows = [r for (owner, _), r in tables[table].items() if owner == uid]
        if 'device' in q and q['device'][0].startswith('neq.'):
            dev = q['device'][0][4:]
            rows = [r for r in rows if r['device'] != dev]
        if 'updated_at' in q and q['updated_at'][0].startswith('gt.'):
            since = parse_ts(q['updated_at'][0][3:])
            rows = [r for r in rows if parse_ts(r['updated_at']) > since]
        rows.sort(key=lambda r: (r['updated_at'], r[PK[table]]))
        off, lim = int(q.get('offset', ['0'])[0]), int(q.get('limit', ['1000'])[0])
        self.send(200, rows[off:off + lim])

    def do_POST(self):
        u = urlparse(self.path)
        if self.headers.get('apikey') != KEY:
            return self.send(401, {'message': 'Invalid API key'})
        b = self.body()
        with lock:
            if u.path == '/auth/v1/signup':
                email, pw = (b or {}).get('email', '').lower(), (b or {}).get('password', '')
                if email in users:
                    return self.send(422, {'msg': 'User already registered'})
                if len(pw) < 6:
                    return self.send(422, {'msg': 'Password should be at least 6 characters.'})
                users[email] = {'id': str(uuid.uuid4()), 'password': pw}
                return self.send(200, session_for(users[email]['id'], email))
            if u.path == '/auth/v1/token':
                grant = parse_qs(u.query).get('grant_type', [''])[0]
                if grant == 'password':
                    email = (b or {}).get('email', '').lower()
                    rec = users.get(email)
                    if not rec or rec['password'] != (b or {}).get('password'):
                        return self.send(400, {'error': 'invalid_grant', 'error_description': 'Invalid login credentials'})
                    return self.send(200, session_for(rec['id'], email))
                if grant == 'refresh_token':
                    uid = refresh.pop((b or {}).get('refresh_token', ''), None)
                    if not uid:
                        return self.send(400, {'error': 'invalid_grant', 'error_description': 'Invalid Refresh Token'})
                    email = next(e for e, r in users.items() if r['id'] == uid)
                    return self.send(200, session_for(uid, email))
                return self.send(400, {'error': 'unsupported_grant_type'})
            if u.path == '/auth/v1/logout':
                return self.send(204)
            table = u.path.rsplit('/', 1)[-1]
            if u.path.startswith('/rest/v1/') and table in tables:
                uid = self.user()
                if not uid:
                    return self.send(401, {'message': 'JWT expired'})
                for r in (b if isinstance(b, list) else [b]):
                    if r.get('user_id', uid) != uid:   # row level security
                        return self.send(403, {'message': 'new row violates row-level security policy'})
                    r = dict(r, user_id=uid, updated_at=now_iso())
                    r.setdefault('device', '')
                    tables[table][(uid, r[PK[table]])] = r
                return self.send(201)
        self.send(404, {'message': 'not found'})


class Server(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    print(f'Mock Supabase on http://127.0.0.1:{PORT}  key={KEY}  (token lifetime {EXPIRES_IN}s)')
    Server(('127.0.0.1', PORT), Handler).serve_forever()
