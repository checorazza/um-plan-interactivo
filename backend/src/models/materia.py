from . import db

class Materia(db.Model):
    __tablename__ = 'materia'
    id_materia = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    creditos = db.Column(db.Integer, nullable=False)

    #estado
    es_regular = db.Column(db.Boolean, nullable=False, default=False)
    es_aprobada = db.Column(db.Boolean, nullable=False, default=False)

    id_anio = db.Column(db.Integer, db.ForeignKey('anio.id_anio'), nullable=False)

    # correlativa: apunta a otra materia
    id_correlativa = db.Column(db.Integer, db.ForeignKey('materia.id_materia'), nullable=True)
    correlativa = db.relationship("Materia", remote_side=[id_materia])

    def to_json(self):
        return {
            'id_materia': self.id_materia,
            'nombre': self.nombre,
            'creditos': self.creditos,
            'id_anio': self.id_anio,
            'id_correlativa': self.id_correlativa,
        }