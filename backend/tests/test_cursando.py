"""El estado `cursando`, del lado del servidor.

Pide lo mismo que `regular` —el gate de créditos, sin correlativas— y no da
créditos. Lo que importa probar acá es que la API lo acepta y que el CHECK de
la base sigue rechazando cualquier otra cosa.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from src.domain.reglas import ESTADOS, creditos_aprobados, puede_marcar
from src.models import EstadoMateria, db
from tests.test_reglas import armar_plan


def test_cursando_es_un_estado_valido():
    assert 'cursando' in ESTADOS


def test_pide_lo_mismo_que_regular():
    plan = armar_plan()
    # 1º año no pide créditos: las dos entran.
    assert puede_marcar(plan, {}, 1, 'cursando').ok
    assert puede_marcar(plan, {}, 1, 'regular').ok

    # 2º pide 12: ninguna.
    assert not puede_marcar(plan, {}, 4, 'cursando').ok
    assert not puede_marcar(plan, {}, 4, 'regular').ok


def test_no_exige_correlativas():
    plan = armar_plan()
    # Cálculo I pide Precálculo aprobada, pero sólo para aprobarla.
    estados = {1: 'aprobada', 3: 'aprobada'}
    assert puede_marcar(plan, estados, 4, 'cursando').ok


def test_no_da_creditos():
    plan = armar_plan()
    assert creditos_aprobados(plan, {1: 'cursando'}) == 0
    assert creditos_aprobados(plan, {1: 'aprobada'}) == 6


def test_la_base_lo_acepta(app, usuario, plan):
    db.session.add(
        EstadoMateria(
            id_usuario=usuario.id_usuario,
            id_materia=plan['materias']['calculo1'].id_materia,
            estado='cursando',
        )
    )
    db.session.commit()

    guardado = EstadoMateria.query.one()
    assert guardado.estado == 'cursando'


def test_la_base_sigue_rechazando_cualquier_otra_cosa(app, usuario, plan):
    # El CHECK se reescribió entero al agregar `cursando`: hay que ver que no
    # quedó abierto de paso.
    with pytest.raises(IntegrityError):
        db.session.execute(
            text(
                'INSERT INTO estado_materia '
                '(id_usuario, id_materia, estado, actualizado_en) '
                "VALUES (:u, :m, 'inventado', CURRENT_TIMESTAMP)"
            ),
            {
                'u': usuario.id_usuario,
                'm': plan['materias']['calculo1'].id_materia,
            },
        )
        db.session.commit()
    db.session.rollback()
