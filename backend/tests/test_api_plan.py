"""Tests de `GET /carreras/<id>/plan`, el payload que dibuja la malla."""


def test_el_plan_trae_carrera_anios_y_materias(client, plan_um):
    id_carrera = plan_um['carrera'].id_carrera
    respuesta = client.get(f'/api/carreras/{id_carrera}/plan')

    assert respuesta.status_code == 200
    cuerpo = respuesta.json

    assert cuerpo['carrera']['nombre'] == 'Ingeniería en Informática'
    assert [a['numero'] for a in cuerpo['anios']] == [1, 2, 3]
    assert [a['creditos_requeridos'] for a in cuerpo['anios']] == [0, 12, 38]
    assert len(cuerpo['materias']) == 6


def test_el_plan_trae_las_correlativas_resueltas(client, plan_um):
    id_carrera = plan_um['carrera'].id_carrera
    cuerpo = client.get(f'/api/carreras/{id_carrera}/plan').json

    por_codigo = {m['codigo']: m for m in cuerpo['materias']}
    assert por_codigo['0003']['correlativas'] == [
        plan_um['m']['precalculo'].id_materia
    ]
    assert por_codigo['0004']['correlativas'] == [plan_um['m']['calculo1'].id_materia]
    assert por_codigo['CP00']['correlativas'] == []


def test_el_plan_es_publico(client, plan_um):
    # Sin token: la malla se puede ver sin iniciar sesión
    id_carrera = plan_um['carrera'].id_carrera
    assert client.get(f'/api/carreras/{id_carrera}/plan').status_code == 200


def test_plan_de_carrera_inexistente(client):
    assert client.get('/api/carreras/999/plan').status_code == 404


def test_el_plan_no_incluye_materias_de_otra_carrera(client, plan_um, plan):
    # `plan` crea una segunda carrera con sus propias materias
    id_carrera = plan_um['carrera'].id_carrera
    cuerpo = client.get(f'/api/carreras/{id_carrera}/plan').json

    ids = {m['id_materia'] for m in cuerpo['materias']}
    ajenas = {m.id_materia for m in plan['materias'].values()}
    assert ids.isdisjoint(ajenas)
