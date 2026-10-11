"""Convierte los PDF de los planes de estudio en los JSON de `backend/seeds/`.

Los PDF son tablas, y extraer su texto en orden de lectura los desarma: los
créditos salen todos juntos al final. Por eso acá se lee **con posiciones**: se
agrupan los fragmentos por coordenada `y` (una fila) y se decide qué es cada
uno por su coordenada `x` (una columna).

Uso, desde backend/:
    .venv/Scripts/python.exe scripts/extraer_planes.py            # revisar
    .venv/Scripts/python.exe scripts/extraer_planes.py --escribir
"""

import json
import os
import re
import sys
import unicodedata

from pypdf import PdfReader

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAIZ = os.path.dirname(BASE)
PLANES = os.path.join(RAIZ, 'planes')
SEEDS = os.path.join(BASE, 'seeds')

# Créditos que hacen falta para cursar cada año. No están en los PDF.
CREDITOS_REQUERIDOS = {1: 0, 2: 12, 3: 38, 4: 90, 5: 130}

# Las columnas no se hardcodean: se deducen de dónde está cada rótulo del
# encabezado. Dos de los PDF vienen recortados y reescalados, así que las
# coordenadas absolutas cambian de un archivo a otro.
ROTULOS = {
    'sem': 'semestre',
    'codigo': 'codigo',
    'asignatura': 'nombre',
    'correlativa': 'correlativa',
    'semanales': 'semanales',
    'totales': 'totales',
    'creditos': 'creditos',
}
ORDEN_COLUMNAS = [
    'semestre',
    'codigo',
    'nombre',
    'correlativa',
    'semanales',
    'totales',
    'creditos',
]

# Dos fragmentos a menos de esto son la misma fila: dentro de una fila los
# baselines no coinciden del todo, y entre filas hay ~11 puntos.
TOLERANCIA_FILA = 2.5

ANIOS = {
    'PRIMER': 1,
    'SEGUNDO': 2,
    'TERCER': 3,
    'CUARTO': 4,
    'QUINTO': 5,
}

# Una materia anual se dicta las ~30 semanas del año; una semestral, ~15.
SEMANAS_ANUAL = 25

# El Precálculo es el curso de nivelación. Sólo figura como materia en el plan
# de Informática (`CP00`), pero las otras cinco carreras lo citan como
# correlativa de Cálculo I y Física I con estos nombres.
CODIGO_PRECALCULO = 'CP00'
ALIAS_CORRELATIVAS = {'CPREC': CODIGO_PRECALCULO, 'PREC': CODIGO_PRECALCULO}

PRECALCULO = {
    'anio': 1,
    'codigo': CODIGO_PRECALCULO,
    'nombre': 'Precálculo',
    'creditos': 0,
    'semestre': '1',
    'correlativas': [],
    'correlativa_cruda': '',
}

# Números romanos, que quedan en mayúscula. `RR` y `HH` son de "RR HH".
ROMANOS = {'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'}
SIGLAS = {'RR', 'HH'}

# Artículos, preposiciones y conjunciones: en español van en minúscula dentro
# de un título, salvo cuando abren el nombre.
MINUSCULAS = {
    'a', 'al', 'ante', 'con', 'contra', 'de', 'del', 'desde', 'e', 'el',
    'en', 'entre', 'hacia', 'hasta', 'la', 'las', 'los', 'o', 'para', 'por',
    'segun', 'según', 'sin', 'sobre', 'tras', 'u', 'un', 'una', 'y',
}

# Erratas del PDF que se corrigen al normalizar. La lista se mantiene corta a
# propósito: cada entrada es dato que estamos cambiando a mano.
CORRECCIONES = {
    'precalculo': 'Precálculo',  # el plan de Informática lo escribe sin tilde
}

NOMBRES_ARCHIVO = {
    'INFORMATICA-1.pdf': 'Ingeniería en Informática',
    'COMPUTACION.pdf': 'Ingeniería en Computación',
    'ELECTRONICA-1.pdf': 'Ingeniería Electrónica',
    'ELECTRICA.pdf': 'Ingeniería Eléctrica',
    'Industrial-Plan-2026_cropped.pdf': 'Ingeniería Industrial',
    'Bioingenieria-Plan-2026_cropped.pdf': 'Bioingeniería',
}


def sin_acentos(texto):
    return ''.join(
        c
        for c in unicodedata.normalize('NFD', texto or '')
        if unicodedata.category(c) != 'Mn'
    ).lower().strip()


