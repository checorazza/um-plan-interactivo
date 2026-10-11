"""La app falla al arrancar, no en el primer login, si la config no sirve."""

import pytest

from src.config import LARGO_MINIMO_SECRETO, ConfigTest
from src.factory import create_app


def test_arranca_con_una_config_valida():
    assert create_app(ConfigTest()) is not None


def test_falla_sin_secreto():
    config = ConfigTest()
    config.JWT_SECRET_KEY = None
    with pytest.raises(RuntimeError, match='Falta JWT_SECRET_KEY'):
        create_app(config)


def test_falla_con_secreto_corto():
    config = ConfigTest()
    config.JWT_SECRET_KEY = 'corto'
    with pytest.raises(RuntimeError, match='al menos 32'):
        create_app(config)


def test_el_largo_minimo_es_el_del_hash():
    # HS256 usa SHA-256: 32 bytes
    assert LARGO_MINIMO_SECRETO == 32


def test_cors_vacio_cae_en_el_default(monkeypatch):
    from src.config import ORIGENES_POR_DEFECTO, Config

    monkeypatch.setenv('CORS_ORIGINS', '')
    monkeypatch.setenv('JWT_SECRET_KEY', 'x' * 32)
    assert Config().CORS_ORIGINS == ORIGENES_POR_DEFECTO.split(',')


def test_url_de_neon_usa_psycopg3(monkeypatch):
    from src.config import normalizar_url

    # Neon entrega la cadena en cualquiera de estas dos formas
    assert normalizar_url('postgres://u:c@host/db') == (
        'postgresql+psycopg://u:c@host/db'
    )
    assert normalizar_url('postgresql://u:c@host/db?sslmode=require') == (
        'postgresql+psycopg://u:c@host/db?sslmode=require'
    )


def test_normalizar_url_no_toca_lo_demas():
    from src.config import normalizar_url

    assert normalizar_url('sqlite:///x.db') == 'sqlite:///x.db'
    assert normalizar_url('postgresql+psycopg://u@h/d') == 'postgresql+psycopg://u@h/d'
    assert normalizar_url(None) is None


def test_database_url_gana_sobre_el_sqlite_local(monkeypatch):
    from src.config import Config

    monkeypatch.setenv('JWT_SECRET_KEY', 'x' * 32)
    monkeypatch.setenv('DATABASE_URL', 'postgres://u:c@host/db')
    assert Config().SQLALCHEMY_DATABASE_URI.startswith('postgresql+psycopg://')


def test_sin_database_url_usa_sqlite(monkeypatch):
    from src.config import Config

    monkeypatch.setenv('JWT_SECRET_KEY', 'x' * 32)
    monkeypatch.delenv('DATABASE_URL', raising=False)
    assert Config().SQLALCHEMY_DATABASE_URI.startswith('sqlite:///')


def test_cors_lee_la_lista_del_entorno(monkeypatch):
    from src.config import Config

    monkeypatch.setenv('CORS_ORIGINS', 'https://a.com, https://b.com ')
    monkeypatch.setenv('JWT_SECRET_KEY', 'x' * 32)
    assert Config().CORS_ORIGINS == ['https://a.com', 'https://b.com']
