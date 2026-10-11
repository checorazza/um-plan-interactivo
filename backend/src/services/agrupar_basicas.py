"""Agrupa las materias que son la misma básica en varias carreras.

Los planes de la UM usan el mismo código para la misma materia básica, así que
el código es la clave para agruparlas. Pero no es infalible: en los PDF hay al
menos un caso (`5044`) donde el mismo código tiene nombres distintos según el
plan. Por eso esto **no agrupa a ciegas**: cuando los nombres no coinciden
devuelve el caso como dudoso para que una persona lo mire.
"""

import unicodedata

from src.models import Anio, Basica, Materia, db

# Códigos que varios planes comparten pero que **no** son la misma materia.
# Revisados uno por uno contra los PDF: o están escritos distinto en cada
# carrera y no queremos arriesgar, o directamente son materias diferentes que
# comparten código (`3050` es "Ing., Derecho y Ética Profesional" en un plan y
# "Trabajo Integrador I" en otro; `5044` es "Modelado y Sistemas de Control"
# frente a "Modelos y Simulación").
#
# Sin esta lista bastaría con que alguien unifique un nombre para que se
# agrupen solas y el progreso se comparta entre materias que no lo son.
NO_AGRUPAR = {
    '0002',  # Química / Química General
    '0006',  # Física / Física I
    '0009',  # Informática / Informática I
    '1024',  # Estadística Aplicada / Estadística Aplicada I
    '1025',  # Análisis de Circuitos I / Análisis de Circuitos
    '1037',  # Análisis de Señales
    '1046',  # Evaluación y Seguim.de Proyectos / Form. y Evaluación de Proyectos
    '2080',  # Ing. de Software Aplicada / Ingeniería de Software Aplicada
    '3050',  # Ing., Derecho y Ética Profesional / Trabajo Integrador I
    '5044',  # Modelado y Sistemas de Control / Modelos y Simulación
}


def normalizar(texto):
    """Baja a minúsculas, saca acentos y colapsa espacios.

    Los planes escriben "PRECALCULO" y "Precálculo" para la misma materia.
    """
    if not texto:
        return ''
    sin_acentos = ''.join(
        c
        for c in unicodedata.normalize('NFD', texto)
        if unicodedata.category(c) != 'Mn'
    )
    return ' '.join(sin_acentos.lower().split())


def analizar():
    """Mira las materias de todas las carreras y propone qué agrupar.

    Devuelve `(grupos, dudosos)`:

    - `grupos`: `{codigo: {'nombre': ..., 'materias': [...]}}` con los códigos
      que aparecen en más de una carrera y con el mismo nombre normalizado.
    - `dudosos`: los códigos que aparecen en más de una carrera pero con
      nombres que no coinciden, y los de `NO_AGRUPAR`. No se agrupan solos.
    """
    filas = (
        db.session.query(Materia, Anio.id_carrera)
        .join(Anio, Materia.id_anio == Anio.id_anio)
        .order_by(Materia.codigo)
        .all()
    )

    por_codigo = {}
    for materia, id_carrera in filas:
        por_codigo.setdefault(materia.codigo, []).append((materia, id_carrera))

    grupos = {}
    dudosos = []

    for codigo, entradas in por_codigo.items():
        carreras = {id_carrera for _, id_carrera in entradas}
        if len(carreras) < 2:
            continue  # está en una sola carrera: no es una básica compartida

        nombres = {normalizar(m.nombre) for m, _ in entradas}
        if codigo in NO_AGRUPAR or len(nombres) > 1:
            dudosos.append(
                {
                    'codigo': codigo,
                    'nombres': sorted({m.nombre for m, _ in entradas}),
                    'carreras': sorted(carreras),
                }
            )
            continue

        grupos[codigo] = {
            'nombre': entradas[0][0].nombre,
            'materias': [m for m, _ in entradas],
        }

    return grupos, dudosos


def aplicar(grupos):
    """Crea las básicas que falten y enlaza sus materias. No hace commit."""
    creadas = 0
    enlazadas = 0

    for codigo, grupo in grupos.items():
        basica = Basica.query.filter_by(codigo=codigo).first()
        if basica is None:
            basica = Basica(codigo=codigo, nombre=grupo['nombre'])
            db.session.add(basica)
            db.session.flush()
            creadas += 1

        for materia in grupo['materias']:
            if materia.id_basica != basica.id_basica:
                materia.id_basica = basica.id_basica
                enlazadas += 1

    return creadas, enlazadas
