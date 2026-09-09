# src/resources/materia.py
from flask_restful import Resource, reqparse
from src.models import db
from src.models.materia import Materia

parser = reqparse.RequestParser()
parser.add_argument('nombre', type=str, required=True, help="El nombre es obligatorio")
parser.add_argument('creditos', type=int, required=True, help="Los créditos son obligatorios")
parser.add_argument('id_anio', type=int, required=True, help="El año es obligatorio")
parser.add_argument('id_correlativa', type=int, required=False)  # opcional

estado_parser = reqparse.RequestParser()
estado_parser.add_argument('es_regular', type=bool, required=False)
estado_parser.add_argument('es_aprobada', type=bool, required=False)


class Materias(Resource): #Lista de materias
    def get(self):
        return [m.to_json() for m in Materia.query.all()], 200

    def post(self):
        args = parser.parse_args()
        materia = Materia(
            nombre=args['nombre'],
            creditos=args['creditos'],
            id_anio=args['id_anio'],
            id_correlativa=args.get('id_correlativa'),  # puede ser None
        )
        db.session.add(materia)
        db.session.commit()
        return materia.to_json(), 201


class Materia(Resource): #Materia individual
    def get(self, id_materia):
        return Materia.query.get_or_404(id_materia).to_json(), 200

    def put(self, id_materia):
        materia = Materia.query.get_or_404(id_materia)
        args = parser.parse_args()
        materia.nombre = args['nombre']
        materia.creditos = args['creditos']
        materia.id_anio = args['id_anio']
        materia.id_correlativa = args.get('id_correlativa')
        db.session.commit()
        return materia.to_json(), 200

    def delete(self, id_materia):
        materia = Materia.query.get_or_404(id_materia)
        db.session.delete(materia)
        db.session.commit()
        return '', 204

class MateriaEstado(Resource):
    def put(self, id_materia):
        materia = Materia.query.get_or_404(id_materia)
        args = estado_parser.parse_args()
        if args['es_regular'] is not None:
            materia.es_regular = args['es_regular']
        if args['es_aprobada'] is not None:
            materia.es_aprobada = args['es_aprobada']
        db.session.commit()
        return materia.to_json(), 200