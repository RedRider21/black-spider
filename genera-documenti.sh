#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Daniele Deplano (RedRider21)
#
# Genera i documenti del sito dai loro .md: ARCHITETTURA, i README, gli esiti
# delle prove.
#
#     ./genera-documenti.sh
#     PANDOC=/percorso/pandoc ./genera-documenti.sh
#
# Perché esiste. Il markdown è la fonte — è quello che si scrive, quello che si
# legge su GitHub, quello che sta nel repo. Ma un browser non lo sa leggere:
# Pages lo serve come `text/markdown` e chi ci arriva si trova il testo grezzo.
# Qui si ricava l'HTML che si può leggere, e lo si ricava **ogni volta**: il
# documento pubblicato non può invecchiare, perché nasce a ogni pubblicazione.
#
# Dove finisce quello che genera. Accanto al .md, con lo stesso nome e `.html`.
# Non sta nel repo (è escluso localmente in `.git/info/exclude`) e non serve
# committarlo: lo rigenera il workflow a ogni push, dentro la copia che pubblica.
#
# Serve pandoc e serve Python 3. Se pandoc non c'è, lo dice e si ferma:
#   sudo apt install pandoc      (oppure: https://pandoc.org/installing.html)

set -eu

QUI=$(cd "$(dirname "$0")" && pwd)
PANDOC="${PANDOC:-pandoc}"
TESTATA="$QUI/.github/pandoc/testata.html"
SISTEMA="$QUI/.github/pandoc/sistema.py"

if ! command -v "$PANDOC" >/dev/null 2>&1; then
  echo "Manca pandoc. Installalo (sudo apt install pandoc) o indicalo con PANDOC=/percorso/pandoc." >&2
  exit 1
fi

if [ ! -f "$TESTATA" ] || [ ! -f "$SISTEMA" ]; then
  echo "Mancano i pezzi della generazione in .github/pandoc/." >&2
  exit 1
fi

echo "Genero i documenti con $("$PANDOC" --version | head -1)"

# `--no-highlight` funziona da sempre, ma da pandoc 3.1 è deprecato: chi lo usa
# si vede stampare un avvertimento a ogni documento. Il nome nuovo è
# `--syntax-highlighting=none`. Si chiede a pandoc quale conosce, invece di
# scegliere per lui: le macchine qui intorno non hanno tutte la stessa versione.
SENZA_EVIDENZIAZIONE="--no-highlight"
if "$PANDOC" --help 2>/dev/null | grep -q -- '--syntax-highlighting'; then
  SENZA_EVIDENZIAZIONE="--syntax-highlighting=none"
fi

while IFS='|' read -r documento titolo prima; do
  [ -n "$documento" ] || continue
  sorgente="$QUI/$documento"
  if [ ! -f "$sorgente" ]; then
    echo "  salto $documento: non c'è" >&2
    continue
  fi
  uscita="${sorgente%.md}.html"

  # Il titolo NON si passa come metadato: pandoc lo stamperebbe anche in cima al
  # documento, dove il titolo c'è già. Lo mette a posto sistema.py.
  # `-V lang=it` invece serve: senza, la pagina dichiara `<html lang="">`, e un
  # lettore di schermo non sa in che lingua sta leggendo (i documenti sono in
  # italiano, anche quando parlano di codice in inglese).
  # Niente evidenziazione (`--no-highlight`): pandoc colorerebbe la sintassi con colori fissi da tema
  # chiaro — verde scuro e rosso scuro — che sul fondo scuro del sito non si
  # leggono. Meglio un codice monocromo, che si legge in tutti e due i temi ed è
  # anche quello che ci si aspetta da un'interfaccia piatta.
  #
  # `prima` è un pezzo di HTML da mettere in testa al documento, e c'è solo per
  # ARCHITETTURA: è il rimando all'indice dei riferimenti, che è da dove ci si
  # arriva. Sta in .github/pandoc/ insieme al resto della generazione.
  if [ -n "$prima" ]; then
    "$PANDOC" "$sorgente" \
        --from=gfm --to=html5 --standalone -V lang=it \
        "$SENZA_EVIDENZIAZIONE" \
        --include-in-header="$TESTATA" \
        --include-before-body="$QUI/.github/pandoc/$prima" \
        --output="$uscita"
  else
    "$PANDOC" "$sorgente" \
        --from=gfm --to=html5 --standalone -V lang=it \
        "$SENZA_EVIDENZIAZIONE" \
        --include-in-header="$TESTATA" \
        --output="$uscita"
  fi

  python3 "$SISTEMA" "$uscita" "$titolo"
  echo "  $documento → ${uscita#"$QUI"/}"
done <<'DOCUMENTI'
ARCHITETTURA.md|Black Spider — Architettura|nav-root.html
README.md|Black Spider — la porta d'ingresso|
app/README.md|Black Spider — l'applicazione|
spikes/README.md|M0.5 — le prove che vengono prima del codice|
spikes/esiti/2026-09-29-automatiche.md|Esiti delle prove automatiche — 2026-09-29|
DOCUMENTI

echo "Fatto."
