"""Carga del plan de una carrera desde la base, para el motor de reglas y la API."""

from src.domain.reglas import AnioPlan, MateriaPlan, Plan
from src.models import Anio, Carrera, Materia, db


def _materias_de(id_carrera):
    return (
        Materia.query.join(Anio, Materia.id_anio == Anio.id_anio)
        .filter(Anio.id_carrera == id_carrera)
        .order_by(Anio.numero, Materia.codigo)
        .all()
    )


def cargar_plan(id_carrera):
    """Arma el `Plan` puro que consumen las reglas. None si la carrera no existe."""
    carrera = db.session.get(Carrera, id_carrera)
    if carrera is None:
        return None

    anios = {
        a.id_anio: AnioPlan(
            id_anio=a.id_anio,
            numero=a.numero,
            creditos_requeridos=a.creditos_requeridos,
        )
        for a in Anio.query.filter_by(id_carrera=id_carrera).all()
    }

    materias = {
        m.id_materia: MateriaPlan(
            id_materia=m.id_materia,
            nombre=m.nombre,
            creditos=m.creditos,
            id_anio=m.id_anio,
            correlativas=tuple(c.id_materia for c in m.correlativas),
        )
        for m in _materias_de(id_carrera)
    }

    return Plan(id_carrera=id_carrera, anios=anios, materias=materias)


def plan_json(id_carrera):
    """Payload de `GET /carreras/<id>/plan`: todo lo que el front necesita.

    None si la carrera no existe.
    """
    carrera = db.session.get(Carrera, id_carrera)
    if carrera is None:
        return None

    anios = Anio.query.filter_by(id_carrera=id_carrera).order_by(Anio.numero).all()
    materias = _materias_de(id_carrera)

    return {
        'carrera': carrera.to_json(),
        'anios': [a.to_json() for a in anios],
        'materias': [m.to_json() for m in materias],
    }


def carrera_de_materia(id_materia):
    """Id de la carrera a la que pertenece una materia. None si no existe."""
    fila = (
        db.session.query(Anio.id_carrera)
        .join(Materia, Materia.id_anio == Anio.id_anio)
        .filter(Materia.id_materia == id_materia)
        .first()
    )
    return fila[0] if fila else None


def carreras_de_materias(ids_materias):
    """Mapa {id_materia: id_carrera} para un lote de materias."""
    if not ids_materias:
        return {}
    filas = (
        db.session.query(Materia.id_materia, Anio.id_carrera)
        .join(Anio, Materia.id_anio == Anio.id_anio)
        .filter(Materia.id_materia.in_(list(ids_materias)))
        .all()
    )
    return {id_materia: id_carrera for id_materia, id_carrera in filas}
