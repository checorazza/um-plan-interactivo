import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import ConfigTest  # noqa: E402
from src.factory import create_app  # noqa: E402
from src.models import db  # noqa: E402


@pytest.fixture
def app():
    app = create_app(ConfigTest())
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def plan(app):
    """Una carrera mínima: 2 años y 3 materias, sin correlativas todavía."""
    from src.models import Anio, Carrera, Materia

    carrera = Carrera(nombre='Ingeniería en Informática')
    db.session.add(carrera)
    db.session.flush()

    primero = Anio(numero=1, creditos_requeridos=0, id_carrera=carrera.id_carrera)
    segundo = Anio(numero=2, creditos_requeridos=10, id_carrera=carrera.id_carrera)
    db.session.add_all([primero, segundo])
    db.session.flush()

    calculo1 = Materia(codigo='0003', nombre='Cálculo I', creditos=6, id_anio=primero.id_anio)
    algebra = Materia(codigo='0007', nombre='Álgebra', creditos=6, id_anio=primero.id_anio)
    calculo2 = Materia(codigo='0004', nombre='Cálculo II', creditos=6, id_anio=segundo.id_anio)
    db.session.add_all([calculo1, algebra, calculo2])
    db.session.commit()

    return {
        'carrera': carrera,
        'anios': {1: primero, 2: segundo},
        'materias': {
            'calculo1': calculo1,
            'algebra': algebra,
            'calculo2': calculo2,
        },
    }
