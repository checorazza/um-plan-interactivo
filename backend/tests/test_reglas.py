"""Tests del motor de reglas. Puros: no tocan la base ni la app."""

from src.domain.reglas import (
    APROBADA,
    REGULAR,
    AnioPlan,
    MateriaPlan,
    Plan,
    correlativas_faltantes,
    creditos_aprobados,
    creditos_por_anio,
    puede_marcar,
    validar_conjunto,
)


def armar_plan():
    """Un plan chico con los créditos reales de la UM para 1º y 2º año.

    1º año (0 créditos requeridos):
        1 Precálculo        6 cr
        2 Química General   4 cr
        3 Informática       7 cr
    2º año (12 créditos requeridos):
        4 Cálculo I         3 cr   correlativa: 1
        5 Física            5 cr   correlativa: 1
        7 Química Orgánica  4 cr   correlativa: 2
    3º año (38 créditos requeridos):
        6 Cálculo II        6 cr   correlativa: 4
    """
    anios = {
        1: AnioPlan(id_anio=1, numero=1, creditos_requeridos=0),
        2: AnioPlan(id_anio=2, numero=2, creditos_requeridos=12),
        3: AnioPlan(id_anio=3, numero=3, creditos_requeridos=38),
    }
    materias = {
        1: MateriaPlan(1, 'Precálculo', 6, 1, ()),
        2: MateriaPlan(2, 'Química General', 4, 1, ()),
        3: MateriaPlan(3, 'Informática', 7, 1, ()),
        4: MateriaPlan(4, 'Cálculo I', 3, 2, (1,)),
        5: MateriaPlan(5, 'Física', 5, 2, (1,)),
        6: MateriaPlan(6, 'Cálculo II', 6, 3, (4,)),
        7: MateriaPlan(7, 'Química Orgánica', 4, 2, (2,)),
    }
    return Plan(id_carrera=1, anios=anios, materias=materias)


PLAN = armar_plan()


# --- créditos ---


def test_sin_estados_no_hay_creditos():
    assert creditos_aprobados(PLAN, {}) == 0


def test_solo_las_aprobadas_dan_creditos():
    estados = {1: APROBADA, 2: REGULAR, 3: REGULAR}
    assert creditos_aprobados(PLAN, estados) == 6


def test_creditos_excluyendo_una_materia():
    estados = {1: APROBADA, 2: APROBADA}
    assert creditos_aprobados(PLAN, estados) == 10
    assert creditos_aprobados(PLAN, estados, excluyendo=1) == 4


def test_creditos_ignora_materias_de_otro_plan():
    assert creditos_aprobados(PLAN, {999: APROBADA}) == 0


def test_creditos_por_anio():
    estados = {1: APROBADA, 2: APROBADA, 4: APROBADA, 5: REGULAR}
    assert creditos_por_anio(PLAN, estados) == {1: 10, 2: 3, 3: 0}


# --- gate de créditos ---


def test_primer_anio_no_pide_creditos():
    assert puede_marcar(PLAN, {}, 1, APROBADA)


def test_segundo_anio_bloqueado_sin_creditos():
    resultado = puede_marcar(PLAN, {}, 4, REGULAR)
    assert not resultado
    assert resultado.causa == 'creditos'
    assert 'Te faltan 12 créditos para 2º año' in resultado.motivo


def test_segundo_anio_habilitado_con_creditos_justos():
    # 6 + 4 = 10, no alcanza
    estados = {1: APROBADA, 2: APROBADA}
    assert not puede_marcar(PLAN, estados, 4, REGULAR)
    # 6 + 4 + 7 = 17, alcanza
    estados = {1: APROBADA, 2: APROBADA, 3: APROBADA}
    assert puede_marcar(PLAN, estados, 4, APROBADA)


def test_el_gate_cuenta_creditos_de_cualquier_anio():
    # Los 12 créditos de 2º año se juntan con materias de 1º, no hace falta
    # que sean de años anteriores en particular.
    estados = {1: APROBADA, 3: APROBADA}  # 13
    assert puede_marcar(PLAN, estados, 4, REGULAR)


def test_una_materia_no_cuenta_para_su_propio_gate():
    # Cálculo II da 6 créditos, pero no puede usarlos para llegar a los 38
    estados = {1: APROBADA, 2: APROBADA, 3: APROBADA, 4: APROBADA, 6: APROBADA}
    resultado = puede_marcar(PLAN, estados, 6, APROBADA)
    assert not resultado
    assert 'tenés 20 de 38' in resultado.motivo


# --- gate de correlativas ---


