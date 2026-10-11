import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import ConfigTest  # noqa: E402
from src.factory import create_app  # noqa: E402
from src.models import db  # noqa: E402

# Créditos requeridos por año en los planes de la UM.
CREDITOS_POR_ANIO = {1: 0, 2: 12, 3: 38, 4: 90, 5: 130}


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

    calculo1 = Materia(
        codigo='0003', nombre='Cálculo I', creditos=6, semestre='1',
        id_anio=primero.id_anio,
    )
    algebra = Materia(
        codigo='0007', nombre='Álgebra', creditos=6, semestre='1',
        id_anio=primero.id_anio,
    )
    calculo2 = Materia(
        codigo='0004', nombre='Cálculo II', creditos=6, semestre='2',
        id_anio=segundo.id_anio,
    )
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


@pytest.fixture
def plan_um(app):
    """Un plan con los créditos requeridos reales y correlativas encadenadas.

    1º año (0 cr): precalculo 6, quimica 4, informatica 7  -> 17 en total
    2º año (12 cr): calculo1 3 (corr. precalculo), fisica 5 (corr. precalculo)
    3º año (38 cr): calculo2 6 (corr. calculo1)
    """
    from src.models import Anio, Carrera, Materia

    carrera = Carrera(nombre='Ingeniería en Informática')
    db.session.add(carrera)
    db.session.flush()

    anios = {}
    for numero in (1, 2, 3):
        anio = Anio(
            numero=numero,
            creditos_requeridos=CREDITOS_POR_ANIO[numero],
            id_carrera=carrera.id_carrera,
        )
        db.session.add(anio)
        anios[numero] = anio
    db.session.flush()

    def materia(codigo, nombre, creditos, numero_anio, semestre='1'):
        m = Materia(
            codigo=codigo,
            nombre=nombre,
            creditos=creditos,
            semestre=semestre,
            id_anio=anios[numero_anio].id_anio,
        )
        db.session.add(m)
        return m

    precalculo = materia('CP00', 'Precálculo', 6, 1, '1')
    quimica = materia('0002', 'Química General', 4, 1, '2')
    informatica = materia('0009', 'Informática', 7, 1, 'anual')
    calculo1 = materia('0003', 'Cálculo I', 3, 2, '1')
    fisica = materia('2020', 'Física', 5, 2, '2')
    calculo2 = materia('0004', 'Cálculo II', 6, 3, '1')
    db.session.flush()

    calculo1.correlativas = [precalculo]
    fisica.correlativas = [precalculo]
    calculo2.correlativas = [calculo1]
    db.session.commit()

    return {
        'carrera': carrera,
        'anios': anios,
        'm': {
            'precalculo': precalculo,
            'quimica': quimica,
            'informatica': informatica,
            'calculo1': calculo1,
            'fisica': fisica,
            'calculo2': calculo2,
        },
    }


def _token(usuario):
    from flask_jwt_extended import create_access_token

    return create_access_token(identity=str(usuario.id_usuario))


@pytest.fixture
def usuario(app):
    from src.models import Usuario

    u = Usuario(google_sub='sub-usuario', email='ceci@example.com', nombre='Ceci')
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def admin(app):
    from src.models import Usuario

    u = Usuario(
        google_sub='sub-admin', email='admin@example.com', nombre='Admin', es_admin=True
    )
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def auth(usuario):
    """Headers con el JWT de un usuario común."""
    return {'Authorization': f'Bearer {_token(usuario)}'}


@pytest.fixture
def auth_admin(admin):
    """Headers con el JWT de un admin."""
    return {'Authorization': f'Bearer {_token(admin)}'}
