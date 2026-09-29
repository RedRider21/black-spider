#!/usr/bin/env bash
# Black Spider — M0.5, esecuzione automatica di una prova.
#   ./esegui.sh stun     candidati host + riflessi (STUN di Google)
#   ./esegui.sh host     solo rete locale, nessun contatto con l'esterno
#
# Presuppone che server.py sia già in ascolto. Vedi LEGGIMI.md.

set -u
MODO="${1:-stun}"
PORTA="${2:-8143}"
QUI="$(cd "$(dirname "$0")" && pwd)"
BASE="http://127.0.0.1:$PORTA"

curl -s "$BASE/api/azzera" >/dev/null
rm -rf /tmp/bslab/profili
mkdir -p /tmp/bslab/profili

echo "── prova automatica, modalità: $MODO ─────────────────────"

# Browser A: crea l'invito e aspetta.
google-chrome --headless=new --disable-gpu --no-sandbox \
  --user-data-dir=/tmp/bslab/profili/A \
  "$BASE/auto/pagina.html?ruolo=A&modo=$MODO" >/dev/null 2>&1 &
PID_A=$!

sleep 1

# Browser B: legge l'invito, risponde.
timeout 90 google-chrome --headless=new --disable-gpu --no-sandbox \
  --user-data-dir=/tmp/bslab/profili/B \
  "$BASE/auto/pagina.html?ruolo=B&modo=$MODO" >/dev/null 2>&1

# Aspetta che anche A abbia depositato il suo esito.
for _ in $(seq 1 30); do
  [ -f /tmp/bslab/stato/esito-A.json ] && break
  sleep 1
done
kill "$PID_A" 2>/dev/null

python3 - "$MODO" <<'PY'
import json, sys, pathlib
modo = sys.argv[1]
stato = pathlib.Path("/tmp/bslab/stato")
def leggi(n):
    p = stato / f"{n}.json"
    return json.loads(p.read_text()) if p.exists() else None

a, b = leggi("esito-A"), leggi("esito-B")
if not a or not b:
    print("  INCOMPLETO: manca l'esito di", "A" if not a else "B")
    sys.exit(1)

print(f"  A  raccolta ICE ......... {a.get('gatheringA')}  ({a.get('raccoltaMs')} ms)")
print(f"  B  raccolta ICE ......... {b.get('gatheringB')}  ({b.get('raccoltaMs')} ms)")
print(f"  codice invito ........... {a.get('codiceInvito')} caratteri")
print(f"  codice risposta ......... {a.get('codiceRisposta')} caratteri")
print(f"  canale aperto ........... {a.get('canaleAperto')}   dopo {a.get('tempoConnessioneMs')} ms")
print(f"  candidati ............... {a.get('tipoCandidatoLocale')} ↔ {a.get('tipoCandidatoRemoto')}")
print(f"  via relay ............... {a.get('viaRelay')}")
print(f"  RTT ..................... {a.get('rttMs')} ms")
print(f"  messaggio A → B ......... {b.get('messaggioRicevuto')!r}")
print(f"  risposta B → A .......... {a.get('rispostaRicevuta')!r}")
print(f"  stato finale ............ {a.get('statoFinale')}")
esiti = (a.get("canaleAperto"), a.get("rispostaRicevuta") == "eco: messaggio di prova",
         b.get("messaggioRicevuto") == "messaggio di prova")
print("  ─────────────────────────────────")
print("  ESITO:", "SUPERATA" if all(esiti) and a.get("ok") and b.get("ok") else "FALLITA")
for e in (a, b):
    if e.get("errore"): print(f"  errore in {e['ruolo']}: {e['errore']}")
PY
