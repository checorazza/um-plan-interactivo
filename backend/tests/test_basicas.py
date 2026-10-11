"""Las básicas son la misma materia en varias carreras: el progreso se comparte."""

import pytest

from src.models import Anio, Basica, Carrera, EstadoMateria, Materia, db
from src.services.agrupar_basicas import analizar, aplicar, normalizar


def materia(carrera_anios, numero_anio, codigo, nombre, creditos, semestre='1'):
    m = Materia(
        codigo=codigo,
        nombre=nombre,
        creditos=creditos,
        semestre=semestre,
        id_anio=carrera_anios[numero_anio].id_anio,
    )
    db.session.add(m)
    return m


def armar_carrera(nombre, creditos_por_anio):
    carrera = Carrera(nombre=nombre)
    db.session.add(carrera)
    db.session.flush()

    anios = {}
    for numero, creditos in creditos_por_anio.items():
        anio = Anio(
            numero=numero,
            creditos_requeridos=creditos,
            id_carrera=carrera.id_carrera,
        )
        db.session.add(anio)
        anios[numero] = anio
    db.session.flush()
    return carrera, anios


@pytest.fixture
def dos_carreras(app):
    """Informática e Industrial, con Cálculo I (0003) compartida en 2º año.

    Las dos tienen 1º con 0 créditos y 2º con 12, y en 1º materias suficientes
    para llegar a esos 12.
    """
    _, info = armar_carrera('Informática', {1: 0, 2: 12})
    _, indu = armar_carrera('Industrial', {1: 0, 2: 12})

    materias = {
        'info_quimica': materia(info, 1, '0002', 'Química General', 7),
        'info_precalculo': materia(info, 1, 'CP00', 'Precálculo', 6),
        'info_calculo1': materia(info, 2, '0003', 'Cálculo I', 3),
        'indu_quimica': materia(indu, 1, '0002', 'Química General', 7),
        'indu_precalculo': materia(indu, 1, 'CP00', 'Precálculo', 6),
        'indu_calculo1': materia(indu, 2, '0003', 'Cálculo I', 3),
        'info_propia': materia(info, 1, '9999', 'Materia sólo de Informática', 4),
    }
    db.session.flush()

    # Agrupar las tres básicas compartidas
    grupos, dudosos = analizar()
    assert dudosos == []
    aplicar(grupos)
    db.session.commit()

    return materias


# --- agrupación ---


def test_normalizar_ignora_mayusculas_y_acentos():
    assert normalizar('PRECALCULO') == normalizar('Precálculo')
    assert normalizar('  Álgebra   Lineal ') == 'algebra lineal'
    assert normalizar(None) == ''


def test_agrupa_los_codigos_repetidos(dos_carreras):
    assert {b.codigo for b in Basica.query.all()} == {'0002', 'CP00', '0003'}


def test_no_agrupa_lo_que_esta_en_una_sola_carrera(dos_carreras):
    assert dos_carreras['info_propia'].id_basica is None
    assert Basica.query.filter_by(codigo='9999').first() is None


def test_las_equivalentes_comparten_basica(dos_carreras):
    info = dos_carreras['info_calculo1']
    indu = dos_carreras['indu_calculo1']
    assert info.id_basica is not None
    assert info.id_basica == indu.id_basica


def test_los_nombres_distintos_quedan_como_dudosos(app):
    # El caso real del código 5044 en los planes de la UM
    _, a = armar_carrera('A', {1: 0})
    _, b = armar_carrera('B', {1: 0})
    materia(a, 1, '5044', 'Modelos y Simulación', 4)
    materia(b, 1, '5044', 'Modelado y Sistemas de Control', 4)
    db.session.flush()

    grupos, dudosos = analizar()

    assert '5044' not in grupos
    assert len(dudosos) == 1
    assert dudosos[0]['codigo'] == '5044'
    assert len(dudosos[0]['nombres']) == 2


def test_agrupar_es_idempotente(dos_carreras):
    antes = Basica.query.count()
    grupos, _ = analizar()
    creadas, enlazadas = aplicar(grupos)
    db.session.commit()

    assert creadas == 0
    assert enlazadas == 0
    assert Basica.query.count() == antes


# --- propagación del progreso ---


def test_aprobar_una_basica_la_aprueba_en_la_otra_carrera(client, auth, dos_carreras):
    id_materia = dos_carreras['info_precalculo'].id_materia
    respuesta = client.put(
        f'/api/me/estados/{id_materia}', headers=auth, json={'estado': 'aprobada'}
    )

    assert respuesta.status_code == 200
    assert respuesta.json['propagado_a'] == [
        dos_carreras['indu_precalculo'].id_materia
    ]

    estados = {e.id_materia: e.estado for e in EstadoMateria.query.all()}
    assert estados[dos_carreras['indu_precalculo'].id_materia] == 'aprobada'


def test_regularizar_tambien_se_propaga(client, auth, dos_carreras):
    id_materia = dos_carreras['info_quimica'].id_materia
    client.put(f'/api/me/estados/{id_materia}', headers=auth, json={'estado': 'regular'})

    gemela = EstadoMateria.query.filter_by(
        id_materia=dos_carreras['indu_quimica'].id_materia
    ).first()
    assert gemela is not None
    assert gemela.estado == 'regular'