def columnas_del_encabezado(fragmentos):
    """Deduce el x donde empieza cada columna a partir de los rótulos.

    Los rótulos ("Código", "ASIGNATURA", "Semanales"...) se repiten en cada
    año; se toma el x más chico de cada uno, que es donde arranca la columna.
    Los valores de las columnas numéricas van indentados a la derecha de su
    rótulo, así que el límite entre dos columnas es el punto medio.
    """
    inicios = {}
    for _, x, texto in fragmentos:
        clave = ROTULOS.get(sin_acentos(texto))
        if clave is not None:
            inicios[clave] = min(inicios.get(clave, x), x)

    presentes = [c for c in ORDEN_COLUMNAS if c in inicios]
    if 'codigo' not in inicios or 'nombre' not in inicios:
        return None

    limites = []
    for i, columna in enumerate(presentes):
        desde = 0.0 if i == 0 else (inicios[presentes[i - 1]] + inicios[columna]) / 2
        limites.append((desde, columna))
    return limites


def columna_de(x, limites):
    elegida = None
    for desde, columna in limites:
        if x >= desde:
            elegida = columna
    return elegida


def leer_filas(ruta):
    """Devuelve las filas del PDF como dicts por columna, de arriba hacia abajo."""
    fragmentos = []

    def visitor(texto, cm, tm, fuente, tamanio):
        limpio = texto.strip()
        if not limpio:
            return
        # La posición real sale de componer la matriz del gráfico con la del
        # texto. Dos de los PDF están recortados y reescalados (cm con escala
        # 0.75 y volteo en Y): usar sólo `tm` los daba vuelta.
        x = cm[0] * tm[4] + cm[2] * tm[5] + cm[4]
        y = cm[1] * tm[4] + cm[3] * tm[5] + cm[5]
        fragmentos.append((y, x, limpio))

    for pagina in PdfReader(ruta).pages:
        pagina.extract_text(visitor_text=visitor)

    limites = columnas_del_encabezado(fragmentos)
    if limites is None:
        raise SystemExit(f'No se reconoció el encabezado de la tabla en {ruta}')

    fragmentos.sort(key=lambda f: (-f[0], f[1]))

    filas = []
    actual = None
    for y, x, texto in fragmentos:
        if actual is None or abs(actual['y'] - y) > TOLERANCIA_FILA:
            actual = {'y': y, 'partes': []}
            filas.append(actual)
        actual['partes'].append((x, texto))

    resultado = []
    for fila in filas:
        celdas = {}
        for x, texto in sorted(fila['partes']):
            col = columna_de(x, limites)
            if col is None:
                continue
            celdas[col] = (celdas.get(col, '') + ' ' + texto).strip()
        resultado.append({'y': fila['y'], **celdas})
    return resultado


def es_codigo(texto):
    return bool(re.fullmatch(r'[A-Z]{0,4}\d{2,4}(?:I{1,2})?', texto or ''))


def entero(texto):
    if not texto:
        return None
    m = re.search(r'\d+', texto)
    return int(m.group()) if m else None


def normalizar_nombre(texto):
    """'QUÍMICA GENERAL' y 'Química General' son la misma materia."""
    return ' '.join((texto or '').split())


def extraer(ruta):
    filas = leer_filas(ruta)

    materias = []
    marcadores = []  # (y, '1' | '2' | 'anual', numero_anio)
    numero_anio = None

    for fila in filas:
        texto_fila = ' '.join(v for k, v in fila.items() if k != 'y')

        for palabra, numero in ANIOS.items():
            if f'{palabra} AÑO' in texto_fila.upper():
                numero_anio = numero
                break

        if numero_anio is None:
            continue

        marca = (fila.get('semestre') or '').strip().lower()
        if marca in ('1', '2'):
            marcadores.append((fila['y'], marca, numero_anio))
        elif marca.startswith('anual'):
            marcadores.append((fila['y'], 'anual', numero_anio))

        codigo = (fila.get('codigo') or '').strip()
        nombre = normalizar_nombre(fila.get('nombre'))
        if not es_codigo(codigo) or len(nombre) < 4:
            continue

        semanales = entero(fila.get('semanales'))
        totales = entero(fila.get('totales'))

        materias.append(
            {
                'y': fila['y'],
                'anio': numero_anio,
                'codigo': codigo,
                'nombre': nombre,
                'creditos': entero(fila.get('creditos')) or 0,
                # Se guarda crudo: qué es un código y qué es parte del
                # nombre se decide después, cuando se conocen todos los
                # códigos del plan. `CPREC` no tiene dígitos y una regla
                # sintáctica lo tomaba por texto, pegándolo al nombre.
                'correlativa_cruda': fila.get('correlativa') or '',
                'correlativas': [],
                'semanales': semanales,
                'totales': totales,
            }
        )

    asignar_semestre(materias, marcadores)
    return materias


