from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_restful import Api
from sqlalchemy import event
from sqlalchemy.engine import Engine

from src.config import Config
from src.models import db

migrate = Migrate()
jwt = JWTManager()


@event.listens_for(Engine, 'connect')
def _activar_foreign_keys(conexion, _record):
    """SQLite ignora las foreign keys salvo que se activen por conexión.

    Sin esto los ON DELETE CASCADE de correlativa y estado_materia no corren,
    y borrar una materia dejaría filas huérfanas.
    """
    if conexion.__class__.__module__.startswith('sqlite3'):
        cursor = conexion.cursor()
        cursor.execute('PRAGMA foreign_keys=ON')
        cursor.close()


def create_app(config=None):
    """Construye la app. `config` permite inyectar otra configuración en tests."""
    app = Flask(__name__)
    app.config.update((config or Config()).as_dict())

    db.init_app(app)
    migrate.init_app(app, db, directory='migrations')
    jwt.init_app(app)
    CORS(app, origins=app.config['CORS_ORIGINS'])

    _registrar_recursos(app)

    return app


def _registrar_recursos(app):
    # Import diferido: los recursos importan `src.models`, que vive bajo el
    # paquete `src`. Importarlos acá evita el ciclo al cargar `src`.
    from src.resources.anio import Anio, Anios
    from src.resources.carrera import Carrera, Carreras
    from src.resources.materia import Materia, Materias

    api = Api(app)

    api.add_resource(Carreras, '/carreras')
    api.add_resource(Carrera, '/carreras/<int:id_carrera>')

    api.add_resource(Anios, '/anios')
    api.add_resource(Anio, '/anios/<int:id_anio>')

    api.add_resource(Materias, '/materias')
    api.add_resource(Materia, '/materias/<int:id_materia>')
