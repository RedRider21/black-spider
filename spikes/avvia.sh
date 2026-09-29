#!/usr/bin/env bash
# Black Spider — banco di prova M0.5.
# Serve le pagine delle prove e basta: nessun backend, nessuna richiesta in uscita.
#
#   ./avvia.sh              solo questa macchina, porta 8080
#   ./avvia.sh 9000         solo questa macchina, porta 9000
#   ./avvia.sh 8080 rete    anche verso la rete locale — per le prove 2 e 4
#
# **Non si apre alla rete locale per difetto.** Un servizio in ascolto su 0.0.0.0
# è una porta aperta verso una rete che quasi sempre non è tua, e le prove 1 e 3
# non ne hanno bisogno: si fanno da qui. Solo la prova 2 (la LAN senza internet) e
# la prova 4 (due dispositivi su reti diverse) richiedono che qualcun altro si
# colleghi, e in quei casi lo si chiede scrivendolo.

set -e
PORT="${1:-8080}"
MODO="${2:-locale}"
cd "$(dirname "$0")"

if [ "$MODO" = "rete" ]; then
  INDIRIZZO="0.0.0.0"
else
  INDIRIZZO="127.0.0.1"
fi

echo
echo "  Black Spider — banco di prova M0.5"
echo "  ────────────────────────────────────────────────"
echo "  Su questa macchina:"
echo "      http://localhost:$PORT/prova-1-invito.html"
echo "      http://localhost:$PORT/prova-3-background.html"

if [ "$MODO" = "rete" ]; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [ -n "$IP" ]; then
    echo "  Da un altro dispositivo della stessa rete:"
    echo "      http://$IP:$PORT/prova-1-invito.html"
    echo
    echo "  In ascolto su tutta la rete locale: chiunque sia su questa rete può"
    echo "  raggiungere queste pagine finché il server è acceso. Ctrl+C quando hai"
    echo "  finito, non lasciarlo acceso."
  fi
fi

echo
echo "  Ctrl+C per fermare."
echo
exec python3 -m http.server "$PORT" --bind "$INDIRIZZO"
