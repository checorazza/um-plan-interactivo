"""Tests de la API de materias con el modelo nuevo de correlativas."""

from src.models import EstadoMateria, Materia, Usuario, db


def test_get_materias_lista_correlativas(client, plan):
    calculo1 = plan['materias']['calculo1']
    calculo2 = plan['materias']['calculo2']
    calculo2.correlativas = [calculo1]
    db.session.commit()

    respuesta = client.get('/materias')
    assert respuesta.status_code == 200

    por_nombre = {m['nombre']: m for m in respuesta.json}
    assert por_nombre['Cálculo II']['correlativas'] == [calculo1.id_materia]
    assert por_nombre['Cálculo I']['correlativas'] == []
    # el estado de cursado ya no vive en la materia
    assert 'es_regular' not in por_nombre['Cálculo I']
    assert 'es_aprobada' not in por_nombre['Cálculo I']


def test_post_materia_con_varias_correlativas(client, plan, auth_admin):
    calculo1 = plan['materias']['calculo1']
    algebra = plan['materias']['algebra']

    respuesta = client.post(
        '/materias',
        headers=auth_admin,
        json={
            'codigo': '2030',
            'nombre': 'Análisis Numérico',
            'creditos': 8,
            'id_anio': plan['anios'][2].id_anio,
            'correlativas': [calculo1.id_materia, algebra.id_materia],
        },
    )

    assert respuesta.status_code == 201
    assert sorted(respuesta.json['correlativas']) == sorted(
        [calculo1.id_materia, algebra.id_materia]
    )


def test_post_materia_sin_correlativas(client, plan, auth_admin):
    respuesta = client.post(
        '/materias',
        headers=auth_admin,
        json={
            'codigo': '0009',
            'nombre': 'Introducción a la Programación',
            'creditos': 4,
            'id_anio': plan['anios'][1].id_anio,
        },
    )
    assert respuesta.status_code == 201
    assert respuesta.json['correlativas'] == []


def test_post_rechaza_correlativa_inexistente(client, plan, auth_admin):
    respuesta = client.post(
        '/materias',
        headers=auth_admin,
        json={
            'codigo': 'XXXX',
            'nombre': 'Materia Fantasma',
            'creditos': 4,
            'id_anio': plan['anios'][1].id_anio,
            'correlativas': [9999],
        },
    )
    assert respuesta.status_code == 422
    assert 'No existen' in respuesta.json['message']


def test_put_rechaza_ciclo(client, plan, auth_admin):
    calculo1 = plan['materias']['calculo1']
    calculo2 = plan['materias']['calculo2']
    calculo2.correlativas = [calculo1]
    db.session.commit()

    # Cálculo I no puede requerir Cálculo II, que ya requiere Cálculo I
    respuesta = client.put(
        f'/materias/{calculo1.id_materia}',
        headers=auth_admin,
        json={
            'codigo': '0003',
            'nombre': 'Cálculo I',
            'creditos': 6,
            'id_anio': plan['anios'][1].id_anio,
            'correlativas': [calculo2.id_materia],
        },
    )
    assert respuesta.status_code == 422
    assert 'ciclo' in respuesta.json['message']


def test_put_rechaza_autoreferencia(client, plan, auth_admin):
    calculo1 = plan['materias']['calculo1']
    respuesta = client.put(
        f'/materias/{calculo1.id_materia}',
        headers=auth_admin,
        json={
            'codigo': '0003',
            'nombre': 'Cálculo I',
            'creditos': 6,
            'id_anio': plan['anios'][1].id_anio,
            'correlativas': [calculo1.id_materia],
        },
    )
    assert respuesta.status_code == 422
    assert 'de sí misma' in respuesta.json['message']


def test_put_reemplaza_las_correlativas(client, plan, auth_admin):
    calculo1 = plan['materias']['calculo1']
    algebra = plan['materias']['algebra']
    calculo2 = plan['materias']['calculo2']
    calculo2.correlativas = [calculo1]
    db.session.commit()

    respuesta = client.put(
        f'/materias/{calculo2.id_materia}',
        headers=auth_admin,
        json={
            'codigo': '0004',
            'nombre': 'Cálculo II',
            'creditos': 6,
            'id_anio': plan['anios'][2].id_anio,
            'correlativas': [algebra.id_materia],
        },
    )
    assert respuesta.status_code == 200
    assert respuesta.json['correlativas'] == [algebra.id_materia]


def test_backref_habilita(plan):
    calculo1 = plan['materias']['calculo1']
    calculo2 = plan['materias']['calculo2']
    calculo2.correlativas = [calculo1]
    db.session.commit()

    assert [m.id_materia for m in calculo1.habilita] == [calculo2.id_materia]


def test_borrar_materia_borra_sus_correlativas_y_estados(plan):
    calculo1 = plan['materias']['calculo1']
    calculo2 = plan['materias']['calculo2']
    calculo2.correlativas = [calculo1]

    usuario = Usuario(google_sub='sub-1', email='a@b.com')
    db.session.add(usuario)
    db.session.flush()
    db.session.add(
        EstadoMateria(
            id_usuario=usuario.id_usuario,
            id_materia=calculo1.id_materia,
            estado='aprobada',
        )
    )
    db.session.commit()

    db.session.delete(calculo1)
    db.session.commit()

    assert EstadoMateria.query.count() == 0
    assert db.session.get(Materia, calculo2.id_materia).correlativas == []


def test_el_endpoint_global_de_estado_ya_no_existe(client, plan):
    # Antes cualquiera podía aprobar una materia para todos los usuarios.
    calculo1 = plan['materias']['calculo1']
    respuesta = client.put(
        f'/materias/{calculo1.id_materia}/estado', json={'es_aprobada': True}
    )
    assert respuesta.status_code == 404
