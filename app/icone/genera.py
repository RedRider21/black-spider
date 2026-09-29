#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Daniele Deplano (RedRider21)
"""Genera le icone di Black Spider.

Disegnate qui invece che in un programma di grafica perché restino riproducibili:
cambiare una costante e rilanciare è più onesto che ritoccare un PNG a mano e
perderne la ricetta.

Niente librerie. Tutto il disegno è:
  - una maschera del ragno, rasterizzata a risoluzione tripla con le zampe
    depositate come dischi di raggio calante lungo la curva;
  - un alone, che è quella maschera ridotta e sfocata tre volte;
  - una composizione ai pixel finali, dove il bordo della sagoma si arrotonda
    contando quanti dei 3x3 sottocampionamenti cadono dentro.

Uso:  python3 genera.py
"""

import math
import struct
import zlib
from array import array
from pathlib import Path

QUI = Path(__file__).resolve().parent
SCALA = 3                      # sottocampionamento per lato

# --- tavolozza ---------------------------------------------------------------
FONDO_ALTO = (0.088, 0.095, 0.180)     # viola-blu profondo, in alto
FONDO_BASSO = (0.030, 0.032, 0.052)    # quasi nero, in basso
ACCENTO = (0.45, 0.38, 1.00)           # per l'alone
RAGNO = (0.945, 0.950, 0.980)          # bianco appena freddo

# --- geometria del ragno -----------------------------------------------------
# Tutto in frazioni di lato, riferite al centro. Il disegno viene poi spostato
# di poco verso l'alto: l'addome pesa in basso e senza questa correzione il ragno
# sembra cadere dentro la cornice.

SPOSTA_Y = -0.015

# Testa e addome si toccano appena: la strozzatura fra i due è quello che rende
# la sagoma leggibile come ragno anche a 32 pixel, dove un corpo unico
# sembrerebbe soltanto un uovo.
CEFALOTORACE = (0.0, -0.150, 0.070)            # cx, cy, raggio
COLLO = (0.0, -0.078, 0.030, 0.022)            # cx, cy, rx, ry
ADDOME = (0.0, 0.040, 0.112, 0.150)            # cx, cy, rx, ry

# Le quattro zampe di destra: (attacco, controllo, punta). Il controllo è il
# "ginocchio": allontanandolo dalla linea attacco-punta la zampa si piega, ed è
# quella piega a dire "ragno" invece di "ruota di bicicletta".
# Gli attacchi stanno tutti sul cefalotorace, come in un ragno vero: è da lì che
# parte il groviglio di zampe, non dall'addome.
ZAMPE = [
    ((0.036, -0.196), (0.170, -0.345), (0.320, -0.290)),
    ((0.044, -0.160), (0.245, -0.245), (0.400, -0.130)),
    ((0.046, -0.124), (0.258, -0.010), (0.420,  0.075)),
    ((0.034, -0.088), (0.212,  0.140), (0.305,  0.310)),
]

SPESSORE_BASE = 0.0260         # raggio della zampa all'attacco
SPESSORE_PUNTA = 0.0085        # raggio alla punta


# --- PNG ---------------------------------------------------------------------

def scrivi_png(percorso, lato, pixel):
    righe = b''.join(b'\x00' + bytes(pixel[y]) for y in range(lato))

    def blocco(tipo, dati):
        corpo = tipo + dati
        return (struct.pack('>I', len(dati)) + corpo
                + struct.pack('>I', zlib.crc32(corpo) & 0xffffffff))

    png = (b'\x89PNG\r\n\x1a\n'
           + blocco(b'IHDR', struct.pack('>IIBBBBB', lato, lato, 8, 6, 0, 0, 0))
           + blocco(b'IDAT', zlib.compress(righe, 9))
           + blocco(b'IEND', b''))
    Path(percorso).write_bytes(png)


# --- geometria ---------------------------------------------------------------

def su_bezier(p0, p1, p2, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])


