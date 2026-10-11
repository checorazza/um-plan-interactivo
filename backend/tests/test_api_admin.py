"""El catálogo se lee sin sesión, pero sólo un admin lo puede modificar."""

import pytest

LECTURAS = ['/carreras', '/anios', '/materias']


@pytest.mark.parametrize('ruta', LECTURAS)
def test_el_catalogo_se_lee_sin_sesion(client, plan, ruta):
    assert client.get(ruta).status_code == 200


def test_crear_carrera_sin_sesion(client):
    assert client.post('/carreras', json={'nombre': 'X'}).status_code == 401


def test_crear_carrera_como_usuario_comun(client, auth):
    respuesta = client.post('/carreras', headers=auth, json={'nombre': 'X'})
    assert respuesta.status_code == 403
    assert 'administrador' in respuesta.json['message']


def test_crear_carrera_como_admin(client, auth_admin):
    respuesta = client.post('/carreras', headers=auth_admin, json={'nombre': 'X'})
    assert respuesta.status_code == 201


def test_borrar_carrera_como_usuario_comun(client, auth, plan):
    id_carrera = plan['carrera'].id_carrera
    assert client.delete(f'/carreras/{id_carrera}', headers=auth).status_code == 403


def test_crear_anio_requiere_admin(client, auth, plan):
    cuerpo = {
        'numero': 3,
        'id_carrera': plan['carrera'].id_carrera,
        'creditos_requeridos': 38,
    }
    assert client.post('/anios', headers=auth, json=cuerpo).status_code == 403
    assert client.post('/anios', json=cuerpo).status_code == 401


def test_crear_materia_requiere_admin(client, auth, plan):
    cuerpo = {
        'codigo': '1111',
        'nombre': 'Nueva',
        'creditos': 4,
        'id_anio': plan['anios'][1].id_anio,
    }
    assert client.post('/materias', headers=auth, json=cuerpo).status_code == 403


def test_borrar_materia_requiere_admin(client, auth_admin, plan):
    id_materia = plan['materias']['calculo1'].id_materia
    assert (
        client.delete(f'/materias/{id_materia}', headers=auth_admin).status_code == 204
    )
