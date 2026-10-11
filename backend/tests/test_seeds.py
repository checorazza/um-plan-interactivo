"""Chequeos sobre los planes de `backend/seeds/`.

Son datos, no código, pero se rompen igual: los JSON salen de leer PDF con
coordenadas, y un cambio en el extractor puede corromperlos sin que nada falle
hasta que alguien abre la malla. Estos tests son el guard.

No tocan la base: validan los JSON tal como están en el repo.
"""

import glob
import json
import os
import re

import pytest

from src.domain.correlativas import CorrelativaInvalida, validar_correlativas
from src.models.materia import SEMESTRES

SEEDS = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'seeds'
)

ARCHIVOS = sorted(glob.glob(os.path.join(SEEDS, '*.json')))

# Créditos requeridos por año, confirmados para los planes de la UM.
CREDITOS_REQUERIDOS = {1: 0, 2: 12, 3: 38, 4: 90, 5: 130}

# Lo que el PDF dice y parece un error suyo, no de la extracción. Se listan
# acá en vez de corregirlos a mano para que el chequeo siga sirviendo con el
# resto, y para que quede registro de qué hay que preguntarle a la facultad.
RAREZAS_DEL_PDF = {
    # "Organización y gestión de sistemas de salud" (3º) figura pidiendo
    # "Circuitos Digitales II" (4º). No tienen nada que ver entre sí.
    ('Bioingeniería', '5094'),
}


def cargar(ruta):
    with open(ruta, encoding='utf-8') as f:
        return json.load(f)


def nombre_de(ruta):
    return os.path.basename(ruta)


def test_hay_seis_planes():
    assert len(ARCHIVOS) == 6, [nombre_de(r) for r in ARCHIVOS]


@pytest.mark.parametrize('ruta', ARCHIVOS, ids=nombre_de)
class TestPlan:
    def test_tiene_los_cinco_anios(self, ruta):
        plan = cargar(ruta)
        assert [a['numero'] for a in plan['anios']] == [1, 2, 3, 4, 5]

    def test_los_creditos_requeridos_son_los_acordados(self, ruta):
        plan = cargar(ruta)
        for anio in plan['anios']:
            assert anio['creditos_requeridos'] == CREDITOS_REQUERIDOS[anio['numero']]

    def test_tiene_una_cantidad_razonable_de_materias(self, ruta):
        # Los planes de la UM tienen entre 45 y 55 materias. Muy por debajo
        # quiere decir que la extracción se comió filas.
        plan = cargar(ruta)
        assert 40 <= len(plan['materias']) <= 60

    def test_los_codigos_no_se_repiten(self, ruta):
        plan = cargar(ruta)
        codigos = [m['codigo'] for m in plan['materias']]
        repetidos = {c for c in codigos if codigos.count(c) > 1}
        assert repetidos == set()

    def test_las_materias_estan_completas(self, ruta):
        plan = cargar(ruta)
        for materia in plan['materias']:
            assert materia['codigo']
            assert len(materia['nombre']) >= 4
            assert materia['anio'] in CREDITOS_REQUERIDOS
            assert materia['semestre'] in SEMESTRES
            assert materia['creditos'] >= 0

    def test_los_nombres_no_se_comieron_una_correlativa(self, ruta):
        """Un nombre con códigos pegados es la marca de una columna mal leída.

        Pasó de verdad: Bioingeniería separa varias correlativas con barras y
        el nombre quedaba como "Análisis de Señales 1021/1030".
        """
        plan = cargar(ruta)
        for materia in plan['materias']:
            assert '/' not in materia['nombre'], materia
            assert not re.search(r'\b\d{3,4}\b', materia['nombre']), materia

    def test_las_correlativas_existen_en_el_plan(self, ruta):
        plan = cargar(ruta)
        codigos = {m['codigo'] for m in plan['materias']}
        for materia in plan['materias']:
            for correlativa in materia['correlativas']:
                assert correlativa in codigos, (materia['codigo'], correlativa)

    def test_no_hay_ciclos_de_correlativas(self, ruta):
        plan = cargar(ruta)
        requisitos = {m['codigo']: m['correlativas'] for m in plan['materias']}
        for codigo, correlativas in requisitos.items():
            try:
                validar_correlativas(
                    codigo, correlativas, lambda c: requisitos.get(c, [])
                )
            except CorrelativaInvalida as error:
                pytest.fail(str(error))

    def test_una_correlativa_no_viene_de_un_anio_posterior(self, ruta):
        """Un requisito que se cursa después empuja la materia de hecho a ese año.

        No es imposible —el motor de reglas lo soporta— pero casi siempre es
        un error de tipeo del plan, así que conviene enterarse.
        """
        plan = cargar(ruta)
        anio_de = {m['codigo']: m['anio'] for m in plan['materias']}
        for materia in plan['materias']:
            if (plan['carrera'], materia['codigo']) in RAREZAS_DEL_PDF:
                continue
            for correlativa in materia['correlativas']:
                assert anio_de[correlativa] <= materia['anio'], (
                    f'{materia["codigo"]} ({materia["anio"]}º) requiere '
                    f'{correlativa} ({anio_de[correlativa]}º)'
                )


def test_las_basicas_comparten_codigo_entre_planes():
    """Las materias comunes tienen que tener el mismo código en cada plan.

    Si no, `agrupar_basicas` no las junta y aprobar Cálculo I en una carrera
    no cuenta en la otra. Los planes escriben `003` y `0003` indistintamente,
    y por eso el extractor normaliza a cuatro dígitos.
    """
    por_codigo = {}
    for ruta in ARCHIVOS:
        plan = cargar(ruta)
        for materia in plan['materias']:
            por_codigo.setdefault(materia['codigo'], set()).add(plan['carrera'])

    compartidos = {c: v for c, v in por_codigo.items() if len(v) > 1}
    assert len(compartidos) >= 35, (
        f'sólo {len(compartidos)} códigos compartidos: la normalización de '
        'códigos puede haberse roto'
    )


def test_los_codigos_numericos_estan_normalizados():
    for ruta in ARCHIVOS:
        for materia in cargar(ruta)['materias']:
            codigo = materia['codigo']
            if re.fullmatch(r'\d+I*', codigo):
                assert len(codigo.rstrip('I')) == 4, (nombre_de(ruta), codigo)
