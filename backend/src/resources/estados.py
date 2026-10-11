"""Progreso del usuario: los estados de cursado de sus materias.

Toda escritura pasa por el motor de reglas (`src/domain/reglas.py`). El backend
no confía en el cliente: aunque el front ya valide, acá se vuelve a validar.
"""

from flask import request
from flask_restful import Resource, abort

from src.auth.guards import requiere_usuario
from src.domain.reglas import ESTADOS, puede_marcar, validar_conjunto
from src.models import EstadoMateria, db
from src.services.basicas import expandir, propagar
from src.services.plan import carrera_de_materia, carreras_de_materias, cargar_plan


def _conflictos_json(conflictos):
    return [
        {'id_materia': c.id_materia, 'motivo': c.motivo, 'causa': c.causa}
        for c in conflictos
    ]


def _estados_del_usuario(id_usuario):
    """{id_materia: estado} de todas las materias del usuario."""
    filas = EstadoMateria.query.filter_by(id_usuario=id_usuario).all()
    return {f.id_materia: f.estado for f in filas}


def _estados_en_carrera(id_usuario, id_carrera):
    """{id_materia: estado} acotado a las materias de una carrera."""
    estados = _estados_del_usuario(id_usuario)
    por_materia = carreras_de_materias(estados.keys())
    return _filtrar_por_carrera(estados, id_carrera, por_materia)


def _listar(id_usuario):
    filas = (
        EstadoMateria.query.filter_by(id_usuario=id_usuario)
        .order_by(EstadoMateria.id_materia)
        .all()
    )
    return [f.to_json() for f in filas]


def _filtrar_por_carrera(estados, id_carrera, por_materia):
    return {
        id_materia: estado
        for id_materia, estado in estados.items()
        if por_materia.get(id_materia) == id_carrera
    }


def _guardar(id_usuario, id_materia, estado):
    fila = db.session.get(EstadoMateria, (id_usuario, id_materia))
    if fila is None:
        db.session.add(
            EstadoMateria(
                id_usuario=id_usuario, id_materia=id_materia, estado=estado
            )
        )
    else:
        fila.estado = estado


class MisEstados(Resource):
    """`GET /me/estados` y `PUT /me/estados` (reemplazo completo)."""

    @requiere_usuario
    def get(self, usuario):
        return _listar(usuario.id_usuario), 200

    @requiere_usuario
    def put(self, usuario):
        """Reemplaza todo el progreso del usuario. Es lo que usa el push del sync."""
        cuerpo = request.get_json(silent=True) or {}
        entrada = cuerpo.get('estados')
        if not isinstance(entrada, list):
            abort(400, message="Esperaba {'estados': [...]}")

        propuesto = {}
        for item in entrada:
            if not isinstance(item, dict):
                abort(400, message='Cada estado tiene que ser un objeto')
            id_materia = item.get('id_materia')
            estado = item.get('estado')
            if not isinstance(id_materia, int):
                abort(400, message='id_materia tiene que ser un entero')
            if estado not in ESTADOS:
                abort(
                    400,
                    message=(
                        f'Estado inválido para la materia {id_materia}: '
                        f'{estado!r}. Esperaba uno de {list(ESTADOS)}'
                    ),
                )
            propuesto[id_materia] = estado

        # Las básicas se comparten entre carreras: marcar una marca a sus
        # equivalentes. Se expande antes de validar para que cada plan se
        # evalúe con lo que realmente va a quedar guardado.
        propuesto = expandir(propuesto)

        por_materia = carreras_de_materias(propuesto.keys())
        desconocidas = sorted(set(propuesto) - set(por_materia))
        if desconocidas:
            abort(
                422,
                message='No existen estas materias: '
                + ', '.join(str(i) for i in desconocidas),
            )

        # Las materias de distintas carreras no se afectan entre sí, así que
        # cada carrera se valida con su propio plan.
        conflictos = []
        for id_carrera in sorted(set(por_materia.values())):
            plan = cargar_plan(id_carrera)
            del_plan = _filtrar_por_carrera(propuesto, id_carrera, por_materia)
            conflictos.extend(validar_conjunto(plan, del_plan))

        if conflictos:
            abort(
                422,
                message='El progreso enviado no cumple las reglas del plan',
                conflictos=_conflictos_json(conflictos),
            )

        EstadoMateria.query.filter_by(id_usuario=usuario.id_usuario).delete()
        for id_materia, estado in propuesto.items():
            db.session.add(
                EstadoMateria(
                    id_usuario=usuario.id_usuario,
                    id_materia=id_materia,
                    estado=estado,
                )
            )
        db.session.commit()

        return _listar(usuario.id_usuario), 200


class MiEstadoMateria(Resource):
    """`PUT` y `DELETE` sobre `/me/estados/<id_materia>`: cambios puntuales."""

    @requiere_usuario
    def put(self, usuario, id_materia):
        cuerpo = request.get_json(silent=True) or {}
        estado = cuerpo.get('estado')
        if estado not in ESTADOS:
            abort(
                400,
                message=f'Estado inválido: {estado!r}. Esperaba uno de {list(ESTADOS)}',
            )

        id_carrera = carrera_de_materia(id_materia)
        if id_carrera is None:
            abort(404, message='No existe esa materia')

        plan = cargar_plan(id_carrera)
        actuales = _estados_en_carrera(usuario.id_usuario, id_carrera)

        sin_esta = {k: v for k, v in actuales.items() if k != id_materia}
        resultado = puede_marcar(plan, sin_esta, id_materia, estado)
        if not resultado.ok:
            abort(422, message=resultado.motivo, causa=resultado.causa)

        # El cambio puede ser válido para esta materia pero romper otras: bajar
        # de aprobada a regular invalida a quien la tenga como correlativa.
        conflictos = validar_conjunto(plan, {**sin_esta, id_materia: estado})
        if conflictos:
            abort(
                409,
                message=(
                    'El cambio deja inconsistentes otras materias. Revertilas '
                    'en cascada y mandá el progreso completo con PUT /me/estados'
                ),
                conflictos=_conflictos_json(conflictos),
            )

        _guardar(usuario.id_usuario, id_materia, estado)
        aplicados, omitidos = propagar(usuario.id_usuario, id_materia, estado)
        db.session.commit()

        fila = db.session.get(EstadoMateria, (usuario.id_usuario, id_materia))
        cuerpo = fila.to_json()
        if aplicados or omitidos:
            cuerpo['propagado_a'] = aplicados
            cuerpo['no_propagado'] = omitidos
        return cuerpo, 200

    @requiere_usuario
    def delete(self, usuario, id_materia):
        fila = db.session.get(EstadoMateria, (usuario.id_usuario, id_materia))
        if fila is None:
            return '', 204  # idempotente: ya no tenía estado

        id_carrera = carrera_de_materia(id_materia)
        plan = cargar_plan(id_carrera)
        actuales = _estados_en_carrera(usuario.id_usuario, id_carrera)

        restantes = {k: v for k, v in actuales.items() if k != id_materia}
        conflictos = validar_conjunto(plan, restantes)
        if conflictos:
            abort(
                409,
                message=(
                    'Desmarcar esta materia deja inconsistentes otras. '
                    'Revertilas en cascada y mandá el progreso completo con '
                    'PUT /me/estados'
                ),
                conflictos=_conflictos_json(conflictos),
            )

        db.session.delete(fila)
        aplicados, omitidos = propagar(usuario.id_usuario, id_materia, None)
        db.session.commit()

        if aplicados or omitidos:
            return {'propagado_a': aplicados, 'no_propagado': omitidos}, 200
        return '', 204