def test_aprobar_exige_la_correlativa_aprobada():
    # 4 + 7 + 5 = 16 créditos, alcanzan para 2º año; Precálculo quedó regular
    estados = {1: REGULAR, 2: APROBADA, 3: APROBADA, 5: APROBADA}
    resultado = puede_marcar(PLAN, estados, 4, APROBADA)
    assert not resultado
    assert resultado.causa == 'correlativa'
    assert 'Precálculo' in resultado.motivo


def test_regularizar_no_exige_la_correlativa():
    # Precálculo sólo regular: Cálculo I no se puede aprobar, pero sí regularizar
    estados = {1: REGULAR, 2: APROBADA, 3: APROBADA, 5: APROBADA}
    assert puede_marcar(PLAN, estados, 4, REGULAR)
    assert not puede_marcar(PLAN, estados, 4, APROBADA)


def test_correlativas_faltantes():
    assert correlativas_faltantes(PLAN, {}, 4) == [1]
    assert correlativas_faltantes(PLAN, {1: APROBADA}, 4) == []
    assert correlativas_faltantes(PLAN, {1: REGULAR}, 4) == [1]
    assert correlativas_faltantes(PLAN, {}, 1) == []


def test_los_creditos_se_chequean_antes_que_las_correlativas():
    # Sin créditos, el motivo habla de créditos aunque también falte la correlativa
    resultado = puede_marcar(PLAN, {}, 4, APROBADA)
    assert resultado.causa == 'creditos'


# --- casos borde ---


def test_materia_desconocida():
    resultado = puede_marcar(PLAN, {}, 999, REGULAR)
    assert not resultado
    assert resultado.causa == 'desconocida'


def test_estado_invalido():
    resultado = puede_marcar(PLAN, {}, 1, 'promocionada')
    assert not resultado
    assert resultado.causa == 'estado_invalido'


def test_desmarcar_siempre_se_puede():
    assert puede_marcar(PLAN, {1: APROBADA}, 1, None)


# --- validación de un conjunto completo ---


def test_conjunto_vacio_es_valido():
    assert validar_conjunto(PLAN, {}) == []


def test_conjunto_alcanzable_es_valido():
    estados = {1: APROBADA, 2: APROBADA, 3: APROBADA, 4: APROBADA, 5: REGULAR}
    assert validar_conjunto(PLAN, estados) == []


def test_conjunto_con_salto_de_creditos_es_invalido():
    # Cálculo I de 2º año sin ningún crédito
    conflictos = validar_conjunto(PLAN, {4: REGULAR})
    assert [c.id_materia for c in conflictos] == [4]
    assert conflictos[0].causa == 'creditos'


def test_conjunto_sin_correlativa_es_invalido():
    # 6 + 7 = 13 créditos, alcanzan para 2º año. Química Orgánica es aprobada
    # pero Química General, su correlativa, quedó sólo regular: no es alcanzable.
    estados = {1: APROBADA, 3: APROBADA, 2: REGULAR, 7: APROBADA}
    conflictos = validar_conjunto(PLAN, estados)
    assert [c.id_materia for c in conflictos] == [7]
    assert conflictos[0].causa == 'correlativa'


def test_conjunto_con_correlativa_aprobada_es_valido():
    # El mismo caso, pero con Química General aprobada
    estados = {1: APROBADA, 3: APROBADA, 2: APROBADA, 7: APROBADA}
    assert validar_conjunto(PLAN, estados) == []


def test_el_orden_de_los_estados_no_cambia_la_validez():
    # El mismo conjunto en otro orden de inserción tiene que dar lo mismo
    a = {1: APROBADA, 2: APROBADA, 3: APROBADA, 4: APROBADA}
    b = {4: APROBADA, 3: APROBADA, 2: APROBADA, 1: APROBADA}
    assert validar_conjunto(PLAN, a) == validar_conjunto(PLAN, b) == []


def test_cadena_larga_valida():
    # 1 -> 4 -> 6: hay que juntar 38 créditos para Cálculo II
    estados = {
        1: APROBADA,  # 6
        2: APROBADA,  # 4
        3: APROBADA,  # 7
        4: APROBADA,  # 3
        5: APROBADA,  # 5
        7: APROBADA,  # 4
    }
    # total 29: no alcanza para los 38 de 3º año
    conflictos = validar_conjunto(PLAN, {**estados, 6: APROBADA})
    assert [c.id_materia for c in conflictos] == [6]


def test_conjunto_reporta_todos_los_conflictos():
    conflictos = validar_conjunto(PLAN, {4: REGULAR, 6: REGULAR})
    assert sorted(c.id_materia for c in conflictos) == [4, 6]


def test_materia_de_otro_plan_es_conflicto():
    conflictos = validar_conjunto(PLAN, {999: APROBADA})
    assert [c.causa for c in conflictos] == ['desconocida']
