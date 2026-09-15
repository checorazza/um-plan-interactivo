from flask import Flask
from flask_restful import Api
from flask_cors import CORS
from src.models import db
import os
from dotenv import load_dotenv

# Importacion de recursos
from src.resources.carrera import Carreras, Carrera
from src.resources.anio import Anios, Anio
from src.resources.materia import Materias, Materia, MateriaEstado

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.getenv('DATABASE_PATH', 'database')
DATABASE_NAME = os.getenv('DATABASE_NAME', 'database.db')
db_dir = os.path.join(BASE_DIR, DATABASE_PATH)
os.makedirs(db_dir, exist_ok=True)

app = Flask(__name__)
CORS(app)
api = Api(app)

# Configuración de SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(db_dir, DATABASE_NAME)}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# Registro de rutas
api.add_resource(Carreras, '/carreras')
api.add_resource(Carrera, '/carreras/<int:id_carrera>')

api.add_resource(Anios, '/anios')
api.add_resource(Anio, '/anios/<int:id_anio>')

api.add_resource(Materias, '/materias')
api.add_resource(Materia, '/materias/<int:id_materia>')
api.add_resource(MateriaEstado, '/materias/<int:id_materia>/estado')

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)