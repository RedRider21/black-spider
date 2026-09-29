#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Daniele Deplano (RedRider21)
"""Black Spider — M0.5, esecuzione automatica delle prove 1 e 2.

Serve le pagine e fa da "banco": tiene i codici che i due browser si scambierebbero
a mano, così le due istanze possono parlarsi senza intervento umano.

Legato a 127.0.0.1 di proposito: non apre nulla verso la rete locale.
"""

import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

QUI = Path(__file__).resolve().parent
RADICE = QUI.parent          # si serve da spikes/, così lib/invito.js è raggiungibile
STATO = Path("/tmp/bslab/stato")
STATO.mkdir(parents=True, exist_ok=True)


def leggi(nome):
    p = STATO / f"{nome}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def scrivi(nome, dati):
    (STATO / f"{nome}.json").write_text(json.dumps(dati), encoding="utf-8")


class Banco(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(RADICE), **k)

    # --- lettura dei codici scambiati ---
    def do_GET(self):
        if self.path.startswith("/api/"):
            nome = self.path[5:].split("?")[0]
            if nome == "azzera":
                for f in STATO.glob("*.json"):
                    f.unlink()
                return self._json({"azzera": True})
            return self._json(leggi(nome) or {})
        return super().do_GET()

    # --- deposito dei codici ---
    def do_POST(self):
        if not self.path.startswith("/api/"):
            return self._json({"errore": "percorso sconosciuto"}, 404)
        nome = self.path[5:]
        n = int(self.headers.get("Content-Length", 0))
        try:
            dati = json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            return self._json({"errore": "corpo non valido"}, 400)
        scrivi(nome, dati)
        return self._json({"ok": True})

    def _json(self, dati, codice=200):
        corpo = json.dumps(dati).encode("utf-8")
        self.send_response(codice)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8143
    print(f"banco in ascolto su http://127.0.0.1:{porta}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", porta), Banco).serve_forever()
