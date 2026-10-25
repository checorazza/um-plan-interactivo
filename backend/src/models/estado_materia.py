from . import db
from .usuario import ahora

CURSANDO = 'cursando'
REGULAR = 'regular'
APROBADA = 'aprobada'
ESTADOS = (CURSANDO, REGULAR, APROBADA)


class EstadoMateria(db.Model):
    """Estado de cursado de una materia para un usuario.

    La ausencia de fila significa "sin estado": no se guardan filas en null.
    """

    __tablename__ = 'estado_materia'

    id_usuario = db.Column(
        db.Integer,
        db.ForeignKey('usuario.id_usuario', ondelete='CASCADE'),
        primary_key=True,
    )
    id_materia = db.Column(
        db.Integer,
        db.ForeignKey('materia.id_materia', ondelete='CASCADE'),
        primary_key=True,
    )
    estado = db.Column(db.String(10), nullable=False)
    actualizado_en = db.Column(
        db.DateTime(timezone=True), nullable=False, default=ahora, onupdate=ahora
    )

    __table_args__ = (
        db.CheckConstraint(
            "estado IN ('cursando', 'regular', 'aprobada')",
            name='ck_estado_materia_estado'
        ),
    )

    def to_json(self):
        return {
            'id_materia': self.id_materia,
            'estado': self.estado,
            'actualizado_en': self.actualizado_en.isoformat()
            if self.actualizado_en
            else None,
        }
