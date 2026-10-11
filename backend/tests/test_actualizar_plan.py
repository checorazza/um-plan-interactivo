"""Corregir un plan no puede borrar el progreso de los usuarios.

Los `estado_materia` cuelgan de `materia.id_materia` con borrado en cascada.
El seeder original borraba la carrera entera y la volvía a crear, así que
arreglar una errata —y quedan varias pendientes de confirmar con la
facultad— se llevaba puesto el progreso de todo el mundo, sin aviso.

`actualizar()` modifica las materias en su lugar, buscándolas por código.
"""

import sys

sys.path.insert(0, 'scripts')

from seed import actualizar  # noqa: E402

from src.models import Anio, Carrera, EstadoMateria, Materia, db  # noqa: E402


def plan_json(materias, anios=((1, 0), (2, 12))):
    return {
        'carrera': 'Ingeniería de Prueba',
        'anios': [
            {'numero': n, 'creditos_requeridos': c} for n, c in anios
        ],
        'materias': materias,
    }


def materia_json(codigo, nombre, creditos=4, anio=1, semestre='1', correlativas=()):
    return {
        'codigo': codigo,
        'nombre': nombre,
        'creditos': creditos,
        'anio': anio,
        'semestre': semestre,
        'correlativas': list(correlativas),
    }


def crear_carrera(app):
    from seed import cargar

    plan = plan_json(
        [
            materia_json('0001', 'Precálculo', 6),
            materia_json('0002', 'Química General', 4),
            materia_json('0003', 'Cálculo I', 3, anio=2, correlativas=['0001']),
        ]
    )
    cargar(plan)
    db.session.commit()
    return Carrera.query.filter_by(nombre=plan['carrera']).first()


def marcar(usuario, codigo, estado='aprobada'):
    materia = Materia.query.filter_by(codigo=codigo).first()
    db.session.add(
        EstadoMateria(
            id_usuario=usuario.id_usuario,
            id_materia=materia.id_materia,
            estado=estado,
        )
    )
    db.session.commit()
    return materia.id_materia


def test_actualizar_conserva_el_progreso(app, usuario):
    carrera = crear_carrera(app)
    id_original = marcar(usuario, '0001')

    # Se corrige el nombre y los créditos, como pasaría al arreglar el PDF
    actualizar(
        plan_json(
            [
                materia_json('0001', 'Precálculo corregido', 8),
                materia_json('0002', 'Química General', 4),
                materia_json('0003', 'Cálculo I', 3, anio=2, correlativas=['0001']),
            ]
        ),
        carrera,
    )
    db.session.commit()

    materia = Materia.query.filter_by(codigo='0001').first()
    assert materia.id_materia == id_original, 'el id tiene que ser el mismo'
    assert materia.nombre == 'Precálculo corregido'
    assert materia.creditos == 8

    estados = EstadoMateria.query.all()
    assert len(estados) == 1
    assert estados[0].id_materia == id_original


def test_actualizar_agrega_las_materias_nuevas(app, usuario):
    carrera = crear_carrera(app)

    actualizar(
        plan_json(
            [
                materia_json('0001', 'Precálculo', 6),
                materia_json('0002', 'Química General', 4),
                materia_json('0003', 'Cálculo I', 3, anio=2, correlativas=['0001']),
                materia_json('0004', 'Física', 5, anio=2),
            ]
        ),
        carrera,
    )
    db.session.commit()

    assert Materia.query.count() == 4
    assert Materia.query.filter_by(codigo='0004').first() is not None


def test_actualizar_borra_las_que_salieron_del_plan(app, usuario):
    carrera = crear_carrera(app)
    marcar(usuario, '0002')

    actualizar(
        plan_json(
            [
                materia_json('0001', 'Precálculo', 6),
                materia_json('0003', 'Cálculo I', 3, anio=2, correlativas=['0001']),
            ]
        ),
        carrera,
    )
    db.session.commit()

    # La materia ya no está en el plan: se va, y su estado con ella
    assert Materia.query.filter_by(codigo='0002').first() is None
    assert EstadoMateria.query.count() == 0


def test_actualizar_rehace_las_correlativas(app, usuario):
    carrera = crear_carrera(app)

    actualizar(
        plan_json(
            [
                materia_json('0001', 'Precálculo', 6),
                materia_json('0002', 'Química General', 4),
                # Ahora Cálculo I pide también Química
                materia_json(
                    '0003', 'Cálculo I', 3, anio=2, correlativas=['0001', '0002']
                ),
            ]
        ),
        carrera,
    )
    db.session.commit()

    calculo = Materia.query.filter_by(codigo='0003').first()
    assert sorted(c.codigo for c in calculo.correlativas) == ['0001', '0002']


def test_actualizar_mueve_una_materia_de_ano(app, usuario):
    carrera = crear_carrera(app)
    id_original = marcar(usuario, '0002')

    actualizar(
        plan_json(
            [
                materia_json('0001', 'Precálculo', 6),
                materia_json('0002', 'Química General', 4, anio=2),
                materia_json('0003', 'Cálculo I', 3, anio=2, correlativas=['0001']),
            ]
        ),
        carrera,
    )
    db.session.commit()

    materia = db.session.get(Materia, id_original)
    assert materia.anio.numero == 2
    assert EstadoMateria.query.count() == 1


def test_actualizar_cambia_los_creditos_requeridos(app, usuario):
    carrera = crear_carrera(app)

    actualizar(
        plan_json(
            [materia_json('0001', 'Precálculo', 6)],
            anios=((1, 0), (2, 20)),
        ),
        carrera,
    )
    db.session.commit()

    segundo = Anio.query.filter_by(
        id_carrera=carrera.id_carrera, numero=2
    ).first()
    assert segundo.creditos_requeridos == 20


def test_borrar_la_carrera_si_se_lleva_el_progreso(app, usuario):
    """El contraste: esto es lo que hacía el seeder antes."""
    carrera = crear_carrera(app)
    marcar(usuario, '0001')

    db.session.delete(carrera)
    db.session.commit()

    assert EstadoMateria.query.count() == 0
