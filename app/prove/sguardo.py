#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Daniele Deplano (RedRider21)
"""Black Spider — guarda la chiamata a schermo, e ne salva le fotografie.

    python3 app/prove/sguardo.py            # due browser, schermate in /tmp/bsapp/sguardo
    PORTA=9000 python3 app/prove/sguardo.py # su un'altra porta

Perché esiste. Le prove dicono *se* una cosa funziona; questo dice *come si vede*.
Sono due domande diverse e si rispondono con due strumenti diversi. Una barra della
chiamata può superare tutti i controlli — stato giusto, pulsanti giusti, byte che
passano — e avere comunque il testo che sborda, il pulsante fuori dallo schermo, o
un colore che non si legge. Nessuna asserzione se ne accorge, e una persona se ne
accorge subito.

Come lo fa. Apre due Chrome veri con la porta di debug accesa, si collega al
protocollo DevTools (CDP) e **clicca con il mouse**: `Input.dispatchMouseEvent` sulle
coordinate del pulsante, non `element.click()`. La differenza conta — un evento del
mouse è ciò che riceve una persona, e passa per il percorso completo dei gestori, del
fuoco, dell'ordine di disegno.

Poi scatta le fotografie nei momenti che interessano, e le lascia su disco perché
qualcuno le guardi.

Il protocollo è fatto a mano sopra i socket, perché qui non c'è nessuna libreria e
non se ne vogliono installare: un handshake HTTP, qualche byte di intestazione, e
JSON. Il debug resta **su 127.0.0.1** come tutto il resto.
"""

import base64
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

QUI = Path(__file__).resolve().parent
PROGETTO = QUI.parent.parent
PORTA = os.environ.get("PORTA", "8765")
BASE = f"http://127.0.0.1:{PORTA}"
CHROME = os.environ.get("CHROME") or "google-chrome"
PROFILI = Path(os.environ.get("TMPDIR", "/tmp")) / "bsapp" / "sguardo"
SCATTI = PROFILI / "fotografie"

# Le stesse opzioni della prova della chiamata, per la stessa ragione: un microfono
# finto che emette un tono, il permesso concesso senza chiedere (non c'è nessuno a
# rispondere), l'audio lasciato partire senza un gesto — e `--mute-audio`, perché
# senza quello il tono esce davvero dalle casse della macchina.
FINTI = [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
    "--mute-audio",
]

processi = []


def ferma():
    for p in processi:
        try:
            p.terminate()
        except Exception:
            pass


def pulisci(*_):
    """Solo per il segnale: chiude tutto e esce.

    Non è la stessa cosa della pulizia finale, ed è per questo che sono due
    funzioni. Se il `finally` chiamasse `sys.exit`, l'eccezione che sta salendo
    verrebbe sostituita da un'uscita pulita — e un guasto diventerebbe un silenzio.
    """
    ferma()
    sys.exit(0)


# --------------------------------------------------------------- il protocollo

