"""Tests del login con Google.

La verificación del ID token se reemplaza para no salir a la red: lo que se
prueba acá es qué hace la API con los datos ya verificados.
"""

import pytest

from src.auth.google import ErrorDeToken
from src.models import Usuario, db


@pytest.fixture
def google_ok(monkeypatch):
    """Hace que cualquier token valga y devuelva una cuenta fija."""

    def falso(token, client_id):
        assert client_id == 'test-client-id'
        return {
            'sub': 'sub-google-123',
            'email': 'ceci@example.com',
            'nombre': 'Ceci',
            'foto_url': 'https://example.com/foto.jpg',
        }

    monkeypatch.setattr('src.resources.auth.verificar_id_token', falso)


@pytest.fixture
def google_falla(monkeypatch):
    def falso(token, client_id):
        raise ErrorDeToken('ID token inválido: expirado')

    monkeypatch.setattr('src.resources.auth.verificar_id_token', falso)


def test_login_crea_el_usuario_la_primera_vez(client, google_ok):
    respuesta = client.post('/api/auth/google', json={'id_token': 'lo-que-sea'})

    assert respuesta.status_code == 200
    assert respuesta.json['access_token']
    assert respuesta.json['usuario']['email'] == 'ceci@example.com'
    assert respuesta.json['usuario']['es_admin'] is False

    assert Usuario.query.count() == 1
    assert Usuario.query.first().google_sub == 'sub-google-123'


def test_login_reusa_el_usuario_existente(client, google_ok):
    primera = client.post('/api/auth/google', json={'id_token': 'a'})
    segunda = client.post('/api/auth/google', json={'id_token': 'b'})

    assert primera.json['usuario']['id_usuario'] == segunda.json['usuario']['id_usuario']
    assert Usuario.query.count() == 1


def test_login_actualiza_el_perfil(client, google_ok):
    usuario = Usuario(
        google_sub='sub-google-123', email='viejo@example.com', nombre='Viejo'
    )
    db.session.add(usuario)
    db.session.commit()

    respuesta = client.post('/api/auth/google', json={'id_token': 'a'})

    assert respuesta.json['usuario']['email'] == 'ceci@example.com'
    assert respuesta.json['usuario']['nombre'] == 'Ceci'
    assert Usuario.query.count() == 1


def test_login_con_token_invalido(client, google_falla):
    respuesta = client.post('/api/auth/google', json={'id_token': 'malo'})
    assert respuesta.status_code == 401
    assert 'inválido' in respuesta.json['message']


def test_login_sin_token(client):
    assert client.post('/api/auth/google', json={}).status_code == 400


def test_login_sin_client_id_configurado(client, app):
    # Si el servidor no tiene GOOGLE_CLIENT_ID, el login no se puede hacer
    app.config['GOOGLE_CLIENT_ID'] = None
    respuesta = client.post('/api/auth/google', json={'id_token': 'x'})
    assert respuesta.status_code == 401
    assert 'no está configurado' in respuesta.json['message']


def test_me_devuelve_el_perfil(client, auth, usuario):
    respuesta = client.get('/api/me', headers=auth)
    assert respuesta.status_code == 200
    assert respuesta.json['email'] == usuario.email


def test_me_sin_token(client):
    respuesta = client.get('/api/me')
    assert respuesta.status_code == 401
    assert 'message' in respuesta.json


def test_me_con_token_mal_formado(client):
    # flask-jwt-extended contesta 422 por defecto; lo unificamos en 401 para
    # que el cliente pueda distinguir "sesión muerta" de "regla incumplida".
    respuesta = client.get('/api/me', headers={'Authorization': 'Bearer no-es-un-jwt'})
    assert respuesta.status_code == 401
    assert 'message' in respuesta.json


def test_me_con_firma_invalida(client, auth):
    token = auth['Authorization'].removeprefix('Bearer ')
    roto = token[:-4] + 'xxxx'
    respuesta = client.get('/api/me', headers={'Authorization': f'Bearer {roto}'})
    assert respuesta.status_code == 401
    assert 'message' in respuesta.json


def test_los_errores_de_auth_no_se_confunden_con_los_de_reglas(client, auth):
    # 422 queda reservado para las violaciones de reglas del plan
    sin_sesion = client.get('/api/me/estados')
    assert sin_sesion.status_code == 401


def test_me_con_token_de_usuario_borrado(client, auth, usuario):
    db.session.delete(usuario)
    db.session.commit()

    respuesta = client.get('/api/me', headers=auth)
    assert respuesta.status_code == 401
    assert 'volvé a iniciar sesión' in respuesta.json['message']


def test_borrar_cuenta(client, auth, usuario):
    assert client.delete('/api/me', headers=auth).status_code == 204
    assert Usuario.query.count() == 0
