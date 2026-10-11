#!/usr/bin/env bash
#
# Levanta la API en local.
#
# Deja el entorno listo antes de arrancar: el venv, las dependencias, el
# `.env`, las migraciones y los planes. Es idempotente, así que correrlo de
# nuevo sobre un proyecto ya armado sólo arranca el servidor.
#
# Uso, desde backend/:
#     ./boot.sh              # dejar todo listo y arrancar
#     ./boot.sh --preparar   # dejar todo listo y salir, sin arrancar
#
# El front en `npm run dev` le pega a 127.0.0.1:5000, así que esto tiene que
# estar corriendo en otra terminal: sin la API, la malla no tiene de dónde
# traer el plan.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

PYTHON=.venv/Scripts/python.exe
[ -f "$PYTHON" ] || PYTHON=.venv/bin/python

if [ ! -d .venv ]; then
    echo "Creando el entorno virtual..."
    python -m venv .venv
fi

if [ -f .venv/Scripts/activate ]; then
    source .venv/Scripts/activate
else
    source .venv/bin/activate
fi

pip install -q -r requirements.txt

# Sin `.env` la app no arranca: `JWT_SECRET_KEY` es obligatoria y tiene que
# tener al menos 32 caracteres. Se arma uno de una vez, con un secreto nuevo,
# en vez de fallar con un error que no dice qué hacer.
if [ ! -f .env ]; then
    echo "No había .env: armando uno a partir de .env-example."
    SECRETO=$("$PYTHON" -c "import secrets; print(secrets.token_urlsafe(32))")
    sed "s|^JWT_SECRET_KEY=$|JWT_SECRET_KEY=$SECRETO|" .env-example > .env
    echo "  JWT_SECRET_KEY generada. GOOGLE_CLIENT_ID queda vacío: el login"
    echo "  con Google queda apagado, el resto de la app anda igual."
fi

flask db upgrade

# Una base al día pero vacía termina en la misma pantalla de error que no
# tener API, así que si no hay ninguna carrera se cargan los planes.
if [ "$("$PYTHON" scripts/contar_carreras.py)" = "0" ]; then
    echo "La base está vacía: cargando los planes de seeds/."
    "$PYTHON" scripts/seed.py --cargar
fi

if [ "${1:-}" = "--preparar" ]; then
    echo "Listo. Arrancá la API con ./boot.sh"
    exit 0
fi

echo "API en http://127.0.0.1:5000 — Ctrl+C para cortar."
"$PYTHON" app.py
