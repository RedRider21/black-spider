#!/usr/bin/env bash
# Black Spider — esegue tutte le prove e dice l'esito.
#
#   ./prove.sh              tutte e tre (m0, avvio, collegamento fra due browser)
#   ./prove.sh avvio        una sola: m0 | avvio | collegamento
#   ./prove.sh tutte --tieni    lascia il server acceso e i profili sul disco
#
# Perché esiste. Le prove vanno eseguite **in tempo reale**, una per una, con una
# pagina che deposita il risultato quando ha finito: `--virtual-time-budget` di
# Chrome headless non aspetta IndexedDB né ICE, che vivono su altri thread, e
# chiude la pagina prima che il lavoro sia finito. Questo script fa la cosa giusta
# senza che ogni volta si debba ricordare come.
#
# Tutto resta su 127.0.0.1: niente esce da questa macchina. Le prove spengono lo
# STUN di proposito, così non si contatta nemmeno il server di Google.
#
# Variabili utili: PORTA=8765, CHROME=chromium, HEADLESS=--headless

set -u
QUI="$(cd "$(dirname "$0")" && pwd)"
PORTA="${PORTA:-8765}"
CHROME="${CHROME:-}"
HEADLESS="${HEADLESS:---headless=new}"
PROFILI="${TMPDIR:-/tmp}/bsapp/profili"
STATO="${TMPDIR:-/tmp}/bsapp/stato"
BASE="http://127.0.0.1:$PORTA"

COSA="${1:-tutte}"
Tieni=0
for a in "$@"; do [ "$a" = "--tieni" ] && Tieni=1; done

# --- il browser ------------------------------------------------------------

if [ -z "$CHROME" ]; then
  for c in google-chrome google-chrome-stable chromium chromium-browser brave-browser; do
    if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
  done
fi
if [ -z "$CHROME" ]; then
  echo "Nessun browser trovato. Indicane uno:  CHROME=chromium ./prove.sh" >&2
  exit 2
fi

# --- il server -------------------------------------------------------------

PIDS=()
pulisci() {
  for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null; done
}
trap 'if [ "$Tieni" = 0 ]; then pulisci; fi' EXIT

if curl -s -o /dev/null --max-time 1 "$BASE/" 2>/dev/null; then
  echo "  Un server risponde già su $BASE — uso quello (non l'ho avviato io, non lo spengo)."
  Mio=0
else
  Mio=1
  mkdir -p "$STATO"
  python3 "$QUI/app/prove/server.py" "$PORTA" > "${TMPDIR:-/tmp}/bsapp/server.log" 2>&1 &
  PIDS+=("$!")
  for _ in $(seq 1 40); do
    curl -s -o /dev/null --max-time 1 "$BASE/index.html" && break
    sleep 0.25
  done
  if ! curl -s -o /dev/null --max-time 1 "$BASE/index.html"; then
    echo "Il server non risponde su $BASE. Vedi ${TMPDIR:-/tmp}/bsapp/server.log" >&2
    exit 2
  fi
  echo "  Server su $BASE (avviato da qui)."
fi

mkdir -p "$PROFILI" "$STATO"
curl -s "$BASE/api/azzera" > /dev/null

# --- attrezzi --------------------------------------------------------------

# Aspetta che una pagina di prova abbia depositato il suo esito.
# Si guarda il file, non il tempo: una prova che finisce in due secondi non deve
# far aspettare un minuto, e una lenta non deve essere dichiarata fallita.
attendi() {
  local file="$1" secondi="$2" inizio
  inizio=$(date +%s)
  while [ ! -s "$file" ]; do
    [ $(( $(date +%s) - inizio )) -gt "$secondi" ] && return 1
    sleep 0.5
  done
  return 0
}

apri() {   # apri <ruolo> <indirizzo>
  local ruolo="$1" url="$2"
  rm -rf "$PROFILI/$ruolo"
  mkdir -p "$PROFILI/$ruolo"
  "$CHROME" $HEADLESS --disable-gpu --no-sandbox --no-first-run \
    --user-data-dir="$PROFILI/$ruolo" "$url" > "${TMPDIR:-/tmp}/bsapp/$ruolo.log" 2>&1 &
  PIDS+=("$!")
}

