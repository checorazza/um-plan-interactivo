from . import db

# Tabla de correlativas: una materia puede tener N requisitos, y cada requisito
# es otra materia. La PK compuesta evita duplicados.
correlativa = db.Table(
    'correlativa',
    db.Column(
        'id_materia',
        db.Integer,
        db.ForeignKey('materia.id_materia', ondelete='CASCADE'),
        primary_key=True,
    ),
    db.Column(
        'id_requisito',
        db.Integer,
        db.ForeignKey('materia.id_materia', ondelete='CASCADE'),
        primary_key=True,
    ),
    db.CheckConstraint('id_materia != id_requisito', name='ck_correlativa_no_autoreferencia'),
)


class Materia(db.Model):
    __tablename__ = 'materia'
    id_materia = db.Column(db.Integer, primary_key=True)

    # Código del plan de estudios (ej. '0003', '2022II', 'CP00'). Es con lo que
    # los planes expresan las correlativas, así que el seed lo necesita para
    # resolverlas sin depender del nombre. No es único a nivel global: el mismo
    # código aparece en varias carreras (las materias básicas). La unicidad
    # dentro de una carrera la garantiza el seeder.
    codigo = db.Column(db.String(10), nullable=False, index=True)

    nombre = db.Column(db.String(100), nullable=False)
    creditos = db.Column(db.Integer, nullable=False)

    id_anio = db.Column(db.Integer, db.ForeignKey('anio.id_anio'), nullable=False)

    # Materias que hay que tener aprobadas para poder aprobar esta.
    # `habilita` es el backref: las materias que esta destraba al aprobarse.
    correlativas = db.relationship(
        'Materia',
        secondary=correlativa,
        primaryjoin=id_materia == correlativa.c.id_materia,
        secondaryjoin=id_materia == correlativa.c.id_requisito,
        backref='habilita',
        lazy='selectin',
    )

    # El estado de cursado (regular / aprobada) NO vive acá: es por usuario y
    # está en la tabla estado_materia.
    estados = db.relationship(
        'EstadoMateria',
        backref='materia',
        lazy=True,
        cascade='all, delete-orphan',
        passive_deletes=True,
    )

    def to_json(self):
        return {
            'id_materia': self.id_materia,
            'codigo': self.codigo,
            'nombre': self.nombre,
            'creditos': self.creditos,
            'id_anio': self.id_anio,
            'correlativas': [m.id_materia for m in self.correlativas],
        }
