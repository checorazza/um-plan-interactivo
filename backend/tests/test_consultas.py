"""Cuenta consultas SQL en los endpoints de lectura.

Existe por un bug concreto: serializar un plan leía `materia.correlativas`
materia por materia. Eran 50 consultas para un plan de 47 y, con la base a
unos 140 ms de la función, 7 segundos de espera en producción. Localmente,
contra SQLite, no se notaba: cada consulta costaba microsegundos.

Por eso el límite se mide en **cantidad de consultas** y no en tiempo: es lo
que se multiplica por la latencia de la red.
"""

import pytest
from sqlalchemy import event
from sqlalchemy.engine import Engine


@pytest.fixture
def contar_consultas():
    consultas = []

    def escuchar(conn, cursor, statement, params, context, many):
        consultas.append(statement)

    event.listen(Engine, 'before_cursor_execute', escuchar)
    yield consultas
    event.remove(Engine, 'before_cursor_execute', escuchar)


def test_el_plan_no_crece_con_la_cantidad_de_materias(
    client, plan_um, contar_consultas
):
    id_carrera = plan_um['carrera'].id_carrera

    contar_consultas.clear()
    respuesta = client.get(f'/api/carreras/{id_carrera}/plan')

    assert respuesta.status_code == 200
    assert len(respuesta.json['materias']) == 6
    # carrera + años + materias + correlativas. Si esto sube, volvió el N+1.
    assert len(contar_consultas) <= 5, '\n'.join(contar_consultas)


def test_el_listado_de_materias_tampoco(client, plan_um, contar_consultas):
    contar_consultas.clear()
    respuesta = client.get('/api/materias')

    assert respuesta.status_code == 200
    assert len(respuesta.json) == 6
    assert len(contar_consultas) <= 3, '\n'.join(contar_consultas)


def test_las_correlativas_siguen_estando(client, plan_um):
    """Que sea rápido no sirve si devuelve otra cosa."""
    id_carrera = plan_um['carrera'].id_carrera
    cuerpo = client.get(f'/api/carreras/{id_carrera}/plan').json

    por_codigo = {m['codigo']: m['correlativas'] for m in cuerpo['materias']}
    assert por_codigo['0003'] == [plan_um['m']['precalculo'].id_materia]
    assert por_codigo['0004'] == [plan_um['m']['calculo1'].id_materia]
    assert por_codigo['CP00'] == []


def test_una_materia_con_varias_correlativas_las_trae_todas(
    client, plan_um, auth_admin
):
    from src.models import db

    calculo2 = plan_um['m']['calculo2']
    calculo2.correlativas = [plan_um['m']['calculo1'], plan_um['m']['fisica']]
    db.session.commit()

    id_carrera = plan_um['carrera'].id_carrera
    cuerpo = client.get(f'/api/carreras/{id_carrera}/plan').json
    por_codigo = {m['codigo']: m['correlativas'] for m in cuerpo['materias']}

    assert sorted(por_codigo['0004']) == sorted(
        [plan_um['m']['calculo1'].id_materia, plan_um['m']['fisica'].id_materia]
    )