def asignar_semestre(materias, marcadores):
    """Decide el semestre de cada materia.

    Primero por las horas, que es lo más confiable: si la materia se dicta el
    doble de semanas que una semestral, es anual. Para las semestrales se usa
    el marcador de la tabla ('1' o '2'), que está centrado sobre el bloque de
    filas al que corresponde, así que gana el más cercano del mismo año.
    """
    for materia in materias:
        semanales = materia.pop('semanales')
        totales = materia.pop('totales')

        if semanales and totales and totales / semanales >= SEMANAS_ANUAL:
            materia['semestre'] = 'anual'
            continue

        candidatos = [
            (abs(y - materia['y']), marca)
            for y, marca, anio in marcadores
            if anio == materia['anio'] and marca in ('1', '2')
        ]
        materia['semestre'] = min(candidatos)[1] if candidatos else '1'


def normalizar_nombre_materia(nombre):
    """Pone el nombre en mayúsculas iniciales, con la convención española.

    Los planes mezclan MAYÚSCULAS y Capitalizado según la carrera. Acá queda
    una sola forma: cada palabra con inicial mayúscula, salvo artículos,
    preposiciones y conjunciones, que en español van en minúscula dentro de un
    título ("Análisis de Sistemas", no "Análisis De Sistemas"). La primera
    palabra siempre lleva mayúscula, aunque sea una de ellas.

    Los números romanos quedan en mayúscula (`II`, no `Ii`), y lo mismo las
    siglas. Se trabaja sobre cada tramo de letras y no sobre la palabra
    entera, para que `SEGUIM.DE` quede `Seguim.de`.
    """
    es_el_primero = True

    def arreglar(tramo):
        nonlocal es_el_primero
        texto = tramo.group()
        if texto.upper() in ROMANOS or texto.upper() in SIGLAS:
            resultado = texto.upper()
        elif not es_el_primero and texto.lower() in MINUSCULAS:
            resultado = texto.lower()
        else:
            resultado = texto.capitalize()
        es_el_primero = False
        return resultado

    normalizado = re.sub(
        r'[^\W\d_]+', arreglar, ' '.join((nombre or '').split()), flags=re.UNICODE
    )
    return CORRECCIONES.get(normalizado.lower(), normalizado)


def agregar_precalculo(materias):
    """Suma el Precálculo al plan si lo cita y no lo tiene como materia.

    Sin esto, la correlativa de Cálculo I y Física I se perdía en cinco de las
    seis carreras.
    """
    if any(m['codigo'] == CODIGO_PRECALCULO for m in materias):
        return False
    citado = any(
        token.upper() in ALIAS_CORRELATIVAS
        for m in materias
        for token in re.split(r'[\s/,;]+', m.get('correlativa_cruda', ''))
    )
    if not citado:
        return False
    materias.insert(0, dict(PRECALCULO))
    return True


def normalizar_codigo(codigo):
    """Forma en que se guarda el código.

    Los planes escriben la misma materia como `003` y como `0003`. Como el
    agrupado de básicas compara códigos exactos, sin unificarlos Cálculo I
    sería dos materias distintas entre carreras. Se rellena con ceros a cuatro
    dígitos **sólo** cuando el código es puramente numérico: `CP00` ya tiene
    letras y no se toca, y el sufijo romano de `2022II` se conserva porque
    distingue materias dentro de un mismo plan.
    """
    m = re.fullmatch(r'(\d+)(I*)', codigo or '')
    if not m:
        return codigo
    return f'{int(m.group(1)):04d}{m.group(2)}'


def clave_flexible(codigo):
    """Forma canónica de un código, para emparejar las variantes del PDF.

    Los planes no son consistentes: la misma materia aparece como `002` y
    `0002`, y una correlativa puede citarse como `2505` cuando en la tabla
    figura `2505II`. Se sacan los ceros de más y el sufijo romano.
    """
    sin_romano = re.sub(r'I+$', '', codigo or '')
    letras = re.match(r'^([A-Z]*)', sin_romano).group(1)
    digitos = sin_romano[len(letras):].lstrip('0')
    return f'{letras}{digitos}'


