"""Propagación del progreso entre las materias básicas.

Una básica es la misma materia en varias ingenierías, así que marcarla en una
carrera tiene que marcarla en todas. Lo que se comparte es el progreso: cada
carrera conserva su propia fila en `materia`, con su año, su semestre, sus
créditos y sus correlativas.

De ahí sale el caso incómodo: la misma materia puede ser alcanzable en una
carrera y no en otra. Cálculo I puede estar en 2º año de Informática (12
créditos) y en 3º de Industrial (38). Si alguien la aprueba en Informática sin
tener los 38, propagarla a Industrial dejaría ese plan en un estado al que no
se podría haber llegado, y todo el motor de reglas se apoya en que eso no pase.

La decisión: **se propaga sólo donde el plan destino queda consistente**, y lo
que no se pudo propagar se informa en la respuesta en vez de hacerse en
silencio. La alternativa —rechazar el cambio entero— castigaría al usuario en
la carrera que está mirando por culpa de otra que quizá ni cursa.
"""

from src.domain.reglas import validar_conjunto
from src.models import Anio, EstadoMateria, Materia, db
from src.services.plan import cargar_plan


def equivalentes_de(id_materia):
    """Las otras materias que son la misma básica. Vacío si no es una básica."""
    materia = db.session.get(Materia, id_materia)
    if materia is None or materia.id_basica is None:
        return []
    return (
        Materia.query.filter(
            Materia.id_basica == materia.id_basica,
            Materia.id_materia != id_materia,
        )
        .order_by(Materia.id_materia)
        .all()
    )


def expandir(estados):
    """Agrega a un conjunto de estados los equivalentes de cada básica.

    Trabaja sobre el dict `{id_materia: estado}` sin tocar la base más que
    para resolver las equivalencias. No valida nada: de eso se encarga quien
    llama, con el plan de cada carrera.
    """
    if not estados:
        return {}

    ids = list(estados)
    materias = Materia.query.filter(Materia.id_materia.in_(ids)).all()
    basicas = {m.id_materia: m.id_basica for m in materias if m.id_basica}
    if not basicas:
        return dict(estados)

    hermanas = Materia.query.filter(
        Materia.id_basica.in_(set(basicas.values()))
    ).all()
    por_basica = {}
    for materia in hermanas:
        por_basica.setdefault(materia.id_basica, []).append(materia.id_materia)

    expandido = dict(estados)
    for id_materia, id_basica in basicas.items():
        for hermana in por_basica.get(id_basica, []):
            # El estado explícito gana sobre el propagado: si el usuario mandó
            # las dos, respetamos lo que mandó.
            if hermana not in estados:
                expandido[hermana] = estados[id_materia]
    return expandido


def _carreras_de(ids_materias):
    if not ids_materias:
        return {}
    filas = (
        db.session.query(Materia.id_materia, Anio.id_carrera)
        .join(Anio, Materia.id_anio == Anio.id_anio)
        .filter(Materia.id_materia.in_(list(ids_materias)))
        .all()
    )
    return dict(filas)


def propagar(id_usuario, id_materia, estado):
    """Aplica un estado a los equivalentes de una básica, donde se pueda.

    `estado` es `'regular'`, `'aprobada'` o `None` para desmarcar.

    Devuelve `(aplicados, omitidos)`: las materias a las que se propagó, y las
    que se saltearon porque el plan de su carrera quedaría inconsistente, cada
    una con el motivo. No hace commit: lo hace quien llama.
    """
    equivalentes = equivalentes_de(id_materia)
    if not equivalentes:
        return [], []

    # Los estados actuales del usuario, para poder evaluar cada carrera.
    actuales = {
        f.id_materia: f.estado
        for f in EstadoMateria.query.filter_by(id_usuario=id_usuario).all()
    }

    por_carrera = _carreras_de([m.id_materia for m in equivalentes])
    planes = {}

    aplicados = []
    omitidos = []

    for equivalente in equivalentes:
        id_carrera = por_carrera.get(equivalente.id_materia)
        if id_carrera is None:
            continue

        if id_carrera not in planes:
            planes[id_carrera] = cargar_plan(id_carrera)
        plan = planes[id_carrera]

        propuesto = {
            id_m: est
            for id_m, est in actuales.items()
            if id_m in plan.materias and id_m != equivalente.id_materia
        }
        if estado is not None:
            propuesto[equivalente.id_materia] = estado

        conflictos = validar_conjunto(plan, propuesto)
        if conflictos:
            omitidos.append(
                {
                    'id_materia': equivalente.id_materia,
                    'nombre': equivalente.nombre,
                    'motivo': conflictos[0].motivo,
                    'causa': conflictos[0].causa,
                }
            )
            continue

        _guardar(id_usuario, equivalente.id_materia, estado)
        actuales = propuesto | {
            id_m: est for id_m, est in actuales.items() if id_m not in plan.materias
        }
        aplicados.append(equivalente.id_materia)

    return aplicados, omitidos


def _guardar(id_usuario, id_materia, estado):
    fila = db.session.get(EstadoMateria, (id_usuario, id_materia))
    if estado is None:
        if fila is not None:
            db.session.delete(fila)
        return
    if fila is None:
        db.session.add(
            EstadoMateria(id_usuario=id_usuario, id_materia=id_materia, estado=estado)
        )
    else:
        fila.estado = estado
