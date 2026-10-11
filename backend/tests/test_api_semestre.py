"""El semestre ordena la malla dentro de cada año y se valida al escribir."""

from src.models.materia import ANUAL, ORDEN_SEMESTRE, SEMESTRES


def test_semestres_validos():
    assert SEMESTRES == ('1', '2', 'anual')


def test_las_anuales_van_primero():
    # Atraviesan los dos semestres, así que encabezan el año en la malla
    assert ORDEN_SEMESTRE[ANUAL] < ORDEN_SEMESTRE['1'] < ORDEN_SEMESTRE['2']


def test_el_plan_trae_el_semestre(client, plan_um):
    id_carrera = plan_um['carrera'].id_carrera
    cuerpo = client.get(f'/api/carreras/{id_carrera}/plan').json

    por_codigo = {m['codigo']: m['semestre'] for m in cuerpo['materias']}
    assert por_codigo['CP00'] == '1'
    assert por_codigo['0002'] == '2'
    assert por_codigo['0009'] == 'anual'


def test_el_plan_viene_ordenado_por_anio_y_semestre(client, plan_um):
    id_carrera = plan_um['carrera'].id_carrera
    materias = client.get(f'/api/carreras/{id_carrera}/plan').json['materias']

    anios = {a['id_anio']: a['numero'] for a in
             client.get(f'/api/carreras/{id_carrera}/plan').json['anios']}
    orden = [
        (anios[m['id_anio']], ORDEN_SEMESTRE[m['semestre']]) for m in materias
    ]
    assert orden == sorted(orden)

    # 1º año: la anual (Informática) antes que las de 1er y 2do semestre
    primer_anio = [m['codigo'] for m in materias if anios[m['id_anio']] == 1]
    assert primer_anio == ['0009', 'CP00', '0002']


def test_crear_materia_sin_semestre_falla(client, auth_admin, plan):
    respuesta = client.post(
        '/api/materias',
        headers=auth_admin,
        json={
            'codigo': '1234',
            'nombre': 'Sin semestre',
            'creditos': 4,
            'id_anio': plan['anios'][1].id_anio,
        },
    )
    assert respuesta.status_code == 400


def test_crear_materia_con_semestre_invalido_falla(client, auth_admin, plan):
    respuesta = client.post(
        '/api/materias',
        headers=auth_admin,
        json={
            'codigo': '1234',
            'nombre': 'Semestre raro',
            'creditos': 4,
            'semestre': '3',
            'id_anio': plan['anios'][1].id_anio,
        },
    )
    assert respuesta.status_code == 400


def test_crear_materia_anual(client, auth_admin, plan):
    respuesta = client.post(
        '/api/materias',
        headers=auth_admin,
        json={
            'codigo': '2028',
            'nombre': 'Computación',
            'creditos': 6,
            'semestre': 'anual',
            'id_anio': plan['anios'][1].id_anio,
        },
    )
    assert respuesta.status_code == 201
    assert respuesta.json['semestre'] == 'anual'
