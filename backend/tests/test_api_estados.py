"""Tests del progreso del usuario: /me/estados.

Son los tests que confirman que el backend no confía en el cliente.
"""

from src.models import EstadoMateria


def ids(plan_um, *nombres):
    return [plan_um['m'][n].id_materia for n in nombres]


def marcar(client, auth, id_materia, estado):
    return client.put(f'/me/estados/{id_materia}', headers=auth, json={'estado': estado})


def aprobar_primer_anio(client, auth, plan_um):
    """Aprueba las 3 materias de 1º año: 17 créditos, suficiente para 2º."""
    for nombre in ('precalculo', 'quimica', 'informatica'):
        respuesta = marcar(
            client, auth, plan_um['m'][nombre].id_materia, 'aprobada'
        )
        assert respuesta.status_code == 200, respuesta.json


# --- lectura ---


def test_estados_vacios_al_principio(client, auth):
    respuesta = client.get('/me/estados', headers=auth)
    assert respuesta.status_code == 200
    assert respuesta.json == []


def test_estados_requiere_sesion(client):
    assert client.get('/me/estados').status_code == 401
    assert client.put('/me/estados', json={'estados': []}).status_code == 401


# --- marcar una materia ---


def test_marcar_materia_de_primer_anio(client, auth, plan_um):
    id_materia = plan_um['m']['precalculo'].id_materia
    respuesta = marcar(client, auth, id_materia, 'regular')

    assert respuesta.status_code == 200
    assert respuesta.json['estado'] == 'regular'
    assert respuesta.json['actualizado_en']


def test_el_gate_de_creditos_bloquea_segundo_anio(client, auth, plan_um):
    # Cálculo I es de 2º año: pide 12 créditos y el usuario no tiene ninguno
    respuesta = marcar(client, auth, plan_um['m']['calculo1'].id_materia, 'regular')

    assert respuesta.status_code == 422
    assert respuesta.json['causa'] == 'creditos'
    assert 'Te faltan 12 créditos para 2º año' in respuesta.json['message']
    assert EstadoMateria.query.count() == 0


def test_con_creditos_se_habilita_segundo_anio(client, auth, plan_um):
    aprobar_primer_anio(client, auth, plan_um)
    respuesta = marcar(client, auth, plan_um['m']['calculo1'].id_materia, 'aprobada')
    assert respuesta.status_code == 200


def test_regularizar_no_exige_la_correlativa(client, auth, plan_um):
    # Precálculo sólo regular; Química e Informática aprobadas = 11 créditos...
    # hace falta llegar a 12, así que primero aprobamos Precálculo y lo bajamos.
    aprobar_primer_anio(client, auth, plan_um)
    assert (
        marcar(client, auth, plan_um['m']['precalculo'].id_materia, 'regular').status_code
        == 200
    )

    # Ahora quedan 11 créditos: ni regular se puede. Subimos Precálculo otra vez
    # y bajamos Química, que no es correlativa de nada.
    marcar(client, auth, plan_um['m']['precalculo'].id_materia, 'aprobada')
    marcar(client, auth, plan_um['m']['quimica'].id_materia, 'regular')
    # 6 + 7 = 13 créditos, con Precálculo aprobada
    id_calculo1 = plan_um['m']['calculo1'].id_materia
    assert marcar(client, auth, id_calculo1, 'aprobada').status_code == 200


def test_aprobar_sin_la_correlativa_falla_pero_regularizar_no(client, auth, plan_um):
    # 13 créditos sin Precálculo aprobada no se puede armar en este plan, así
    # que se arma el caso con el PUT masivo y después se intenta el cambio.
    cuerpo = {
        'estados': [
            {'id_materia': plan_um['m']['precalculo'].id_materia, 'estado': 'regular'},
            {'id_materia': plan_um['m']['quimica'].id_materia, 'estado': 'aprobada'},
            {'id_materia': plan_um['m']['informatica'].id_materia, 'estado': 'aprobada'},
        ]
    }
    assert client.put('/me/estados', headers=auth, json=cuerpo).status_code == 200

    # 4 + 7 = 11 créditos: todavía no alcanza para 2º año
    id_fisica = plan_um['m']['fisica'].id_materia
    respuesta = marcar(client, auth, id_fisica, 'regular')
    assert respuesta.status_code == 422
    assert respuesta.json['causa'] == 'creditos'