class WS:
    """Il minimo di WebSocket per parlare con il protocollo DevTools."""

    def __init__(self, url):
        u = urlsplit(url)
        self.sock = socket.create_connection((u.hostname, u.port), timeout=60)
        chiave = base64.b64encode(os.urandom(16)).decode()
        richiesta = (
            f"GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {chiave}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(richiesta.encode())
        avanzo = b""
        while b"\r\n\r\n" not in avanzo:
            pezzo = self.sock.recv(4096)
            if not pezzo:
                raise RuntimeError("il browser ha chiuso durante l'handshake")
            avanzo += pezzo
        testa, _, resto = avanzo.partition(b"\r\n\r\n")
        if b"101" not in testa.split(b"\r\n")[0]:
            raise RuntimeError("handshake rifiutato: " + testa.decode("latin1", "replace"))
        self.avanzo = resto

    def _prendi(self, quanti):
        while len(self.avanzo) < quanti:
            pezzo = self.sock.recv(1 << 20)
            if not pezzo:
                raise RuntimeError("connessione chiusa")
            self.avanzo += pezzo
        preso, self.avanzo = self.avanzo[:quanti], self.avanzo[quanti:]
        return preso

    def manda(self, testo):
        dati = testo.encode()
        n = len(dati)
        testa = bytearray([0x81])                      # testo, ultimo pezzo
        if n < 126:
            testa.append(0x80 | n)
        elif n < 65536:
            testa.append(0x80 | 126)
            testa += n.to_bytes(2, "big")
        else:
            testa.append(0x80 | 127)
            testa += n.to_bytes(8, "big")
        maschera = os.urandom(4)                       # il client maschera sempre
        testa += maschera
        self.sock.sendall(bytes(testa) + bytes(b ^ maschera[i % 4] for i, b in enumerate(dati)))

    def ricevi(self):
        pezzi = []
        while True:
            b0, b1 = self._prendi(2)
            fine, op = b0 & 0x80, b0 & 0x0F
            n = b1 & 0x7F
            if n == 126:
                n = int.from_bytes(self._prendi(2), "big")
            elif n == 127:
                n = int.from_bytes(self._prendi(8), "big")
            if b1 & 0x80:
                self._prendi(4)                        # dal server non dovrebbe mai arrivare
            dati = self._prendi(n) if n else b""
            if op == 0x8:
                raise RuntimeError("il browser ha chiuso la connessione")
            if op in (0x1, 0x2, 0x0):
                pezzi.append(dati)
            if fine:
                return b"".join(pezzi).decode("utf-8", "replace")


class CDP:
    def __init__(self, url):
        self.ws = WS(url)
        self.id = 0

    def chiama(self, metodo, **parametri):
        self.id += 1
        mio = self.id
        self.ws.manda(json.dumps({"id": mio, "method": metodo, "params": parametri}))
        while True:
            m = json.loads(self.ws.ricevi())
            if m.get("id") == mio:
                if "error" in m:
                    raise RuntimeError(f"{metodo}: {m['error']}")
                return m.get("result", {})


def valuta(cdp, espressione):
    r = cdp.chiama("Runtime.evaluate", expression=espressione,
                   returnByValue=True, awaitPromise=True)
    if r.get("exceptionDetails"):
        raise RuntimeError(r["exceptionDetails"].get("text", "errore nella pagina"))
    return r.get("result", {}).get("value")


def clicca(cdp, selettore):
    """Clicca con il mouse, dove sta il pulsante.

    Non `element.click()`: un evento del mouse vero attraversa i gestori, il fuoco e
    l'ordine di disegno come li attraversa il dito di una persona. Ed è anche il modo
    di scoprire che un pulsante è fuori dallo schermo — se lo è, le coordinate non
    cadono su niente e il clic non fa niente, che è esattamente quello che succede a
    chi lo cerca.
    """
    punto = valuta(cdp, f"""(() => {{
        const e = document.querySelector({json.dumps(selettore)});
        if (!e) return null;
        e.scrollIntoView({{ block: 'center' }});
        const r = e.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height];
    }})()""")
    if not punto:
        raise RuntimeError(f"non c'è nessun «{selettore}» da cliccare")
    x, y, larghezza, altezza = punto
    if larghezza == 0 or altezza == 0:
        raise RuntimeError(f"«{selettore}» esiste ma non si vede")
    for tipo in ("mousePressed", "mouseReleased"):
        cdp.chiama("Input.dispatchMouseEvent", type=tipo, x=x, y=y,
                   button="left", clickCount=1)
    return (x, y)


def scatta(cdp, nome):
    SCATTI.mkdir(parents=True, exist_ok=True)
    r = cdp.chiama("Page.captureScreenshot", format="png")
    percorso = SCATTI / nome
    percorso.write_bytes(base64.b64decode(r["data"]))
    print(f"    fotografia: {percorso}")
    return percorso


def attendi(cdp, espressione, cosa, secondi=45):
    inizio = time.time()
    while time.time() - inizio < secondi:
        if valuta(cdp, espressione):
            return True
        time.sleep(0.15)
    raise RuntimeError(f"scaduto aspettando che {cosa}")


# ------------------------------------------------------------------- i browser

def avvia(ruolo, porta_debug):
    profilo = PROFILI / ruolo
    # Profilo freddo a ogni giro, e non è una precauzione da poco. Il service
    # worker dell'app è "prima quello che ho, poi aggiorno": risponde dalla copia
    # salvata. Con un profilo riusato, la seconda esecuzione guarda il codice
    # della prima — e una prova che dice «tutto a posto» parlerebbe di una
    # revisione che non è più quella sul disco.
    shutil.rmtree(profilo, ignore_errors=True)
    profilo.mkdir(parents=True, exist_ok=True)
    comando = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
               f"--remote-debugging-port={porta_debug}",
               "--remote-debugging-address=127.0.0.1",
               f"--user-data-dir={profilo}",
               "--window-size=1240,1000", *FINTI, "about:blank"]
    log = open(PROFILI / f"{ruolo}.log", "wb")
    p = subprocess.Popen(comando, stdout=log, stderr=subprocess.STDOUT)
    processi.append(p)

    for _ in range(80):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{porta_debug}/json/list", timeout=1) as r:
                schede = json.load(r)
            for s in schede:
                if s.get("type") == "page" and s.get("webSocketDebuggerUrl"):
                    cdp = CDP(s["webSocketDebuggerUrl"])
                    cdp.chiama("Page.enable")
                    cdp.chiama("Runtime.enable")
                    cdp.chiama("Emulation.setDeviceMetricsOverride",
                               width=1240, height=1000, deviceScaleFactor=1, mobile=False)
                    return cdp
        except Exception:
            pass
        time.sleep(0.25)
    raise RuntimeError(f"{ruolo}: il browser non ha aperto la porta di debug")


