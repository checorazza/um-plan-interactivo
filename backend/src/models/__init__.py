from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .anio import Anio
from .carrera import Carrera
from .materia import Materia