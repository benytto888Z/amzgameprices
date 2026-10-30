#!/usr/bin/env python3
"""Serveur local du catalogue. Mot de passe via AMZ_ADMIN_PASSWORD, jamais dans le JSON."""
import os, json, hashlib, hmac, secrets, tempfile, time, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'catalogue.json'
PASSWORD = os.environ.get('AMZ_ADMIN_PASSWORD', '')
HOST = os.environ.get('AMZ_HOST', '127.0.0.1')
PORT = int(os.environ.get('AMZ_PORT', '8000'))
SESSIONS = {}
FAILURES = {}
LOCK = threading.Lock()
SESSION_TTL = 8 * 3600
MAX_BODY = 128 * 1024

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def result(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)

    def read_json(self):
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= MAX_BODY: raise ValueError()
            return json.loads(self.rfile.read(size).decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            raise ValueError('Requête JSON invalide ou trop volumineuse.')

    def do_GET(self):
        path=urlsplit(self.path).path
        if path == '/api/catalogue':
            try:
                with LOCK: content = DATA.read_bytes()
                data=json.loads(content)
                self.result(200, {'data':data,'version':hashlib.sha256(content).hexdigest()})
            except (OSError, ValueError): self.result(500, {'error':'Impossible de lire catalogue.json.'})
            return
        if path.startswith('/api/'): self.result(404, {'error':'Introuvable'}); return
        # Seuls les fichiers nécessaires à l’interface sont servis.
        if path not in ('/', '/index.html', '/style.css', '/app.js') and not path.startswith('/images/'):
            self.send_error(404); return
        return super().do_GET()

    def do_POST(self):
        path=urlsplit(self.path).path
        if path == '/api/login':
            if len(PASSWORD) < 12: self.result(503, {'error':'Le serveur doit être démarré avec AMZ_ADMIN_PASSWORD (12 caractères minimum).'}); return
            ip=self.client_address[0]; now=time.time()
            with LOCK:
                recent=[t for t in FAILURES.get(ip,[]) if t > now-60]
                FAILURES[ip]=recent
                limited=len(recent)>=8
            if limited: self.result(429, {'error':'Trop de tentatives. Réessayez dans une minute.'}); return
            try: payload=self.read_json()
            except ValueError as e: self.result(400, {'error':str(e)}); return
            password=payload.get('password','') if isinstance(payload,dict) else ''
            if not isinstance(password,str) or not hmac.compare_digest(password.encode('utf-8'),PASSWORD.encode('utf-8')):
                with LOCK: FAILURES[ip].append(now)
                self.result(401, {'error':'Mot de passe incorrect.'}); return
            token=secrets.token_urlsafe(32)
            with LOCK:
                FAILURES.pop(ip,None)
                for k,v in list(SESSIONS.items()):
                    if v < now: del SESSIONS[k]
                SESSIONS[token]=now+SESSION_TTL
            self.result(200, {'token':token}); return
        if path not in ('/api/prix','/api/logout'): self.result(404, {'error':'Introuvable'}); return
        auth=self.headers.get('Authorization',''); token=auth[7:] if auth.startswith('Bearer ') else ''
        with LOCK: valid=bool(token and SESSIONS.get(token,0)>time.time())
        if not valid: self.result(401, {'error':'Session administrateur absente ou expirée.'}); return
        if path == '/api/logout':
            with LOCK: SESSIONS.pop(token,None)
            self.result(200, {'ok':True}); return
        try: payload=self.read_json()
        except ValueError as e: self.result(400, {'error':str(e)}); return
        if not isinstance(payload,dict) or not isinstance(payload.get('prices'),list) or not isinstance(payload.get('version'),str):
            self.result(400, {'error':'Données invalides.'}); return
        try:
            with LOCK:
                old=DATA.read_bytes(); version=hashlib.sha256(old).hexdigest(); data=json.loads(old)
                if not hmac.compare_digest(version,payload['version']):
                    self.result(409, {'error':'Le catalogue a changé depuis son chargement. Rechargez la page avant de modifier.'}); return
                prices=payload['prices']; games=data['equipements']
                if len(prices)!=len(games) or any(type(p) is not int or p<0 or p>1_000_000_000_000 for p in prices):
                    self.result(400, {'error':'Liste de prix invalide (entiers entre 0 et 1 000 000 000 000 FCFA).'}); return
                for g,p in zip(games,prices): g['prix_local_fcfa']=p
                new=(json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
                fd,tmp=tempfile.mkstemp(prefix='.catalogue-',suffix='.tmp',dir=ROOT)
                try:
                    with os.fdopen(fd,'wb') as f: f.write(new); f.flush(); os.fsync(f.fileno())
                    os.replace(tmp,DATA)
                finally:
                    if os.path.exists(tmp): os.unlink(tmp)
                newversion=hashlib.sha256(new).hexdigest()
            self.result(200, {'ok':True,'version':newversion})
        except (OSError, ValueError, KeyError, TypeError): self.result(500, {'error':'Impossible de sauvegarder les prix.'})

if __name__ == '__main__':
    if len(PASSWORD)<12: print('ATTENTION : administration désactivée. Définissez AMZ_ADMIN_PASSWORD (12 caractères minimum).', flush=True)
    print(f'Catalogue : http://{HOST}:{PORT}/',flush=True)
    print('HTTP non chiffré : accès local uniquement sauf proxy HTTPS sécurisé.',flush=True)
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
