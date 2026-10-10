from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .anio import Anio
from .carrera import Carrera
from .materia import Materia, correlativa
from .usuario import Usuario
from .estado_materia import ESTADOS, EstadoMateria

__all__ = [
    'db',
    'Anio',
    'Carrera',
    'Materia',
    'correlativa',
    'Usuario',
    'EstadoMateria',
    'ESTADOS',
]
