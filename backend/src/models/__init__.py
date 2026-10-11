from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .anio import Anio
from .carrera import Carrera
from .materia import ORDEN_SEMESTRE, SEMESTRES, Materia, correlativa
from .usuario import Usuario
from .estado_materia import ESTADOS, EstadoMateria

__all__ = [
    'db',
    'Anio',
    'Carrera',
    'Materia',
    'correlativa',
    'SEMESTRES',
    'ORDEN_SEMESTRE',
    'Usuario',
    'EstadoMateria',
    'ESTADOS',
]
