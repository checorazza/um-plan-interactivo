from flask_restful import Resource, abort, reqparse

from src.domain.correlativas import CorrelativaInvalida, validar_correlativas_db
from src.models import db
from src.models.materia import Materia as MateriaModel

parser = reqparse.RequestParser()
parser.add_argument('codigo', type=str, required=True, help="El código del plan es obligatorio")
parser.add_argument('nombre', type=str, required=True, help="El nombre es obligatorio")
parser.add_argument('creditos', type=int, required=True, help="Los créditos son obligatorios")
parser.add_argument('id_anio', type=int, required=True, help="El año es obligatorio")
parser.add_argument(
    'correlativas',
    type=int,
    action='append',
    required=False,
    help="Lista de ids de materias que hay que aprobar antes que esta",
)


def _asignar_correlativas(materia, ids):
    """Valida los requisitos propuestos y los asigna a la materia."""
    try:
        materia.correlativas = validar_correlativas_db(
            materia.id_materia, ids or [], MateriaModel
        )
    except CorrelativaInvalida as error:
        db.session.rollback()
        abort(422, message=str(error))


class Materias(Resource):  # Lista de materias
    def get(self):
        return [m.to_json() for m in MateriaModel.query.all()], 200

    def post(self):
        args = parser.parse_args()
        materia = MateriaModel(
            codigo=args['codigo'],
            nombre=args['nombre'],
            creditos=args['creditos'],
            id_anio=args['id_anio'],
        )
        db.session.add(materia)
        # flush para que la materia tenga id antes de validar el ciclo
        db.session.flush()
        _asignar_correlativas(materia, args['correlativas'])
        db.session.commit()
        return materia.to_json(), 201


class Materia(Resource):  # Materia individual
    def get(self, id_materia):
        return db.get_or_404(MateriaModel, id_materia).to_json(), 200

    def put(self, id_materia):
        materia = db.get_or_404(MateriaModel, id_materia)
        args = parser.parse_args()
        materia.codigo = args['codigo']
        materia.nombre = args['nombre']
        materia.creditos = args['creditos']
        materia.id_anio = args['id_anio']
        _asignar_correlativas(materia, args['correlativas'])
        db.session.commit()
        return materia.to_json(), 200

    def delete(self, id_materia):
        materia = db.get_or_404(MateriaModel, id_materia)
        db.session.delete(materia)
        db.session.commit()
        return '', 204
