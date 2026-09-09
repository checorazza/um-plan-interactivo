from flask import Flask
from flask_restful import Api
from src.models import db

# Importacion de recursos
from src.resources.carrera import Carreras, Carrera
from src.resources.anio import Anios, Anio
from src.resources.materia import Materias, Materia, MateriaEstado

app = Flask(__name__)
api = Api(app)

# Configuración de SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
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

if __name__ == '__main__':
    app.run(debug=True)