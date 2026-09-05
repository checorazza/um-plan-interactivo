# src/resources/carrera.py
from flask_restful import Resource, reqparse
from src.models import db
from src.models.carrera import Carrera

# El parser valida y extrae los datos que llegan en el body del request
parser = reqparse.RequestParser()
parser.add_argument('nombre', type=str, required=True,
                    help="El nombre de la carrera es obligatorio")


class Carreras(Resource): #Listado de carreras
    def get(self):
        # Devuelve todas las carreras
        carreras = Carrera.query.all()
        return [c.to_json() for c in carreras], 200

    def post(self):
        # Crea una carrera nueva
        args = parser.parse_args()
        carrera = Carrera(nombre=args['nombre'])
        db.session.add(carrera)
        db.session.commit()
        return carrera.to_json(), 201   # 201 = Created


class Carrera(Resource): #Carrera individual

    def get(self, id_carrera):
        carrera = Carrera.query.get_or_404(id_carrera)
        return carrera.to_json(), 200

    def put(self, id_carrera):
        carrera = Carrera.query.get_or_404(id_carrera)
        args = parser.parse_args()
        carrera.nombre = args['nombre']
        db.session.commit()
        return carrera.to_json(), 200

    def delete(self, id_carrera):
        carrera = Carrera.query.get_or_404(id_carrera)
        db.session.delete(carrera)
        db.session.commit()
        return '', 204   # 204 = No Content