def vai(cdp, url):
    cdp.chiama("Page.navigate", url=url)
    attendi(cdp, "document.readyState === 'complete'", "la pagina si carichi")


# ------------------------------------------------------------------- le mosse

def api(chiave, valore=None):
    if valore is None:
        try:
            with urllib.request.urlopen(f"{BASE}/api/{chiave}", timeout=2) as r:
                return json.load(r).get("valore")
        except Exception:
            return None
    dati = json.dumps({"valore": valore}).encode()
    richiesta = urllib.request.Request(f"{BASE}/api/{chiave}", data=dati,
                                       headers={"content-type": "application/json"})
    with urllib.request.urlopen(richiesta, timeout=5) as r:
        return json.load(r)


def attendi_api(chiave, secondi=45):
    inizio = time.time()
    while time.time() - inizio < secondi:
        v = api(chiave)
        if v:
            return v
        time.sleep(0.4)
    raise RuntimeError(f"scaduto aspettando il codice «{chiave}» dal banco")


def q(selettore):
    """`document.querySelector`, scritto per esteso.

    Nell'app `$` è un alias di modulo, non una variabile globale: esiste dentro
    `app.js` e da fuori non si vede. Le pagine di prova hanno un `$` proprio, ed è
    per questo che qui non lo si può usare — ma è anche la ragione per cui conviene
    guardare l'app vera invece di una pagina che la imita.
    """
    return f"document.querySelector({json.dumps(selettore)})"


STATO = """(document.body.dataset.chiamata || 'nessuna')"""
TIPI = """(document.body.dataset.chiamataTipi || '')"""
BYTE = """Number(document.body.dataset.chiamataByte || 0)"""


