"""Corre las migraciones (y opcionalmente el seed) contra la base de producción.

Lee la conexión de `backend/.env.produccion`, que está en el `.gitignore`. La
idea es no tener que pegar la cadena en la consola: queda fuera del historial
del shell y de cualquier transcripción.

Usa la conexión **directa** (`DATABASE_URL_UNPOOLED`) si está, porque Neon la
recomienda para los cambios de esquema: el pooler no los maneja bien.

Para armar el archivo: en Vercel → Storage → la base → Quickstart → pestaña
`.env.local` → "Show secret" → "Copy Snippet", y pegar todo en
`backend/.env.produccion`.

Uso, desde backend/:
    .venv/Scripts/python.exe scripts/migrar_produccion.py            # migrar
    .venv/Scripts/python.exe scripts/migrar_produccion.py --con-seed # y cargar planes
"""

import os
import sys

from dotenv import dotenv_values

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCHIVO = os.path.join(BASE, '.env.produccion')

sys.path.insert(0, BASE)


def leer_conexion():
    if not os.path.exists(ARCHIVO):
        raise SystemExit(
            f'No existe {ARCHIVO}.\n'
            'En Vercel: Storage → la base → Quickstart → .env.local →\n'
            '"Show secret" → "Copy Snippet", y pegá todo en ese archivo.'
        )

    valores = dotenv_values(ARCHIVO)
    # La directa primero: es la que Neon recomienda para DDL.
    url = valores.get('DATABASE_URL_UNPOOLED') or valores.get('DATABASE_URL')
    if not url:
        raise SystemExit(
            f'{ARCHIVO} no tiene DATABASE_URL_UNPOOLED ni DATABASE_URL.'
        )

    cual = 'directa' if valores.get('DATABASE_URL_UNPOOLED') else 'pooled'
    # Sin la contraseña ni el usuario: alcanza para saber contra qué se corre.
    host = url.split('@')[-1].split('/')[0] if '@' in url else '?'
    print(f'Conexión {cual} a {host}')
    return url


def main():
    os.environ['DATABASE_URL'] = leer_conexion()
    # El secreto de los JWT no se usa para migrar, pero `create_app` lo exige.
    os.environ.setdefault('JWT_SECRET_KEY', 'x' * 32)

    from flask_migrate import upgrade

    from src.factory import create_app

    app = create_app()
    with app.app_context():
        print('Aplicando migraciones...')
        upgrade()
        print('Migraciones al día.')

        if '--con-seed' in sys.argv:
            from scripts.seed import cargar, validar
            import glob
            import json

            archivos = sorted(glob.glob(os.path.join(BASE, 'seeds', '*.json')))
            planes = []
            errores = []
            for ruta in archivos:
                with open(ruta, encoding='utf-8') as f:
                    plan = json.load(f)
                planes.append(plan)
                errores.extend(validar(plan, os.path.basename(ruta)))

            if errores:
                print('No se cargó nada. Primero hay que arreglar:')
                for error in errores:
                    print(f'  {error}')
                raise SystemExit(1)

            from src.models import Carrera, db
            from src.services.agrupar_basicas import analizar, aplicar

            from scripts.seed import actualizar

            for plan in planes:
                existente = Carrera.query.filter_by(nombre=plan['carrera']).first()
                if existente is not None:
                    # Se actualiza en su lugar: borrar la carrera se llevaría
                    # el progreso de todos los usuarios.
                    nuevas, modificadas, borradas = actualizar(plan, existente)
                    print(
                        f'  al día: {plan["carrera"]} ({modificadas} actualizadas, '
                        f'{nuevas} nuevas, {borradas} borradas)'
                    )
                    continue
                cargar(plan)
                print(f'  cargada: {plan["carrera"]}')

            grupos, dudosos = analizar()
            creadas, enlazadas = aplicar(grupos)
            db.session.commit()
            print(f'Básicas: {creadas} grupos, {enlazadas} materias enlazadas.')


if __name__ == '__main__':
    main()
