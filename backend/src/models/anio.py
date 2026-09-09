from . import db

class Anio(db.Model):
    __tablename__ = 'anio'
    id_anio = db.Column(db.Integer, primary_key=True)
    numero = db.Column(db.Integer, nullable=False)

    creditos_requeridos = db.Column(db.Integer, nullable=False)

    # Relaciones
    id_carrera = db.Column(db.Integer, db.ForeignKey('carrera.id_carrera'), nullable=False)

    # backref a materia
    materias = db.relationship("Materia", backref="anio", lazy=True)

    def to_json(self):
        return {
            'id_anio': self.id_anio, 
            'numero': self.numero, 
            'id_carrera': self.id_carrera,
            'creditos_requeridos': self.creditos_requeridos,
            }