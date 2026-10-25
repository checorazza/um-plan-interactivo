"""Motor de reglas del plan de estudios.

Todo este módulo es puro: trabaja sobre las dataclasses de abajo, no sobre
SQLAlchemy. El adaptador que arma un `Plan` desde la base está en
`src/services/plan.py`. El front implementa las mismas reglas en
`frontend/src/domain/reglas.ts`; si cambian acá, cambian allá.

Las reglas:

1. Una materia está sin estado, `cursando`, `regular` o `aprobada`.
2. Sólo las materias aprobadas otorgan créditos.
3. Para marcar una materia del año N —con cualquier estado— hace falta que el
   total de créditos aprobados, de cualquier año, alcance los créditos
   requeridos por el año N.
4. Para marcar una materia como aprobada hacen falta todas sus correlativas
   aprobadas.
5. Cursar y regularizar no exigen correlativas: alcanza con el gate de
   créditos. Los dos piden lo mismo.
6. Un conjunto de estados es válido sólo si existe algún orden en el que se
   pudo haber llegado a él respetando 3 y 4.
"""

from dataclasses import dataclass

CURSANDO = 'cursando'
REGULAR = 'regular'
APROBADA = 'aprobada'
ESTADOS = (CURSANDO, REGULAR, APROBADA)


@dataclass(frozen=True)
class MateriaPlan:
    id_materia: int
    nombre: str
    creditos: int
    id_anio: int
    correlativas: tuple


@dataclass(frozen=True)
class AnioPlan:
    id_anio: int
    numero: int
    creditos_requeridos: int


@dataclass(frozen=True)
class Plan:
    """Una carrera entera: sus años y sus materias, listos para evaluar reglas."""

    id_carrera: int
    anios: dict
    materias: dict

    def materia(self, id_materia):
        return self.materias.get(id_materia)

    def anio_de(self, id_materia):
        materia = self.materias.get(id_materia)
        return self.anios.get(materia.id_anio) if materia else None


@dataclass(frozen=True)
class Resultado:
    """Resultado de evaluar si un cambio es posible."""

    ok: bool
    motivo: str = ''
    # 'creditos' | 'correlativa' | 'desconocida' | 'estado_invalido'
    causa: str = ''

    def __bool__(self):
        return self.ok


OK = Resultado(ok=True)


@dataclass(frozen=True)
class Conflicto:
    id_materia: int
    motivo: str
    causa: str


def creditos_aprobados(plan, estados, excluyendo=None):
    """Suma los créditos de las materias aprobadas.

    `excluyendo` saca una materia de la cuenta: una materia no puede aportar
    créditos al requisito que habilita marcarla a ella misma.
    """
    total = 0
    for id_materia, estado in estados.items():
        if estado != APROBADA or id_materia == excluyendo:
            continue
        materia = plan.materias.get(id_materia)
        if materia is not None:
            total += materia.creditos
    return total


def creditos_por_anio(plan, estados):
    """Créditos aprobados agrupados por id de año. Para mostrar progreso."""
    por_anio = {id_anio: 0 for id_anio in plan.anios}
    for id_materia, estado in estados.items():
        if estado != APROBADA:
            continue
        materia = plan.materias.get(id_materia)
        if materia is not None and materia.id_anio in por_anio:
            por_anio[materia.id_anio] += materia.creditos
    return por_anio


def correlativas_faltantes(plan, estados, id_materia):
    """Correlativas que todavía no están aprobadas."""
    materia = plan.materias.get(id_materia)
    if materia is None:
        return []
    return [
        id_requisito
        for id_requisito in materia.correlativas
        if estados.get(id_requisito) != APROBADA
    ]


def _nombres(plan, ids):
    nombres = []
    for id_materia in ids:
        materia = plan.materias.get(id_materia)
        nombres.append(materia.nombre if materia else f'#{id_materia}')
    return nombres


def puede_marcar(plan, estados, id_materia, nuevo_estado):
    """¿Se puede poner `id_materia` en `nuevo_estado`, dado `estados`?

    `estados` son los estados del resto de las materias. El estado previo de
    `id_materia` no influye, y sus propios créditos nunca cuentan para su
    propio gate.
    """
    if nuevo_estado is None:
        return OK

    if nuevo_estado not in ESTADOS:
        return Resultado(
            ok=False,
            motivo=f'Estado inválido: {nuevo_estado!r}',
            causa='estado_invalido',
        )

    materia = plan.materias.get(id_materia)
    if materia is None:
        return Resultado(
            ok=False,
            motivo=f'La materia #{id_materia} no pertenece a este plan',
            causa='desconocida',
        )

    anio = plan.anios.get(materia.id_anio)
    requeridos = anio.creditos_requeridos if anio else 0
    tiene = creditos_aprobados(plan, estados, excluyendo=id_materia)
    if tiene < requeridos:
        faltan = requeridos - tiene
        numero = anio.numero if anio else '?'
        return Resultado(
            ok=False,
            motivo=(
                f'Te faltan {faltan} créditos para {numero}º año '
                f'(tenés {tiene} de {requeridos})'
            ),
            causa='creditos',
        )

    # Regularizar no exige correlativas; aprobar sí.
    if nuevo_estado == APROBADA:
        faltantes = correlativas_faltantes(plan, estados, id_materia)
        if faltantes:
            nombres = ', '.join(_nombres(plan, faltantes))
            return Resultado(
                ok=False,
                motivo=f'Primero tenés que aprobar: {nombres}',
                causa='correlativa',
            )

    return OK


def validar_conjunto(plan, estados):
    """Valida un conjunto completo de estados.

    Devuelve la lista de `Conflicto` de las materias que no se podrían haber
    marcado en ningún orden. Lista vacía = conjunto consistente.

    El algoritmo acepta materias de a una, quedándose sólo con las que ya pasan
    las reglas con lo aceptado hasta el momento, y repite mientras haya
    progreso. Funciona porque los créditos sólo crecen al aceptar materias:
    si una materia no entra ahora, tampoco va a entrar con menos aceptado.
    """
    pendientes = dict(estados)
    aceptados = {}

    hubo_progreso = True
    while hubo_progreso:
        hubo_progreso = False
        for id_materia, estado in list(pendientes.items()):
            if puede_marcar(plan, aceptados, id_materia, estado):
                aceptados[id_materia] = estado
                del pendientes[id_materia]
                hubo_progreso = True

    conflictos = []
    for id_materia, estado in pendientes.items():
        resultado = puede_marcar(plan, aceptados, id_materia, estado)
        conflictos.append(
            Conflicto(
                id_materia=id_materia,
                motivo=resultado.motivo,
                causa=resultado.causa,
            )
        )
    return conflictos
