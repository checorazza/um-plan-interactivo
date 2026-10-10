"""Validación del grafo de correlativas.

Las funciones de este módulo son puras: reciben la forma del grafo como una
función `requisitos_de(id) -> iterable[id]`, así que se pueden testear sin base
de datos. El adaptador contra SQLAlchemy está en `validar_correlativas_db`.
"""


class CorrelativaInvalida(ValueError):
    """Las correlativas propuestas dejarían el grafo en un estado inválido."""


def detectar_ciclo(id_materia, ids_requisitos, requisitos_de):
    """Devuelve el camino del ciclo que se formaría, o None si no hay ciclo.

    Las aristas van de una materia a cada uno de sus requisitos. Si siguiendo
    los requisitos a partir de alguno de los propuestos se vuelve a
    `id_materia`, esa materia terminaría dependiendo de sí misma.

    El camino devuelto empieza y termina en `id_materia`, de modo que
    `[3, 7, 3]` se lee "3 requiere 7, que requiere 3".
    """
    pila = [(requisito, [id_materia, requisito]) for requisito in ids_requisitos]
    visitados = set()

    while pila:
        actual, camino = pila.pop()
        if actual == id_materia:
            return camino
        if actual in visitados:
            continue
        visitados.add(actual)
        for siguiente in requisitos_de(actual):
            pila.append((siguiente, camino + [siguiente]))

    return None


def validar_correlativas(id_materia, ids_requisitos, requisitos_de):
    """Normaliza y valida los requisitos propuestos para una materia.

    Devuelve la lista de ids sin duplicados. Levanta `CorrelativaInvalida` si
    una materia se pide como correlativa de sí misma o si se formaría un ciclo.
    """
    ids = list(dict.fromkeys(ids_requisitos))

    if id_materia in ids:
        raise CorrelativaInvalida(
            f'La materia {id_materia} no puede ser correlativa de sí misma'
        )

    ciclo = detectar_ciclo(id_materia, ids, requisitos_de)
    if ciclo is not None:
        cadena = ' -> '.join(str(x) for x in ciclo)
        raise CorrelativaInvalida(
            f'Las correlativas formarían un ciclo: {cadena}'
        )

    return ids


def validar_correlativas_db(id_materia, ids_requisitos, Materia):
    """`validar_correlativas` resolviendo el grafo contra la base de datos.

    Verifica además que cada requisito exista. Devuelve las instancias de
    `Materia` correspondientes, en el orden recibido.
    """
    ids = list(dict.fromkeys(ids_requisitos))

    materias = {m.id_materia: m for m in Materia.query.filter(Materia.id_materia.in_(ids))} if ids else {}
    faltantes = [i for i in ids if i not in materias]
    if faltantes:
        raise CorrelativaInvalida(
            'No existen las materias indicadas como correlativas: '
            + ', '.join(str(i) for i in faltantes)
        )

    def requisitos_de(id_actual):
        materia = materias.get(id_actual)
        if materia is None:
            materia = Materia.query.filter_by(id_materia=id_actual).first()
            if materia is None:
                return []
            materias[id_actual] = materia
        return [m.id_materia for m in materia.correlativas]

    validar_correlativas(id_materia, ids, requisitos_de)
    return [materias[i] for i in ids]