def disco(mask, S, cx, cy, r, alfa=1.0):
    """Deposita un disco morbido: sul bordo l'opacità cala di un pixel, che è
    quanto basta perché la maschera ridotta non mostri scalini."""
    if r <= 0:
        return
    ri = int(r) + 1
    x0, x1 = max(0, int(cx) - ri), min(S - 1, int(cx) + ri)
    y0, y1 = max(0, int(cy) - ri), min(S - 1, int(cy) + ri)
    for y in range(y0, y1 + 1):
        dy = y - cy
        if abs(dy) > r:
            continue
        base = y * S
        for x in range(x0, x1 + 1):
            dx = x - cx
            d2 = dx * dx + dy * dy
            if d2 > r * r:
                continue
            a = min(alfa, r - math.sqrt(d2) + 0.5)
            if a > mask[base + x]:
                mask[base + x] = a


def ellisse(mask, S, cx, cy, rx, ry):
    x0, x1 = max(0, int(cx - rx) - 1), min(S - 1, int(cx + rx) + 1)
    y0, y1 = max(0, int(cy - ry) - 1), min(S - 1, int(cy + ry) + 1)
    fine = min(rx, ry) * 0.9
    for y in range(y0, y1 + 1):
        dy = (y - cy) / ry
        base = y * S
        for x in range(x0, x1 + 1):
            dx = (x - cx) / rx
            e = dx * dx + dy * dy
            if e >= 1.0:
                continue
            a = min(1.0, (1.0 - e) * fine)
            if a > mask[base + x]:
                mask[base + x] = a


def maschera_ragno(S, scala):
    """Il ragno su fondo trasparente, a risoluzione S."""
    mask = array('f', bytes(4 * S * S))
    c = S / 2.0

    def P(p):
        return (c + p[0] * S * scala, c + (p[1] + SPOSTA_Y) * S * scala)

    for verso in (1, -1):
        for (a, b, d) in ZAMPE:
            A = P((a[0] * verso, a[1]))
            B = P((b[0] * verso, b[1]))
            D = P((d[0] * verso, d[1]))
            # Passo proporzionale al raggio: più fitto dove la zampa è grossa,
            # rado verso la punta, senza lasciare buchi fra un disco e l'altro.
            passi = max(8, int(S * scala * 0.75))
            for i in range(passi + 1):
                t = i / passi
                x, y = su_bezier(A, B, D, t)
                r = (SPESSORE_BASE * (1 - t) + SPESSORE_PUNTA * t) * S * scala
                disco(mask, S, x, y, r)

    cx, cy, r = CEFALOTORACE
    ellisse(mask, S, c + cx * S * scala, c + (cy + SPOSTA_Y) * S * scala,
            r * S * scala, r * S * scala)
    cx, cy, rx, ry = COLLO
    ellisse(mask, S, c + cx * S * scala, c + (cy + SPOSTA_Y) * S * scala,
            rx * S * scala, ry * S * scala)
    cx, cy, rx, ry = ADDOME
    ellisse(mask, S, c + cx * S * scala, c + (cy + SPOSTA_Y) * S * scala,
            rx * S * scala, ry * S * scala)
    return mask


# --- filtri ------------------------------------------------------------------

def riduci(mask, S, lato):
    """Maschera grande → copertura per pixel finale (media dei sottocampionamenti)."""
    piccola = [0.0] * (lato * lato)
    n = SCALA * SCALA
    for y in range(lato):
        base = y * lato
        for dy in range(SCALA):
            mb = (y * SCALA + dy) * S
            for x in range(lato):
                s = 0.0
                bx = mb + x * SCALA
                for dx in range(SCALA):
                    s += mask[bx + dx]
                piccola[base + x] += s / n
    return piccola


