from . import db

class Carrera(db.Model):
    __tablename__ = 'Anio'
    id_anio = db.Column(db.Integer, primary_key=True)
    numero = db.Column(db.Integer, nullable=False)

    # Relaciones
    id_carrera = db.Column(db.Integer, db.ForeignKey('carrera.id_carrera'), nullable=False)

    def to_json(self):
        return {
            'id_carrera': self.id_carrera,
            'nombre': self.nombre,
        }