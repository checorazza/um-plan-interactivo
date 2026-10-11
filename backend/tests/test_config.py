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


def test_cors_lee_la_lista_del_entorno(monkeypatch):
    from src.config import Config

    monkeypatch.setenv('CORS_ORIGINS', 'https://a.com, https://b.com ')
    monkeypatch.setenv('JWT_SECRET_KEY', 'x' * 32)
    assert Config().CORS_ORIGINS == ['https://a.com', 'https://b.com']
