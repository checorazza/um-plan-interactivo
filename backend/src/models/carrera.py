from . import db

class Carrera(db.Model):
    __tablename__ = 'Carrera'
    id_carrera = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)

    #backref a año
    anios = db.relationship("Anio", backref="anios", lazy = True)

    def to_json(self):
        return {
            'id_carrera': self.id_carrera,
            'nombre': self.nombre,
        }