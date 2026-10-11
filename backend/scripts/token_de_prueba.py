"""Crea un usuario de prueba y emite su JWT, para probar el sync sin Google.

Sirve sólo en desarrollo: emite el token firmando con el `JWT_SECRET_KEY` local,
salteando la verificación del ID token de Google. No tiene nada que hacer en
producción.

Uso, desde backend/:
    .venv/Scripts/python.exe scripts/token_de_prueba.py
    .venv/Scripts/python.exe scripts/token_de_prueba.py --admin
"""

import json
import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from flask_jwt_extended import create_access_token  # noqa: E402

from src.factory import create_app  # noqa: E402
from src.models import Usuario, db  # noqa: E402

SUB = 'sub-de-prueba'
EMAIL = 'prueba@example.com'


def main():
    es_admin = '--admin' in sys.argv

    app = create_app()
    with app.app_context():
        usuario = Usuario.query.filter_by(google_sub=SUB).first()
        if usuario is None:
            usuario = Usuario(
                google_sub=SUB,
                email=EMAIL,
                nombre='Usuario de prueba',
                foto_url=None,
            )
            db.session.add(usuario)
        usuario.es_admin = es_admin
        db.session.commit()

        token = create_access_token(identity=str(usuario.id_usuario))

        # Listo para pegar en la consola del navegador.
        print(
            json.dumps(
                {'token': token, 'usuario': usuario.to_json()},
                ensure_ascii=False,
            )
        )


if __name__ == '__main__':
    main()
