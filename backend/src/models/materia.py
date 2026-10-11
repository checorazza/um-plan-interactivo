from . import db

# Los planes de la UM ubican cada materia en un semestre, o la marcan como
# anual (ocupa los dos). Se guarda como texto en vez de un entero con NULL
# para "anual": un NULL con significado es más fácil de leer mal.
PRIMER_SEMESTRE = '1'
SEGUNDO_SEMESTRE = '2'
ANUAL = 'anual'
SEMESTRES = (PRIMER_SEMESTRE, SEGUNDO_SEMESTRE, ANUAL)

# Orden para dibujar la malla dentro de un año: las anuales van primero porque
# atraviesan los dos semestres.
ORDEN_SEMESTRE = {ANUAL: 0, PRIMER_SEMESTRE: 1, SEGUNDO_SEMESTRE: 2}

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

    # '1', '2' o 'anual'
    semestre = db.Column(db.String(5), nullable=False, default=PRIMER_SEMESTRE)

    id_anio = db.Column(db.Integer, db.ForeignKey('anio.id_anio'), nullable=False)

    # Si esta materia es una básica, apunta al grupo que la hermana con las
    # equivalentes de otras carreras. `null` = materia propia de la carrera.
    id_basica = db.Column(
        db.Integer, db.ForeignKey('basica.id_basica', ondelete='SET NULL'), nullable=True
    )

    # Materias que hay que tener aprobadas para poder aprobar esta.
    # `habilita` es el backref: las materias que esta destraba al aprobarse.
    correlativas = db.relationship(
        'Materia',
        secondary=correlativa,
        primaryjoin=id_materia == correlativa.c.id_materia,
        secondaryjoin=id_materia == correlativa.c.id_requisito,
        backref='habilita',
        # `lazy='select'` a propósito: en una relación muchos-a-muchos
        # auto-referencial, `selectin` no agrupa y termina pidiendo las
        # correlativas de cada materia por separado (N+1). Los listados usan
        # `correlativas_por_materia`, que las trae todas en una consulta.
        lazy='select',
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

    __table_args__ = (
        db.CheckConstraint(
            "semestre IN ('1', '2', 'anual')", name='ck_materia_semestre'
        ),
    )

    def to_json(self, correlativas=None):
        """Serializa la materia.

        `correlativas` permite pasar la lista ya resuelta. Sin eso hay que ir
        a buscarla, y en un listado eso es una consulta por materia.
        """
        if correlativas is None:
            correlativas = [m.id_materia for m in self.correlativas]

        return {
            'id_materia': self.id_materia,
            'codigo': self.codigo,
            'nombre': self.nombre,
            'creditos': self.creditos,
            'semestre': self.semestre,
            'id_anio': self.id_anio,
            'id_basica': self.id_basica,
            'correlativas': correlativas,
        }
