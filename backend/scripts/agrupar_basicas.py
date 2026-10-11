"""Agrupa las materias básicas que ya están cargadas en la base.

Útil después de cargar un plan nuevo: vuelve a mirar todos los códigos y
enlaza los que se repiten entre carreras. Es idempotente.

Los códigos que aparecen en varias carreras con **nombres distintos** no se
agrupan: se listan para que una persona decida. En los planes de la UM pasa al
menos con el 5044.

Uso, desde backend/:
    .venv/Scripts/python.exe scripts/agrupar_basicas.py          # sólo informa
    .venv/Scripts/python.exe scripts/agrupar_basicas.py --aplicar
"""

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from src.factory import create_app  # noqa: E402
from src.models import db  # noqa: E402
from src.services.agrupar_basicas import analizar, aplicar  # noqa: E402


def main():
    aplicar_cambios = '--aplicar' in sys.argv

    app = create_app()
    with app.app_context():
        grupos, dudosos = analizar()

        print(f'{len(grupos)} básicas detectadas:')
        for codigo in sorted(grupos):
            cuantas = len(grupos[codigo]['materias'])
            print(f'  {codigo:7s} {grupos[codigo]["nombre"]} ({cuantas} carreras)')

        if dudosos:
            print()
            print(f'{len(dudosos)} códigos con nombres distintos, SIN agrupar:')
            for dudoso in dudosos:
                print(f'  {dudoso["codigo"]:7s} {" / ".join(dudoso["nombres"])}')
            print('  Revisalos: o son la misma materia mal escrita, o son dos')
            print('  materias distintas que comparten código.')

        if not aplicar_cambios:
            print()
            print('Nada se escribió. Volvé a correr con --aplicar.')
            return

        creadas, enlazadas = aplicar(grupos)
        db.session.commit()
        print()
        print(f'Listo: {creadas} grupos nuevos, {enlazadas} materias enlazadas.')


if __name__ == '__main__':
    main()
