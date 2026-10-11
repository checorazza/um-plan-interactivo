from . import db


class Basica(db.Model):
    """Una materia común a varias ingenierías.

    Las básicas (Química General, Cálculo I, Álgebra y Geometría Analítica...)
    son la misma materia en todas las carreras que las tienen: aprobarla en una
    cuenta en las demás.

    Lo que se comparte es **el progreso**, no la materia. Cada carrera sigue
    teniendo su propia fila en `materia`, porque una básica puede estar en
    distinto año, semestre, con distintos créditos y distintas correlativas
    según el plan. Esta tabla sólo dice cuáles son la misma.
    """

    __tablename__ = 'basica'

    id_basica = db.Column(db.Integer, primary_key=True)
    # Código del plan de estudios, el mismo en todas las carreras.
    codigo = db.Column(db.String(10), nullable=False, unique=True)
    nombre = db.Column(db.String(100), nullable=False)

    materias = db.relationship('Materia', backref='basica', lazy=True)

    def to_json(self):
        return {
            'id_basica': self.id_basica,
            'codigo': self.codigo,
            'nombre': self.nombre,
        }