def sfoca(src, lato, r, passate=3):
    """Sfocatura a finestra separabile: tre passate valgono quasi a una gaussiana
    e costano O(n) invece di O(n·r)."""
    cur = src
    larghezza = 2 * r + 1
    for _ in range(passate):
        tmp = [0.0] * (lato * lato)
        for y in range(lato):
            base = y * lato
            somma = 0.0
            for k in range(-r, r + 1):
                somma += cur[base + min(lato - 1, max(0, k))]
            for x in range(lato):
                tmp[base + x] = somma / larghezza
                somma += (cur[base + min(lato - 1, x + r + 1)]
                          - cur[base + min(lato - 1, max(0, x - r))])
        out = [0.0] * (lato * lato)
        for x in range(lato):
            somma = 0.0
            for k in range(-r, r + 1):
                somma += tmp[min(lato - 1, max(0, k)) * lato + x]
            for y in range(lato):
                out[y * lato + x] = somma / larghezza
                somma += (tmp[min(lato - 1, y + r + 1) * lato + x]
                          - tmp[min(lato - 1, max(0, y - r)) * lato + x])
        cur = out
    return cur


# --- disegno -----------------------------------------------------------------

def disegna(lato, contenuto=1.0, sagoma=True):
    """Pixel RGBA dell'icona.

    `contenuto` rimpicciolisce il ragno: per le icone maskable, dove il sistema
    ritaglia a piacere e il disegno deve stare nella zona sicura.
    `sagoma=False` riempie tutto il quadrato, come vogliono le icone che il
    sistema maschera da sé (maskable, apple-touch-icon).
    """
    S = lato * SCALA
    c = S / 2.0
    n = 4.3
    raggio = S * 0.5

    mask = maschera_ragno(S, contenuto)
    copertura = riduci(mask, S, lato)
    alone = sfoca(copertura, lato, max(2, int(lato * 0.030)), 2)

    # La superellisse è separabile: x^n + y^n dipende da x e da y
    # indipendentemente, quindi si precalcola una volta per asse.
    se = [(abs(i - c + 0.5) / raggio) ** n for i in range(S)]

    out = []
    for y in range(lato):
        riga = bytearray()
        for x in range(lato):
            # copertura della sagoma, contando i sottocampionamenti interni
            dentro = 0
            if sagoma:
                for dy in range(SCALA):
                    sy = se[y * SCALA + dy]
                    for dx in range(SCALA):
                        if sy + se[x * SCALA + dx] <= 1.0:
                            dentro += 1
                if dentro == 0:
                    riga += bytes(4)
                    continue
                alfa_bordo = dentro / (SCALA * SCALA)
            else:
                alfa_bordo = 1.0

            u = y / lato
            col = [FONDO_ALTO[k] + (FONDO_BASSO[k] - FONDO_ALTO[k]) * (u ** 0.85)
                   for k in range(3)]
            # luce dall'alto a sinistra: dà volume al fondo senza schiarirlo
            d = math.hypot(x - lato * 0.34, y - lato * 0.16) / (lato * 0.78)
            luce = max(0.0, 1.0 - d) ** 2 * 0.09
            # Un filo di alone attorno al ragno: quanto basta a staccarlo dal
            # fondo. Di più e il ragno diventa una macchia luminosa.
            g = alone[y * lato + x] ** 2 * 0.13
            for k in range(3):
                col[k] = min(1.0, col[k] + luce + g * ACCENTO[k])

            a = copertura[y * lato + x]
            if a > 0:
                # Il ragno è chiaro in alto e appena più spento in basso: sono
                # pochi punti di luminanza, ma bastano a non farlo sembrare un
                # ritaglio di carta.
                corpo = 1.0 - 0.17 * max(0.0, (u - 0.42) / 0.58)
                for k in range(3):
                    col[k] = col[k] * (1 - a) + RAGNO[k] * corpo * a

            # vignettatura tenue, per non lasciare gli angoli piatti
            dd = math.hypot(x - lato / 2, y - lato / 2) / (lato * 0.72)
            v = max(0.0, 1.0 - dd * dd * 0.26)
            riga += bytes((int(max(0.0, min(1.0, col[0] * v)) * 255),
                           int(max(0.0, min(1.0, col[1] * v)) * 255),
                           int(max(0.0, min(1.0, col[2] * v)) * 255),
                           int(min(1.0, alfa_bordo) * 255)))
        out.append(riga)
    return out


# --- vettoriale --------------------------------------------------------------