def test_materia_inexistente(client, auth):
    assert marcar(client, auth, 9999, 'regular').status_code == 404


def test_estado_invalido(client, auth, plan_um):
    respuesta = marcar(
        client, auth, plan_um['m']['precalculo'].id_materia, 'promocionada'
    )
    assert respuesta.status_code == 400


# --- bajar de estado y desmarcar ---


def test_bajar_una_correlativa_da_conflicto(client, auth, plan_um):
    aprobar_primer_anio(client, auth, plan_um)
    marcar(client, auth, plan_um['m']['calculo1'].id_materia, 'aprobada')

    # Bajar Precálculo a regular deja Cálculo I aprobada sin su correlativa
    respuesta = marcar(
        client, auth, plan_um['m']['precalculo'].id_materia, 'regular'
    )
    assert respuesta.status_code == 409
    conflictivas = [c['id_materia'] for c in respuesta.json['conflictos']]
    assert plan_um['m']['calculo1'].id_materia in conflictivas

    # y no se guardó nada
    estado = EstadoMateria.query.filter_by(
        id_materia=plan_um['m']['precalculo'].id_materia
    ).first()
    assert estado.estado == 'aprobada'


def test_desmarcar_que_rompe_otras_da_conflicto(client, auth, plan_um):
    aprobar_primer_anio(client, auth, plan_um)
    marcar(client, auth, plan_um['m']['calculo1'].id_materia, 'aprobada')

    respuesta = client.delete(
        f'/me/estados/{plan_um["m"]["precalculo"].id_materia}', headers=auth
    )
    assert respuesta.status_code == 409
    assert respuesta.json['conflictos']


def test_desmarcar_una_hoja_funciona(client, auth, plan_um):
    aprobar_primer_anio(client, auth, plan_um)

    # Química no es correlativa de nada, pero sus créditos tampoco hacen falta
    respuesta = client.delete(
        f'/me/estados/{plan_um["m"]["quimica"].id_materia}', headers=auth
    )
    assert respuesta.status_code == 204
    assert EstadoMateria.query.count() == 2


def test_desmarcar_es_idempotente(client, auth, plan_um):
    respuesta = client.delete(
        f'/me/estados/{plan_um["m"]["quimica"].id_materia}', headers=auth
    )
    assert respuesta.status_code == 204


def test_desmarcar_que_rompe_el_gate_de_creditos_da_conflicto(client, auth, plan_um):
    aprobar_primer_anio(client, auth, plan_um)  # 17 créditos
    marcar(client, auth, plan_um['m']['fisica'].id_materia, 'regular')

    # Sin Informática quedan 10 créditos: Física de 2º año ya no es alcanzable
    respuesta = client.delete(
        f'/me/estados/{plan_um["m"]["informatica"].id_materia}', headers=auth
    )
    assert respuesta.status_code == 409
    conflictivas = [c['id_materia'] for c in respuesta.json['conflictos']]
    assert plan_um['m']['fisica'].id_materia in conflictivas
    assert respuesta.json['conflictos'][0]['causa'] == 'creditos'


# --- reemplazo masivo (el push del sync) ---


