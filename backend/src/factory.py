from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_restful import Api
from sqlalchemy import event
from sqlalchemy.engine import Engine

from src.config import LARGO_MINIMO_SECRETO, Config
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

    _verificar_secreto(app)

    db.init_app(app)
    migrate.init_app(app, db, directory='migrations')
    jwt.init_app(app)
    CORS(app, origins=app.config['CORS_ORIGINS'])

    _registrar_errores_de_jwt()
    _registrar_recursos(app)

    return app


def _registrar_errores_de_jwt():
    """Unifica los errores de autenticación en 401 con `message`.

    Por defecto flask-jwt-extended contesta 422 cuando el token está mal
    formado o la firma no verifica, y 401 sólo cuando venció. Para el cliente
    las tres cosas significan lo mismo —hay que volver a iniciar sesión— y 422
    ya lo usamos para las violaciones de reglas del plan, así que mezclarlos
    hacía que una sesión muerta pasara por un error de validación.
    """

    def sesion_invalida(mensaje):
        return jsonify({'message': mensaje}), 401

    @jwt.expired_token_loader
    def vencido(_cabecera, _datos):
        return sesion_invalida('La sesión venció, volvé a iniciar sesión')

    @jwt.invalid_token_loader
    def invalido(_motivo):
        return sesion_invalida('La sesión no es válida, volvé a iniciar sesión')

    @jwt.unauthorized_loader
    def sin_token(_motivo):
        return sesion_invalida('Hace falta iniciar sesión')

    @jwt.revoked_token_loader
    def revocado(_cabecera, _datos):
        return sesion_invalida('La sesión fue cerrada, volvé a iniciar sesión')


def _verificar_secreto(app):
    """Falla al arrancar, no en el primer login, si el secreto no sirve."""
    secreto = app.config.get('JWT_SECRET_KEY')
    if not secreto:
        raise RuntimeError(
            'Falta JWT_SECRET_KEY. Definila en el .env (ver .env-example).'
        )
    if len(secreto) < LARGO_MINIMO_SECRETO:
        raise RuntimeError(
            f'JWT_SECRET_KEY tiene {len(secreto)} caracteres; hacen falta al '
            f'menos {LARGO_MINIMO_SECRETO} para firmar con HS256. '
            'Generá una con: python -c "import secrets; print(secrets.token_urlsafe(32))"'
        )


def _registrar_recursos(app):
    # Import diferido: los recursos importan `src.models`, que vive bajo el
    # paquete `src`. Importarlos acá evita el ciclo al cargar `src`.
    from src.resources.anio import Anio, Anios
    from src.resources.auth import AuthGoogle, Yo
    from src.resources.carrera import Carrera, Carreras
    from src.resources.estados import MiEstadoMateria, MisEstados
    from src.resources.materia import Materia, Materias
    from src.resources.plan import CarreraPlan

    api = Api(app)

    # Catálogo: lectura pública, escritura sólo para admins.
    api.add_resource(Carreras, '/carreras')
    api.add_resource(Carrera, '/carreras/<int:id_carrera>')
    api.add_resource(CarreraPlan, '/carreras/<int:id_carrera>/plan')

    api.add_resource(Anios, '/anios')
    api.add_resource(Anio, '/anios/<int:id_anio>')

    api.add_resource(Materias, '/materias')
    api.add_resource(Materia, '/materias/<int:id_materia>')

    # Sesión y progreso del usuario.
    api.add_resource(AuthGoogle, '/auth/google')
    api.add_resource(Yo, '/me')
    api.add_resource(MisEstados, '/me/estados')
    api.add_resource(MiEstadoMateria, '/me/estados/<int:id_materia>')
