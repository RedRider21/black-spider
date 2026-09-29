#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Daniele Deplano (RedRider21)
"""Rimette a posto quello che pandoc non sa dei nostri documenti.

Due cose sole, e sono due cose che non possono stare nel markdown:

  1. il titolo della scheda. pandoc lo prende dal nome del file — «README»,
     che non dice di cosa — e se glielo si passa come metadato lo stampa
     anche in cima al documento, dove il titolo c'è già;
  2. i rimandi fra documenti. Nel markdown puntano al `.md`, che è giusto per
     chi legge il repo su GitHub (lo rende lui) e sbagliato per chi legge il
     sito pubblicato, dove il `.md` si scarica e il documento è il `.html` che
     abbiamo appena generato.

Uso:

    python3 sistema.py <file.html> <titolo della scheda>
"""

import re
import sys
from pathlib import Path

# I documenti che questo script genera: i rimandi fra loro diventano .html.
# Fuori da questo elenco non si tocca niente — i `.md` delle fonti in
# riferimenti/sorgenti/ restano dove sono, e i loro gemelli .html sono un'altra
# cosa (le pagine salvate dal web, non una conversione).
GENERATI = (
    "ARCHITETTURA.md",
    "README.md",
    "app/README.md",
    "spikes/README.md",
    "spikes/esiti/2026-09-29-automatiche.md",
)


def scappa(testo: str) -> str:
    """Quel poco di HTML che serve, perché il titolo finisce dentro un tag."""
    return testo.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def sistema(percorso: Path, titolo: str) -> None:
    testo = percorso.read_text(encoding="utf-8")

    if "<title>" not in testo:
        raise SystemExit(f"{percorso}: non trovo il <title> da correggere")
    testo = re.sub(r"<title>.*?</title>", f"<title>{scappa(titolo)}</title>",
                   testo, count=1, flags=re.S)

    for documento in GENERATI:
        gemello = documento[: -len(".md")] + ".html"
        # Due cose da lasciare stare: il rimando può portare a un punto preciso
        # del documento (`#ancora`), e può essere scritto con un percorso
        # relativo davanti (`../ARCHITETTURA.md` da dentro `app/`). Il percorso
        # davanti resta quello che è — cambia solo l'estensione.
        testo = re.sub(
            r'href="((?:\.\./|\./)*)' + re.escape(documento) + r'(#[^"]*)?"',
            lambda m: f'href="{m.group(1)}{gemello}{m.group(2) or ""}"',
            testo,
        )

    percorso.write_text(testo, encoding="utf-8")


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip().splitlines()[-1], file=sys.stderr)
        return 2
    sistema(Path(sys.argv[1]), sys.argv[2])
    return 0


if __name__ == "__main__":
    sys.exit(main())
