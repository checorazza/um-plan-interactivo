"""Carga una carrera de DEMO para poder ver la malla funcionando.

No son los datos reales: los códigos y las correlativas salen del plan de
Ingeniería en Informática, pero **los créditos de cada materia están
inventados**, porque el PDF no se pudo extraer de forma confiable. Los planes
reales se cargan en la fase 7, con `seed.py` y los JSON de `backend/seeds/`.

Uso, desde backend/:
    .venv/Scripts/python.exe scripts/seed_demo.py
    .venv/Scripts/python.exe scripts/seed_demo.py --borrar
"""

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from src.factory import create_app  # noqa: E402
from src.models import Anio, Carrera, Materia, db  # noqa: E402

NOMBRE = 'Ingeniería en Informática (demo)'

# Créditos requeridos por año, confirmados para los planes de la UM.
CREDITOS_REQUERIDOS = {1: 0, 2: 12, 3: 38, 4: 90, 5: 130}

# (código, nombre, créditos, año, semestre, códigos de correlativas)
MATERIAS = [
    ('0001', 'Tecnología, Ciencia y Sociedad', 3, 1, '1', []),
    ('0002', 'Química General', 4, 1, '1', []),
    ('CP00', 'Precálculo', 6, 1, '1', []),
    ('0005', 'Sistemas de Representación', 3, 1, '2', []),
    ('0007', 'Álgebra y Geometría Analítica', 5, 1, '2', []),
    ('0009', 'Informática', 7, 1, 'anual', []),
    ('0003', 'Cálculo I', 3, 2, '1', ['CP00']),
    ('2020', 'Física', 5, 2, '1', ['CP00']),
    ('2025', 'Análisis de Sistemas I', 4, 2, '1', []),
    ('2027', 'Álgebra Lineal', 3, 2, '2', ['0007']),
    ('2040', 'Diseño de Base de Datos I', 5, 2, '2', []),
    ('2028', 'Computación', 6, 2, 'anual', ['0009']),
    ('0004', 'Cálculo II', 6, 3, '1', ['0003']),
    ('2030', 'Análisis Numérico', 5, 3, '1', ['2027']),
    ('2031', 'Análisis de Sistemas II', 4, 3, '1', ['2025']),
    ('2054', 'Diseño de Base de Datos II', 5, 3, '2', ['2040']),
    ('2034', 'Programación I', 4, 3, '2', ['2028']),
    ('2036', 'Diseño de Sistemas', 5, 3, '2', ['2031']),
    ('2041', 'Ingeniería de Software', 5, 4, '1', ['2036']),
    ('2049', 'Programación II', 6, 4, 'anual', ['2034']),
]


def borrar(app):
    carrera = Carrera.query.filter_by(nombre=NOMBRE).first()
    if carrera is None:
        print('No había carrera de demo.')
        return
    db.session.delete(carrera)
    db.session.commit()
    print(f'Borrada: {NOMBRE}')


def cargar(app):
    if Carrera.query.filter_by(nombre=NOMBRE).first():
        print(f'Ya existe "{NOMBRE}". Corré con --borrar primero.')
        return

    carrera = Carrera(nombre=NOMBRE)
    db.session.add(carrera)
    db.session.flush()

    numeros = sorted({m[3] for m in MATERIAS})
    anios = {}
    for numero in numeros:
        anio = Anio(
            numero=numero,
            creditos_requeridos=CREDITOS_REQUERIDOS[numero],
            id_carrera=carrera.id_carrera,
        )
        db.session.add(anio)
        anios[numero] = anio
    db.session.flush()

    por_codigo = {}
    for codigo, nombre, creditos, numero, semestre, _ in MATERIAS:
        materia = Materia(
            codigo=codigo,
            nombre=nombre,
            creditos=creditos,
            semestre=semestre,
            id_anio=anios[numero].id_anio,
        )
        db.session.add(materia)
        por_codigo[codigo] = materia
    db.session.flush()

    for codigo, _, _, _, _, correlativas in MATERIAS:
        faltantes = [c for c in correlativas if c not in por_codigo]
        if faltantes:
            raise SystemExit(
                f'{codigo}: correlativas inexistentes: {", ".join(faltantes)}'
            )
        por_codigo[codigo].correlativas = [por_codigo[c] for c in correlativas]

    db.session.commit()

    total = sum(m[2] for m in MATERIAS)
    print(f'Cargada "{NOMBRE}": {len(MATERIAS)} materias, {total} créditos.')
    for numero in numeros:
        del_anio = [m for m in MATERIAS if m[3] == numero]
        print(
            f'  {numero}º año: {len(del_anio)} materias, '
            f'requiere {CREDITOS_REQUERIDOS[numero]} créditos'
        )


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        if '--borrar' in sys.argv:
            borrar(app)
        else:
            cargar(app)
