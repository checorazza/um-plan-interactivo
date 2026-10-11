from flask_restful import Resource, abort

from src.services.plan import plan_json


class CarreraPlan(Resource):
    """`GET /carreras/<id>/plan`: la carrera, sus años y sus materias en un payload.

    Es la única llamada que necesita el front para dibujar la malla completa.
    """

    def get(self, id_carrera):
        plan = plan_json(id_carrera)
        if plan is None:
            abort(404, message='No existe esa carrera')
        return plan, 200
