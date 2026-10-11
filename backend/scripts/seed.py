"""Carga los planes de estudio de `backend/seeds/` en la base.

Los JSON los genera `extraer_planes.py` desde los PDF. Este script sólo los
mete en la base: valida primero, carga después, y agrupa las básicas al final.

Es idempotente por carrera: si la carrera ya existe se saltea, salvo
`--actualizar`, que la pone al día **sin borrarla**.

Esa distinción importa. Borrar una carrera se lleva en cascada sus materias y,
con ellas, los `estado_materia` de todos los usuarios: corregir una errata de
un plan borraría el progreso de todo el mundo. `--actualizar` modifica las
materias existentes en su lugar, buscándolas por código, así que los ids —y
los estados que cuelgan de ellos— sobreviven.

Uso, desde backend/:
    .venv/Scripts/python.exe scripts/seed.py                  # validar nomás
    .venv/Scripts/python.exe scripts/seed.py --cargar
    .venv/Scripts/python.exe scripts/seed.py --cargar --actualizar
"""

import glob
import json
import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from src.domain.correlativas import (  # noqa: E402
    CorrelativaInvalida,
    validar_correlativas,
)
from src.factory import create_app  # noqa: E402
from src.models import Anio, Carrera, Materia, db  # noqa: E402
from src.models.materia import SEMESTRES  # noqa: E402
from src.services.agrupar_basicas import analizar, aplicar  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEEDS = os.path.join(BASE, 'seeds')


def validar(plan, archivo):
    """Todo lo que haría fallar la carga, junto, antes de tocar la base."""
    errores = []
    codigos = [m['codigo'] for m in plan['materias']]

    for codigo in sorted({c for c in codigos if codigos.count(c) > 1}):
        errores.append(f'{archivo}: código repetido {codigo}')

    conocidos = set(codigos)
    for materia in plan['materias']:
        if materia['semestre'] not in SEMESTRES:
            errores.append(
                f'{archivo}: {materia["codigo"]} tiene semestre '
                f'{materia["semestre"]!r}'
            )
        for correlativa in materia['correlativas']:
            if correlativa not in conocidos:
                errores.append(
                    f'{archivo}: {materia["codigo"]} pide {correlativa}, '
                    'que no está en el plan'
                )

    # Ciclos: el mismo guard que usa la API, pero sobre el JSON y antes de
    # escribir nada. Un ciclo dejaría materias imposibles de aprobar.
    requisitos = {m['codigo']: m['correlativas'] for m in plan['materias']}
    for codigo, correlativas in requisitos.items():
        try:
            validar_correlativas(codigo, correlativas, lambda c: requisitos.get(c, []))
        except CorrelativaInvalida as error:
            errores.append(f'{archivo}: {error}')

    return errores


def cargar(plan):
    carrera = Carrera(nombre=plan['carrera'])
    db.session.add(carrera)
    db.session.flush()

    anios = {}
    for datos in plan['anios']:
        anio = Anio(
            numero=datos['numero'],
            creditos_requeridos=datos['creditos_requeridos'],
            id_carrera=carrera.id_carrera,
        )
        db.session.add(anio)
        anios[datos['numero']] = anio
    db.session.flush()

    por_codigo = {}
    for datos in plan['materias']:
        materia = Materia(
            codigo=datos['codigo'],
            nombre=datos['nombre'],
            creditos=datos['creditos'],
            semestre=datos['semestre'],
            id_anio=anios[datos['anio']].id_anio,
        )
        db.session.add(materia)
        por_codigo[datos['codigo']] = materia
    db.session.flush()

    for datos in plan['materias']:
        por_codigo[datos['codigo']].correlativas = [
            por_codigo[c] for c in datos['correlativas']
        ]


def actualizar(plan, carrera):
    """Pone una carrera al día sin borrar nada que se pueda conservar.

    Las materias se buscan por código: las que ya están se modifican en su
    lugar, así conservan su id y con él los estados de los usuarios. Sólo se
    borran las que desaparecieron del plan.

    Devuelve `(nuevas, modificadas, borradas)`.
    """
    anios = {a.numero: a for a in carrera.anios}
    for datos in plan['anios']:
        anio = anios.get(datos['numero'])
        if anio is None:
            anio = Anio(numero=datos['numero'], id_carrera=carrera.id_carrera)
            db.session.add(anio)
            anios[datos['numero']] = anio
        anio.creditos_requeridos = datos['creditos_requeridos']
    db.session.flush()

    existentes = {
        m.codigo: m for a in carrera.anios for m in a.materias
    }
    por_codigo = {}
    nuevas = modificadas = 0

    for datos in plan['materias']:
        materia = existentes.get(datos['codigo'])
        if materia is None:
            materia = Materia(codigo=datos['codigo'])
            db.session.add(materia)
            nuevas += 1
        else:
            modificadas += 1

        materia.nombre = datos['nombre']
        materia.creditos = datos['creditos']
        materia.semestre = datos['semestre']
        materia.id_anio = anios[datos['anio']].id_anio
        por_codigo[datos['codigo']] = materia
    db.session.flush()

    for datos in plan['materias']:
        por_codigo[datos['codigo']].correlativas = [
            por_codigo[c] for c in datos['correlativas']
        ]

    # Las que ya no están en el plan sí se van, con sus estados: la materia
    # dejó de existir.
    sobrantes = [m for c, m in existentes.items() if c not in por_codigo]
    for materia in sobrantes:
        db.session.delete(materia)

    return nuevas, modificadas, len(sobrantes)


def main():
    hay_que_cargar = '--cargar' in sys.argv
    poner_al_dia = '--actualizar' in sys.argv

    archivos = sorted(glob.glob(os.path.join(SEEDS, '*.json')))
    if not archivos:
        raise SystemExit(f'No hay JSON en {SEEDS}. Corré extraer_planes.py primero.')

    planes = []
    errores = []
    for ruta in archivos:
        archivo = os.path.basename(ruta)
        with open(ruta, encoding='utf-8') as f:
            plan = json.load(f)
        planes.append(plan)
        errores.extend(validar(plan, archivo))

    if errores:
        print('No se cargó nada. Hay que arreglar esto primero:')
        for error in errores:
            print(f'  {error}')
        raise SystemExit(1)

    total = sum(len(p['materias']) for p in planes)
    print(f'{len(planes)} planes válidos, {total} materias.')

    if not hay_que_cargar:
        print('Nada se escribió. Volvé a correr con --cargar.')
        return

    app = create_app()
    with app.app_context():
        for plan in planes:
            existente = Carrera.query.filter_by(nombre=plan['carrera']).first()
            if existente is not None:
                if not poner_al_dia:
                    print(f'  ya existe, se saltea: {plan["carrera"]}')
                    continue
                nuevas, modificadas, borradas = actualizar(plan, existente)
                print(
                    f'  al día: {plan["carrera"]} '
                    f'({modificadas} actualizadas, {nuevas} nuevas, '
                    f'{borradas} borradas)'
                )
                continue

            cargar(plan)
            print(f'  cargada: {plan["carrera"]} ({len(plan["materias"])} materias)')

        grupos, dudosos = analizar()
        creadas, enlazadas = aplicar(grupos)
        db.session.commit()

        print(f'\nBásicas: {creadas} grupos nuevos, {enlazadas} materias enlazadas.')
        if dudosos:
            print(f'{len(dudosos)} códigos compartidos con nombres distintos, SIN agrupar:')
            for dudoso in dudosos:
                print(f'  {dudoso["codigo"]:7s} {" / ".join(dudoso["nombres"])}')


if __name__ == '__main__':
    main()
