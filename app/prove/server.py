#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Daniele Deplano (RedRider21)
"""Black Spider — il banco delle prove.

Serve l'applicazione e, insieme, fa da "banco": tiene i codici che i due browser
si scambierebbero a mano, così `collegamento.html` può girare in due esemplari
senza che qualcuno copi e incolli fra le due finestre.

Non fa parte dell'applicazione e non le somiglia: l'app non ha un server, e
questa è una sua prova che ne ha bisogno uno. Sta qui e non in `spikes/` perché
serve i file dell'app con i loro percorsi veri (`../manifest.webmanifest`,
`../index.html`).

Legato a 127.0.0.1 di proposito: non apre nulla verso la rete locale.

    python3 prove/server.py [porta]      # 8765 per difetto
"""

import json
import sys
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

QUI = Path(__file__).resolve().parent
RADICE = QUI.parent                       # si serve da app/

# Il deposito dei codici scambiati: nella cartella temporanea di *questo* sistema,
# che non è `/tmp` dappertutto. Non sta nel progetto perché è lo stato di una
# sessione di prova, non materiale da conservare.
STATO = Path(tempfile.gettempdir()) / "bsapp" / "stato"
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
    """Le pagine di prova depositano qui i loro esiti.

    Si accettano due forme: `/api/<nome>`, che è quella di `collegamento.html` e
    `avvio.html`, e `/<nome>`, che è quella di `m0.html` — che è nato prima di
    questo banco e si porta dietro la sua. Nessuna delle due è un'API
    dell'applicazione: l'app non ha un server, e questo è solo il tavolo su cui
    le prove appoggiano i fogli.
    """

    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(RADICE), **k)

    def _nome_stato(self):
        """Il nome del foglio di stato, o None se la richiesta è un file."""
        percorso = self.path.split("?")[0]
        if percorso.startswith("/api/"):
            nome = percorso[5:]
        elif percorso.count("/") == 1 and "." not in percorso:
            nome = percorso[1:]          # /esito  →  esito
        else:
            return None
        return nome or None

    def do_GET(self):
        nome = self._nome_stato()
        if nome is None:
            return super().do_GET()
        if nome == "azzera":
            for f in STATO.glob("*.json"):
                f.unlink()
            return self._json({"azzera": True})
        return self._json(leggi(nome) or {})

    def do_POST(self):
        nome = self.headers.get("X-Nome") or self._nome_stato()
        if not nome:
            return self._json({"errore": "percorso sconosciuto"}, 404)
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

    # Le richieste di una prova non sono un log da leggere: sono rumore.
    def log_message(self, *a):
        pass

    # Il service worker ha bisogno di questi due tipi, che SimpleHTTPRequestHandler
    # non conosce; senza, il browser rifiuta il modulo.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
    }


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f"app e banco su http://127.0.0.1:{porta}/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", porta), Banco).serve_forever()