def test_desmarcar_se_propaga(client, auth, dos_carreras):
    id_materia = dos_carreras['info_precalculo'].id_materia
    client.put(f'/api/me/estados/{id_materia}', headers=auth, json={'estado': 'aprobada'})
    assert EstadoMateria.query.count() == 2

    respuesta = client.delete(f'/api/me/estados/{id_materia}', headers=auth)

    assert respuesta.status_code == 200
    assert respuesta.json['propagado_a'] == [
        dos_carreras['indu_precalculo'].id_materia
    ]
    assert EstadoMateria.query.count() == 0


def test_una_materia_propia_no_propaga_nada(client, auth, dos_carreras):
    id_materia = dos_carreras['info_propia'].id_materia
    respuesta = client.put(
        f'/api/me/estados/{id_materia}', headers=auth, json={'estado': 'aprobada'}
    )

    assert respuesta.status_code == 200
    assert 'propagado_a' not in respuesta.json
    assert EstadoMateria.query.count() == 1


def test_el_put_masivo_tambien_expande(client, auth, dos_carreras):
    cuerpo = {
        'estados': [
            {
                'id_materia': dos_carreras['info_precalculo'].id_materia,
                'estado': 'aprobada',
            }
        ]
    }
    respuesta = client.put('/api/me/estados', headers=auth, json=cuerpo)

    assert respuesta.status_code == 200
    ids = {e['id_materia'] for e in respuesta.json}
    assert ids == {
        dos_carreras['info_precalculo'].id_materia,
        dos_carreras['indu_precalculo'].id_materia,
    }


def test_el_estado_explicito_gana_sobre_el_propagado(client, auth, dos_carreras):
    # Si el cliente manda las dos equivalentes con estados distintos, se
    # respeta lo que mandó en vez de pisar una con la otra.
    cuerpo = {
        'estados': [
            {
                'id_materia': dos_carreras['info_precalculo'].id_materia,
                'estado': 'aprobada',
            },
            {
                'id_materia': dos_carreras['indu_precalculo'].id_materia,
                'estado': 'regular',
            },
        ]
    }
    respuesta = client.put('/api/me/estados', headers=auth, json=cuerpo)

    assert respuesta.status_code == 200
    estados = {e['id_materia']: e['estado'] for e in respuesta.json}
    assert estados[dos_carreras['info_precalculo'].id_materia] == 'aprobada'
    assert estados[dos_carreras['indu_precalculo'].id_materia] == 'regular'


# --- el caso incómodo: la misma materia con distinto gate ---


@pytest.fixture
def gates_distintos(app):
    """Cálculo I está en 2º de Informática (12 cr) y en 3º de Industrial (38)."""
    _, info = armar_carrera('Informática', {1: 0, 2: 12})
    _, indu = armar_carrera('Industrial', {1: 0, 2: 12, 3: 38})

    materias = {
        'info_precalculo': materia(info, 1, 'CP00', 'Precálculo', 12),
        'info_calculo1': materia(info, 2, '0003', 'Cálculo I', 3),
        'indu_precalculo': materia(indu, 1, 'CP00', 'Precálculo', 12),
        'indu_calculo1': materia(indu, 3, '0003', 'Cálculo I', 3),
    }
    db.session.flush()

    grupos, _ = analizar()
    aplicar(grupos)
    db.session.commit()
    return materias


def test_no_propaga_donde_dejaria_el_plan_inconsistente(
    client, auth, gates_distintos
):
    # 12 créditos alcanzan para 2º de Informática, no para 3º de Industrial
    client.put(
        f'/api/me/estados/{gates_distintos["info_precalculo"].id_materia}',
        headers=auth,
        json={'estado': 'aprobada'},
    )

    respuesta = client.put(
        f'/api/me/estados/{gates_distintos["info_calculo1"].id_materia}',
        headers=auth,
        json={'estado': 'aprobada'},
    )

    assert respuesta.status_code == 200
    assert respuesta.json['propagado_a'] == []

    # se informa, no se hace en silencio
    omitidos = respuesta.json['no_propagado']
    assert len(omitidos) == 1
    assert omitidos[0]['id_materia'] == gates_distintos['indu_calculo1'].id_materia
    assert omitidos[0]['causa'] == 'creditos'

    # y el plan de Industrial sigue siendo consistente
    assert (
        EstadoMateria.query.filter_by(
            id_materia=gates_distintos['indu_calculo1'].id_materia
        ).first()
        is None
    )


def test_el_cambio_propio_se_guarda_aunque_no_se_pueda_propagar(
    client, auth, gates_distintos
):
    client.put(
        f'/api/me/estados/{gates_distintos["info_precalculo"].id_materia}',
        headers=auth,
        json={'estado': 'aprobada'},
    )
    client.put(
        f'/api/me/estados/{gates_distintos["info_calculo1"].id_materia}',
        headers=auth,
        json={'estado': 'aprobada'},
    )

    propia = EstadoMateria.query.filter_by(
        id_materia=gates_distintos['info_calculo1'].id_materia
    ).first()
    assert propia is not None
    assert propia.estado == 'aprobada'


# --- el plan expone la básica para que el front pueda propagar offline ---


def test_el_plan_informa_la_basica(client, dos_carreras):
    id_carrera = (
        db.session.query(Anio.id_carrera)
        .filter(Anio.id_anio == dos_carreras['info_calculo1'].id_anio)
        .scalar()
    )
    cuerpo = client.get(f'/api/carreras/{id_carrera}/plan').json

    por_codigo = {m['codigo']: m for m in cuerpo['materias']}
    assert por_codigo['0003']['id_basica'] == dos_carreras['info_calculo1'].id_basica
    assert por_codigo['9999']['id_basica'] is None