def main():
    SCATTI.mkdir(parents=True, exist_ok=True)
    print("  Avvio il server e i due browser…")
    server = subprocess.Popen([sys.executable, str(QUI / "server.py"), PORTA],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    processi.append(server)
    for _ in range(40):
        try:
            with urllib.request.urlopen(f"{BASE}/index.html", timeout=1):
                break
        except Exception:
            time.sleep(0.25)
    api("azzera")

    a = avvia("A", 9333)
    b = avvia("B", 9334)
    vai(a, f"{BASE}/index.html")
    vai(b, f"{BASE}/index.html")
    attendi(a, "document.body.dataset.pronto === '1'", "l'app di A si avvii", 60)
    attendi(b, "document.body.dataset.pronto === '1'", "l'app di B si avvii", 60)
    print("  Le due app sono accese.")

    # --- il collegamento: come lo farebbe una persona -----------------------

    clicca(a, "#btnCrea")
    attendi(a, f"{q('#invitoOut')}.value", "l'invito di A sia pronto")
    api("invito", valuta(a, f"{q('#invitoOut')}.value"))
    valuta(b, f"{q('#invitoIn')}.value = {json.dumps(api('invito'))}")
    clicca(b, "#btnRispondi")
    attendi(b, f"{q('#rispostaOut')}.value", "la risposta di B sia pronta")
    api("risposta", valuta(b, f"{q('#rispostaOut')}.value"))
    valuta(a, f"{q('#rispostaIn')}.value = {json.dumps(api('risposta'))}")
    clicca(a, "#btnCompleta")

    attendi(a, f"!{q('#pannelloChat')}.hidden", "il canale di A si apra")
    attendi(b, f"!{q('#pannelloChat')}.hidden", "il canale di B si apra")
    print("  Collegati. Ecco come si vedono:\n")
    scatta(a, "01-collegato-A.png")
    scatta(b, "01-collegato-B.png")

    # --- la chiamata ---------------------------------------------------------

    print("  A chiama…")
    clicca(a, "#btnChiama")
    attendi(b, f"{STATO} === 'squilla'", "a B squilli")
    print("  A B squilla:\n")
    scatta(b, "02-squilla-B.png")

    clicca(b, "#btnAccetta")
    attendi(a, f"{STATO} === 'in-corso'", "la chiamata parta da A")
    attendi(b, f"{STATO} === 'in-corso'", "la chiamata parta da B")
    attendi(b, f"{TIPI}.includes('audio')", "arrivi la voce a B")
    time.sleep(2)
    print("  In corso, con la voce che passa:\n")
    scatta(a, "03-in-corso-A.png")
    scatta(b, "03-in-corso-B.png")
    print(f"    byte di voce arrivati a B: {valuta(b, BYTE)}")

    print("  A si mette muto…")
    clicca(a, "#btnMuto")
    time.sleep(1)
    scatta(a, "04-muto-A.png")
    clicca(a, "#btnMuto")
    time.sleep(1)

    print("  A accende la telecamera…")
    clicca(a, "#btnVideo")
    attendi(b, f"{TIPI}.includes('video')", "arrivi il video a B", 40)
    time.sleep(2)
    scatta(a, "05-video-acceso-A.png")
    scatta(b, "05-video-acceso-B.png")
    print(f"    tracce in arrivo a B: {valuta(b, TIPI)}")

    print("  A la spegne…")
    clicca(a, "#btnVideo")
    attendi(b, f"!{TIPI}.includes('video')", "il video sparisca da B", 40)
    time.sleep(1)
    scatta(b, "06-video-spento-B.png")

    print("  A riattacca…")
    clicca(a, "#btnRiattacca")
    attendi(b, f"{STATO} === 'chiusa'", "B veda la chiamata chiusa")
    time.sleep(1)
    scatta(b, "07-chiusa-B.png")
    scatta(a, "07-chiusa-A.png")

    print(f"\n  Fotografie in {SCATTI}")


if __name__ == "__main__":
    signal.signal(signal.SIGINT, pulisci)
    try:
        main()
    finally:
        ferma()
