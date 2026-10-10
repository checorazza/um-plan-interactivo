from datetime import datetime, timezone

from . import db


def ahora():
    return datetime.now(timezone.utc)


class Usuario(db.Model):
    __tablename__ = 'usuario'
    id_usuario = db.Column(db.Integer, primary_key=True)

    # `sub` del ID token de Google: es el identificador estable de la cuenta.
    # El email puede cambiar, el sub no.
    google_sub = db.Column(db.String(64), nullable=False, unique=True, index=True)
    email = db.Column(db.String(255), nullable=False)
    nombre = db.Column(db.String(255), nullable=True)
    foto_url = db.Column(db.String(512), nullable=True)

    es_admin = db.Column(db.Boolean, nullable=False, default=False)
    creado_en = db.Column(db.DateTime(timezone=True), nullable=False, default=ahora)

    estados = db.relationship(
        'EstadoMateria',
        backref='usuario',
        lazy=True,
        cascade='all, delete-orphan',
        passive_deletes=True,
    )

    def to_json(self):
        return {
            'id_usuario': self.id_usuario,
            'email': self.email,
            'nombre': self.nombre,
            'foto_url': self.foto_url,
            'es_admin': self.es_admin,
        }
