"""El normalizador de nombres de materia que usa el extractor de planes."""

import os
import sys

import pytest

sys.path.insert(
    0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'scripts')
)

from extraer_planes import normalizar_nombre_materia as normalizar  # noqa: E402


@pytest.mark.parametrize(
    'entrada,esperado',
    [
        ('CÁLCULO I', 'Cálculo I'),
        # Convención española: los conectores van en minúscula dentro del título
        ('ANÁLISIS DE SISTEMAS II', 'Análisis de Sistemas II'),
        ('Análisis de Circuitos', 'Análisis de Circuitos'),
        ('REDES DE DATOS', 'Redes de Datos'),
        ('ÁLGEBRA Y GEOMETRÍA ANALÍTICA', 'Álgebra y Geometría Analítica'),
        # ...salvo cuando abren el nombre
        ('DE LA TIERRA', 'De la Tierra'),
        # Los romanos quedan en mayúscula, no como "Ii"
        ('COMPUTACIÓN III', 'Computación III'),
        ('TRABAJO INTEGRADOR FINAL IV', 'Trabajo Integrador Final IV'),
        # Siglas
        ('GESTIÓN DE RR HH', 'Gestión de RR HH'),
        # Abreviaturas con punto: se capitaliza también después del punto
        ('ASEG.  DE CALIDAD DE SOFTWARE', 'Aseg. de Calidad de Software'),
        ('EVALUACIÓN Y SEGUIM.DE PROYECTOS', 'Evaluación y Seguim.de Proyectos'),
        ('ING., DERECHO Y ÉTICA PROFESIONAL', 'Ing., Derecho y Ética Profesional'),
        # Un número pegado a una letra no es un romano
        ('Sistemas de Representación y Modelado 3D', 'Sistemas de Representación y Modelado 3D'),
        # Errata conocida del PDF de Informática
        ('PRECALCULO', 'Precálculo'),
        ('', ''),
    ],
)
def test_normaliza(entrada, esperado):
    assert normalizar(entrada) == esperado


def test_es_idempotente():
    for nombre in ('CÁLCULO II', 'GESTIÓN DE RR HH', 'Análisis de Señales'):
        una = normalizar(nombre)
        assert normalizar(una) == una