def test_put_masivo_guarda_un_conjunto_valido(client, auth, plan_um):
    cuerpo = {
        'estados': [
            {'id_materia': plan_um['m']['precalculo'].id_materia, 'estado': 'aprobada'},
            {'id_materia': plan_um['m']['quimica'].id_materia, 'estado': 'aprobada'},
            {'id_materia': plan_um['m']['informatica'].id_materia, 'estado': 'aprobada'},
            {'id_materia': plan_um['m']['calculo1'].id_materia, 'estado': 'regular'},
        ]
    }
    respuesta = client.put('/me/estados', headers=auth, json=cuerpo)

    assert respuesta.status_code == 200
    assert len(respuesta.json) == 4
    assert EstadoMateria.query.count() == 4


def test_put_masivo_rechaza_un_conjunto_inalcanzable(client, auth, plan_um):
    # Cálculo II de 3º año pide 38 créditos; el plan entero no llega
    cuerpo = {
        'estados': [
            {'id_materia': plan_um['m']['calculo2'].id_materia, 'estado': 'aprobada'},
        ]
    }
    respuesta = client.put('/me/estados', headers=auth, json=cuerpo)

    assert respuesta.status_code == 422
    assert respuesta.json['conflictos'][0]['id_materia'] == (
        plan_um['m']['calculo2'].id_materia
    )
    assert EstadoMateria.query.count() == 0


def test_put_masivo_rechaza_aprobada_sin_correlativa(client, auth, plan_um):
    cuerpo = {
        'estados': [
            {'id_materia': plan_um['m']['precalculo'].id_materia, 'estado': 'regular'},
            {'id_materia': plan_um['m']['quimica'].id_materia, 'estado': 'aprobada'},
            {'id_materia': plan_um['m']['informatica'].id_materia, 'estado': 'aprobada'},
            {'id_materia': plan_um['m']['calculo1'].id_materia, 'estado': 'aprobada'},
        ]
    }
    respuesta = client.put('/me/estados', headers=auth, json=cuerpo)
    assert respuesta.status_code == 422


def test_put_masivo_reemplaza_todo(client, auth, plan_um):
    aprobar_primer_anio(client, auth, plan_um)
    assert EstadoMateria.query.count() == 3

    respuesta = client.put('/me/estados', headers=auth, json={'estados': []})
    assert respuesta.status_code == 200
    assert respuesta.json == []
    assert EstadoMateria.query.count() == 0


def test_put_masivo_rechaza_materias_inexistentes(client, auth, plan_um):
    respuesta = client.put(
        '/me/estados',
        headers=auth,
        json={'estados': [{'id_materia': 9999, 'estado': 'regular'}]},
    )
    assert respuesta.status_code == 422
    assert 'No existen' in respuesta.json['message']


def test_put_masivo_rechaza_cuerpos_mal_formados(client, auth):
    assert client.put('/me/estados', headers=auth, json={}).status_code == 400
    assert (
        client.put('/me/estados', headers=auth, json={'estados': 'no'}).status_code
        == 400
    )
    assert (
        client.put(
            '/me/estados', headers=auth, json={'estados': [{'id_materia': 'x'}]}
        ).status_code
        == 400
    )


# --- aislamiento entre usuarios ---


def test_el_progreso_es_por_usuario(client, auth, auth_admin, plan_um):
    aprobar_primer_anio(client, auth, plan_um)

    # el otro usuario no ve nada
    assert client.get('/me/estados', headers=auth_admin).json == []
    assert len(client.get('/me/estados', headers=auth).json) == 3


def test_los_estados_de_otra_carrera_no_aportan_creditos(
    client, auth, plan_um, plan
):
    # `plan` es otra carrera. Aprobar sus materias no habilita 2º año de plan_um.
    cuerpo = {
        'estados': [
            {'id_materia': plan['materias']['calculo1'].id_materia, 'estado': 'aprobada'},
            {'id_materia': plan['materias']['algebra'].id_materia, 'estado': 'aprobada'},
        ]
    }
    assert client.put('/me/estados', headers=auth, json=cuerpo).status_code == 200

    respuesta = marcar(client, auth, plan_um['m']['calculo1'].id_materia, 'regular')
    assert respuesta.status_code == 422
    assert respuesta.json['causa'] == 'creditos'
