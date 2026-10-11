from . import db

class Carrera(db.Model):
    __tablename__ = 'carrera'
    id_carrera = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)

    # Borrar una carrera borra sus años (y, en cadena, sus materias). Sin el
    # cascade, SQLAlchemy intentaría dejarlos huérfanos poniendo id_carrera en
    # NULL, que la columna no admite.
    anios = db.relationship(
        "Anio",
        backref="carrera",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def to_json(self):
        return {
            'id_carrera': self.id_carrera,
            'nombre': self.nombre,
        }