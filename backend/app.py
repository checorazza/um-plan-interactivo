from flask import Flask

# Importacion de recursos
from src.resources.carrera import Carreras, Carrera
from src.resources.anio import Anios, Anio
from src.resources.materia import Materias, Materia

app = Flask(__name__)

# Configuración de SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Registro de rutas
api.add_resource(Carreras, '/carreras')
api.add_resource(Carrera, '/carreras/<int:id_carrera>')

api.add_resource(Anios, '/anios')
api.add_resource(Anio, '/anios/<int:id_anio>')

api.add_resource(Materias, '/materias')
api.add_resource(Materia, '/materias/<int:id_materia>')