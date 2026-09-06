# src/resources/anio.py
from flask_restful import Resource, reqparse
from src.models import db
from src.models.anio import Anio

parser = reqparse.RequestParser()
parser.add_argument('numero', type=int, required=True, help="El número de año es obligatorio")
parser.add_argument('id_carrera', type=int, required=True, help="La carrera es obligatoria")
parser.add_argument('creditos_requeridos', type=int, required=True, help="Los créditos requeridos son obligatorios")


class Anios(Resource): #Lista de años (cómo detesto escribir anio)
    def get(self):
        return [a.to_json() for a in Anio.query.all()], 200

    def post(self):
        args = parser.parse_args()
        anio = Anio(numero=args['numero'], id_carrera=args['id_carrera'], creditos_requeridos=args['creditos_requeridos'])
        db.session.add(anio)
        db.session.commit()
        return anio.to_json(), 201


class Anio(Resource): #Año individual
    def get(self, id_anio):
        return Anio.query.get_or_404(id_anio).to_json(), 200

    def put(self, id_anio):
        anio = Anio.query.get_or_404(id_anio)
        args = parser.parse_args()
        anio.numero = args['numero']
        anio.id_carrera = args['id_carrera']
        anio.creditos_requeridos = args['creditos_requeridos']
        db.session.commit()
        return anio.to_json(), 200

    def delete(self, id_anio):
        anio = Anio.query.get_or_404(id_anio)
        db.session.delete(anio)
        db.session.commit()
        return '', 204