def resolver_correlativas(materias):
    """Separa, en la columna de correlativas, los códigos del texto suelto.

    Un token es una correlativa si corresponde a una materia del mismo plan.
    Se prueba por código exacto, después por forma canónica (`002` ↔ `0002`,
    `2505` ↔ `2505II`) y por último por sufijo, porque Bioingeniería cita sus
    correlativas sin el `5` del principio (`006` por `5006`). El sufijo sólo
    se acepta si hay una única materia que lo cumpla.

    Lo que no resuelve vuelve al nombre, que es de donde lo sacó la columna.
    Devuelve los avisos de lo que quedó sin resolver.
    """
    codigos = {m['codigo'] for m in materias}

    por_clave = {}
    for materia in materias:
        por_clave.setdefault(clave_flexible(materia['codigo']), []).append(
            materia['codigo']
        )

    def buscar(citada):
        citada = ALIAS_CORRELATIVAS.get(citada.upper(), citada)
        if citada in codigos:
            return [citada]
        candidatos = por_clave.get(clave_flexible(citada), [])
        if candidatos:
            return candidatos
        # El sufijo se compara literal, no canonizado: canonizar `002` lo
        # deja en `2` y eso coincide con cualquier código terminado en 2.
        sufijo = re.sub(r'I+$', '', citada)
        if len(sufijo) < 3:
            return []
        return [c for c in sorted(codigos) if c.endswith(sufijo) and c != sufijo]

    avisos = []
    for materia in materias:
        resueltas = []
        sobrante = []

        # Bioingeniería separa varias correlativas con barras: "5092/1022".
        # Los otros planes usan espacios.
        crudo = materia.pop('correlativa_cruda')
        for token in re.split(r'[\s/,;]+', crudo):
            if not token:
                continue
            candidatos = buscar(token)
            if len(candidatos) == 1:
                resueltas.append(candidatos[0])
            elif len(candidatos) > 1:
                avisos.append(
                    f'{materia["codigo"]}: la correlativa {token} es ambigua '
                    f'({", ".join(candidatos)})'
                )
            elif es_codigo(token) or token.isupper():
                avisos.append(
                    f'{materia["codigo"]} {materia["nombre"]}: cita la '
                    f'correlativa {token}, que no está en el plan'
                )
            else:
                sobrante.append(token)

        materia['correlativas'] = resueltas
        if sobrante:
            materia['nombre'] = f'{materia["nombre"]} {" ".join(sobrante)}'.strip()

    return avisos


def armar_plan(ruta, nombre_carrera):
    materias = extraer(ruta)
    for materia in materias:
        materia.pop('y', None)

    agregar_precalculo(materias)
    avisos = resolver_correlativas(materias)

    for materia in materias:
        materia['codigo'] = normalizar_codigo(materia['codigo'])
        materia['nombre'] = normalizar_nombre_materia(materia['nombre'])
        materia['correlativas'] = [
            normalizar_codigo(c) for c in materia['correlativas']
        ]

    anios = sorted({m['anio'] for m in materias})
    return avisos, {
        'carrera': nombre_carrera,
        'anios': [
            {'numero': n, 'creditos_requeridos': CREDITOS_REQUERIDOS.get(n, 0)}
            for n in anios
        ],
        'materias': materias,
    }


def revisar(plan):
    """Problemas que hay que mirar a ojo antes de cargar."""
    avisos = []
    codigos = [m['codigo'] for m in plan['materias']]

    repetidos = sorted({c for c in codigos if codigos.count(c) > 1})
    for codigo in repetidos:
        avisos.append(f'código repetido dentro de la carrera: {codigo}')

    sin_creditos = [
        f'{m["codigo"]} {m["nombre"]}'
        for m in plan['materias']
        if m['creditos'] == 0
    ]
    for materia in sin_creditos:
        avisos.append(f'sin créditos en el PDF: {materia}')

    return avisos


def main():
    escribir = '--escribir' in sys.argv
    os.makedirs(SEEDS, exist_ok=True)

    for archivo, nombre_carrera in NOMBRES_ARCHIVO.items():
        ruta = os.path.join(PLANES, archivo)
        if not os.path.exists(ruta):
            print(f'FALTA {archivo}')
            continue

        avisos_correlativas, plan = armar_plan(ruta, nombre_carrera)
        por_anio = {}
        for m in plan['materias']:
            por_anio.setdefault(m['anio'], 0)
            por_anio[m['anio']] += 1

        total = sum(m['creditos'] for m in plan['materias'])
        print(f'\n=== {nombre_carrera} ({archivo})')
        print(
            f'    {len(plan["materias"])} materias, {total} créditos, '
            f'años: {dict(sorted(por_anio.items()))}'
        )
        for aviso in avisos_correlativas + revisar(plan):
            print(f'    OJO: {aviso}')

        if escribir:
            slug = unicodedata.normalize('NFD', nombre_carrera)
            slug = ''.join(c for c in slug if unicodedata.category(c) != 'Mn')
            slug = slug.lower().replace(' ', '-')
            destino = os.path.join(SEEDS, f'{slug}.json')
            with open(destino, 'w', encoding='utf-8') as f:
                json.dump(plan, f, ensure_ascii=False, indent=2)
            print(f'    escrito: seeds/{slug}.json')


if __name__ == '__main__':
    main()
