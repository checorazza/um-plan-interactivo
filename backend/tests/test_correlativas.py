"""Tests del guard de ciclos. No tocan la base: el grafo se pasa como dict."""

import pytest

from src.domain.correlativas import (
    CorrelativaInvalida,
    detectar_ciclo,
    validar_correlativas,
)


def grafo(mapa):
    """Convierte {id: [requisitos]} en la función que esperan las funciones puras."""
    return lambda id_materia: mapa.get(id_materia, [])


def test_sin_requisitos_no_hay_ciclo():
    assert detectar_ciclo(1, [], grafo({})) is None


def test_requisito_simple_no_es_ciclo():
    assert detectar_ciclo(2, [1], grafo({1: []})) is None


def test_cadena_larga_no_es_ciclo():
    # 4 requiere 3, que requiere 2, que requiere 1
    assert detectar_ciclo(4, [3], grafo({3: [2], 2: [1], 1: []})) is None


def test_autoreferencia_es_ciclo():
    assert detectar_ciclo(1, [1], grafo({})) == [1, 1]


def test_ciclo_directo():
    # 1 ya requiere 2; agregar 1 como requisito de 2 cierra el ciclo
    assert detectar_ciclo(2, [1], grafo({1: [2]})) == [2, 1, 2]


def test_ciclo_transitivo():
    # 3 -> 2 -> 1, y queremos que 1 requiera 3
    assert detectar_ciclo(1, [3], grafo({3: [2], 2: [1]})) == [1, 3, 2, 1]


def test_diamante_no_es_ciclo():
    # 4 requiere 2 y 3; ambas requieren 1. Hay caminos repetidos, no ciclo.
    assert detectar_ciclo(4, [2, 3], grafo({2: [1], 3: [1], 1: []})) is None


def test_validar_quita_duplicados_preservando_orden():
    assert validar_correlativas(9, [3, 1, 3, 2, 1], grafo({})) == [3, 1, 2]


def test_validar_rechaza_autoreferencia():
    with pytest.raises(CorrelativaInvalida, match='de sí misma'):
        validar_correlativas(5, [5], grafo({}))


def test_validar_rechaza_ciclo_e_informa_el_camino():
    with pytest.raises(CorrelativaInvalida, match=r'1 -> 3 -> 2 -> 1'):
        validar_correlativas(1, [3], grafo({3: [2], 2: [1]}))