def svg():
    """L'icona in vettoriale, per il segnalibro del browser."""
    def P(p, s=1.0):
        return (50 + p[0] * 100 * s, 50 + (p[1] + SPOSTA_Y) * 100 * s)

    # Perimetro della superellisse, campionato: una <rect rx> sarebbe un'altra curva.
    n = 4.3
    punti = []
    for i in range(240):
        th = 2 * math.pi * i / 240
        ct, st = math.cos(th), math.sin(th)
        x = math.copysign(abs(ct) ** (2 / n), ct) * 50
        y = math.copysign(abs(st) ** (2 / n), st) * 50
        punti.append(f'{50 + x:.2f} {50 + y:.2f}')
    sagoma = 'M' + ' L'.join(punti) + ' Z'

    zampe = ''
    for verso in (1, -1):
        for (a, b, d) in ZAMPE:
            A, B, D = P((a[0] * verso, a[1])), P((b[0] * verso, b[1])), P((d[0] * verso, d[1]))
            # La zampa è un contorno riempito, così può rastremarsi: un tratto
            # di <path> avrebbe spessore costante e sembrerebbe un filo di ferro.
            su, giu = [], []
            passi = 40
            for i in range(passi + 1):
                t = i / passi
                x, y = su_bezier(A, B, D, t)
                px, py = su_bezier(A, B, D, min(1.0, t + 0.01))
                qx, qy = su_bezier(A, B, D, max(0.0, t - 0.01))
                tx, ty = px - qx, py - qy
                lun = math.hypot(tx, ty) or 1.0
                nx, ny = -ty / lun, tx / lun
                r = (SPESSORE_BASE * (1 - t) + SPESSORE_PUNTA * t) * 100
                su.append(f'{x + nx * r:.2f} {y + ny * r:.2f}')
                giu.append(f'{x - nx * r:.2f} {y - ny * r:.2f}')
            zampe += '<path d="M' + ' L'.join(su + giu[::-1]) + ' Z"/>'

    corpi = ''
    for (cx, cy, rx, ry) in (CEFALOTORACE[:2] + (CEFALOTORACE[2], CEFALOTORACE[2]),
                             COLLO, ADDOME):
        x1, y1 = P((cx - rx, cy - ry)); x2, y2 = P((cx + rx, cy + ry))
        corpi += (f'<ellipse cx="{(x1 + x2) / 2:.2f}" cy="{(y1 + y2) / 2:.2f}" '
                  f'rx="{(x2 - x1) / 2:.2f}" ry="{(y2 - y1) / 2:.2f}"/>')

    # Il ragno sta in <defs> senza colore, e i due <use> glielo danno: bianco
    # sopra, viola sfocato sotto. Scriverlo due volte vorrebbe dire disegnarlo
    # due volte, e prima o poi le due copie divergono.
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16182e"/><stop offset="1" stop-color="#08080d"/>
    </linearGradient>
    <clipPath id="sagoma"><path d="{sagoma}"/></clipPath>
    <filter id="alone" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.4"/>
    </filter>
    <g id="ragno">{zampe}{corpi}</g>
  </defs>
  <g clip-path="url(#sagoma)">
    <rect width="100" height="100" fill="url(#fondo)"/>
    <use href="#ragno" fill="#6a5cff" opacity="0.17" filter="url(#alone)"/>
    <use href="#ragno" fill="#f1f2f9"/>
  </g>
</svg>
'''


if __name__ == '__main__':
    # Icone normali: sagoma arrotondata, fuori trasparente.
    for lato in (512, 192, 48, 32):
        scrivi_png(QUI / f'icona-{lato}.png', lato, disegna(lato))
        print(f'icona-{lato}.png')

    # Maskable: pieno bleed, ragno dentro la zona sicura.
    scrivi_png(QUI / 'icona-maskable-512.png', 512,
               disegna(512, contenuto=0.72, sagoma=False))
    print('icona-maskable-512.png')

    # Apple: il sistema arrotonda da sé, quindi quadrata e piena.
    scrivi_png(QUI / 'icona-180.png', 180,
               disegna(180, contenuto=0.88, sagoma=False))
    print('icona-180.png')

    (QUI / 'icona.svg').write_text(svg(), encoding='utf-8')
    print('icona.svg')
