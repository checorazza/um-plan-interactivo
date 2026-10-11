import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ORIGENES_POR_DEFECTO = 'http://localhost:5173,http://127.0.0.1:5173'

# HS256 firma con HMAC-SHA256: por debajo de 32 bytes la clave es más corta que
# el hash y PyJWT avisa. Ver RFC 7518, sección 3.2.
LARGO_MINIMO_SECRETO = 32


def _lista(valor):
    return [x.strip() for x in valor.split(',') if x.strip()]


def normalizar_url(url):
    """Deja la URL de la base en la forma que espera SQLAlchemy.

    Los proveedores gestionados (Neon entre ellos) entregan la cadena como
    `postgres://` o `postgresql://`. SQLAlchemy no entiende la primera, y la
    segunda la resuelve con psycopg2, que no está instalado: usamos psycopg 3.
    Las dos se reescriben a `postgresql+psycopg://`.
    """
    if not url:
        return url
    for prefijo in ('postgres://', 'postgresql://'):
        if url.startswith(prefijo):
            return 'postgresql+psycopg://' + url[len(prefijo):]
    return url


def ruta_base_de_datos():
    """Directorio donde vive el SQLite. Lo crea si no existe."""
    directorio = os.path.join(BASE_DIR, os.getenv('DATABASE_PATH', 'database'))
    os.makedirs(directorio, exist_ok=True)
    return directorio


class Config:
    """Configuración leída del entorno.

    Las variables están documentadas en `.env-example`.
    """

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    def __init__(self):
        nombre = os.getenv('DATABASE_NAME', 'planinteractivo.db')
        self.SQLALCHEMY_DATABASE_URI = normalizar_url(
            os.getenv('DATABASE_URL')
        ) or f'sqlite:///{os.path.join(ruta_base_de_datos(), nombre)}'
        self.JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
        self.JWT_ACCESS_TOKEN_EXPIRES = int(
            os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 60 * 60 * 24 * 7)
        )
        self.GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
        # Una variable definida pero vacía cuenta como ausente: si no, CORS
        # quedaría con lista vacía y bloquearía todos los orígenes.
        self.CORS_ORIGINS = _lista(
            os.getenv('CORS_ORIGINS') or ORIGENES_POR_DEFECTO
        )
        self.PORT = int(os.getenv('PORT', 5000))

    def as_dict(self):
        return {
            clave: getattr(self, clave)
            for clave in dir(self)
            if clave.isupper() and not clave.startswith('_')
        }


class ConfigTest(Config):
    """Base en memoria y secretos fijos, para los tests."""

    TESTING = True

    def __init__(self):
        super().__init__()
        self.SQLALCHEMY_DATABASE_URI = 'sqlite://'
        self.JWT_SECRET_KEY = 'x' * LARGO_MINIMO_SECRETO
        self.GOOGLE_CLIENT_ID = 'test-client-id'
        self.CORS_ORIGINS = ['http://localhost:5173']