# Aspetta che uno dei due browser abbia depositato un codice sul banco.
# Si guarda il *codice*, non l'esito: chi invita deposita l'invito e poi aspetta,
# e senza l'altro resterebbe in attesa per sempre — aspettarne l'esito sarebbe
# aspettare un file che non arriverà mai.
attendi_codice() {   # attendi_codice <nome> <secondi>
  local nome="$1" secondi="$2" inizio valore
  inizio=$(date +%s)
  while :; do
    valore=$(curl -s --max-time 2 "$BASE/api/$nome" 2>/dev/null \
      | python3 -c 'import sys,json; print(json.load(sys.stdin).get("valore") or "")' \
      2>/dev/null)
    [ -n "$valore" ] && return 0
    [ $(( $(date +%s) - inizio )) -gt "$secondi" ] && return 1
    sleep 0.5
  done
}

riporta() {   # riporta <file-esito> <titolo>
  python3 - "$1" "$2" <<'PY'
import json, sys, pathlib
p, titolo = pathlib.Path(sys.argv[1]), sys.argv[2]
if not p.exists() or not p.stat().st_size:
    print(f"  {titolo}: NESSUN ESITO (la pagina non ha depositato niente)")
    sys.exit(3)
d = json.loads(p.read_text(encoding="utf-8"))
ko = [r for r in d.get("righe", []) if isinstance(r, dict) and r.get("esito") is False]
if "falliti" in d:
    print(f"  {titolo}: {d['passati']} passati, {d['falliti']} falliti")
elif "controlli" in d:
    print(f"  {titolo}: {d.get('testo')} (controlli falliti: {d['controlli']})")
else:
    print(f"  {titolo}: {d.get('testo', 'depositato')}")
for r in ko:
    print(f"      NO  {r['testo']}")
sys.exit(1 if ko or d.get("controlli") or d.get("falliti") else 0)
PY
}

FALLITI=""
fallito() { FALLITI="$FALLITI $1"; }
fare() { [ "$COSA" = "tutte" ] || [ "$COSA" = "$1" ]; }

# --- le prove --------------------------------------------------------------

if fare m0; then
  echo
  echo "── m0: le fondamenta (senza rete) ────────────────────────"
  rm -f "$STATO/m0.json"
  apri m0 "$BASE/prove/m0.html"
  if attendi "$STATO/m0.json" 60; then riporta "$STATO/m0.json" "m0" || fallito m0
  else echo "  m0: scaduto"; fallito m0; fi
fi

if fare avvio; then
  echo
  echo "── avvio: l'applicazione si accende ──────────────────────"
  rm -f "$STATO/avvio.json"
  apri avvio "$BASE/prove/avvio.html"
  if attendi "$STATO/avvio.json" 90; then riporta "$STATO/avvio.json" "avvio" || fallito avvio
  else echo "  avvio: scaduto"; fallito avvio; fi
fi

if fare collegamento; then
  echo
  echo "── collegamento: due browser veri che si parlano ─────────"
  rm -f "$STATO/esito-A.json" "$STATO/esito-B.json"
  echo "  Si scambiano i codici attraverso $BASE, che qui fa la parte di WhatsApp."
  apri A "$BASE/prove/collegamento.html?ruolo=A"
  if attendi_codice invito 40; then
    apri B "$BASE/prove/collegamento.html?ruolo=B"
    attendi "$STATO/esito-A.json" 120
    attendi "$STATO/esito-B.json" 120
    riporta "$STATO/esito-A.json" "A" || fallito collegamento-A
    riporta "$STATO/esito-B.json" "B" || fallito collegamento-B
  else
    echo "  A non ha depositato l'invito: niente da provare."
    fallito collegamento-A
  fi
fi

# --- verdetto --------------------------------------------------------------

echo
echo "══════════════════════════════════════════════════════════"
if [ -z "$FALLITI" ]; then
  echo "  TUTTO PASSATO"
else
  echo "  FALLITO:$FALLITI"
fi
echo "  Esiti e profili in: ${TMPDIR:-/tmp}/bsapp"
[ "$Tieni" = 1 ] && echo "  (--tieni: il server resta acceso e i profili restano sul disco)"
echo "══════════════════════════════════════════════════════════"

[ -z "$FALLITI" ]
