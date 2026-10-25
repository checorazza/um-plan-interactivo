"""estado cursando

Agrega `cursando` a los estados que acepta `estado_materia`.

El CHECK se reescribe entero porque no se puede ampliar: hay que tirarlo y
crearlo de nuevo. En SQLite eso implica rehacer la tabla, que es lo que hace
`batch_alter_table`; en Postgres es un ALTER común. Por eso el constraint
tiene nombre desde el principio: sin nombre, acá no habría de dónde agarrarlo.

Al bajar, las filas en `cursando` se borran antes de volver a poner el CHECK
viejo: si quedaran, la restricción no se podría crear y la migración moriría
a mitad de camino.

Revision ID: e81f4c08b31b
Revises: 16bc877637af
Create Date: 2026-10-25 15:40:29.958633

"""

from alembic import op

revision = 'e81f4c08b31b'
down_revision = '16bc877637af'
branch_labels = None
depends_on = None

NOMBRE = 'ck_estado_materia_estado'
CON_CURSANDO = "estado IN ('cursando', 'regular', 'aprobada')"
SIN_CURSANDO = "estado IN ('regular', 'aprobada')"


def _reemplazar(condicion):
    with op.batch_alter_table('estado_materia') as lote:
        lote.drop_constraint(NOMBRE, type_='check')
        lote.create_check_constraint(NOMBRE, condicion)


def upgrade():
    _reemplazar(CON_CURSANDO)


def downgrade():
    op.execute("DELETE FROM estado_materia WHERE estado = 'cursando'")
    _reemplazar(SIN_CURSANDO)
