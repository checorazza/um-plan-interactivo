"""Las dependencias están declaradas en dos lugares y tienen que coincidir.

`requirements.txt` es lo que usa `boot.sh` en desarrollo; el `[project]` del
`pyproject.toml` es lo que instala Vercel, que construye con `uv`. Las dos
listas se mantienen a mano, así que sin este test se desincronizan y el deploy
falla con un `ModuleNotFoundError` que no se reproduce en local.
"""

import os
import tomllib

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def leer_requirements():
    ruta = os.path.join(BACKEND, 'requirements.txt')
    with open(ruta, encoding='utf-8') as f:
        return [
            linea.strip()
            for linea in f
            if linea.strip() and not linea.lstrip().startswith('#')
        ]


def leer_pyproject():
    ruta = os.path.join(BACKEND, 'pyproject.toml')
    with open(ruta, 'rb') as f:
        return tomllib.load(f)


def test_las_dos_listas_de_dependencias_coinciden():
    del_pyproject = leer_pyproject()['project']['dependencies']
    assert sorted(leer_requirements()) == sorted(del_pyproject)


def test_el_entrypoint_apunta_a_la_app():
    assert leer_pyproject()['tool']['vercel']['entrypoint'] == 'app:app'


def test_uv_no_trata_el_proyecto_como_paquete():
    # Es una app: uv tiene que instalar las dependencias y nada más.
    assert leer_pyproject()['tool']['uv']['package'] is False


def test_el_proyecto_tiene_lo_que_uv_necesita():
    # `uv lock` falla con "No `project` table found" si falta cualquiera.
    proyecto = leer_pyproject()['project']
    for clave in ('name', 'version', 'requires-python', 'dependencies'):
        assert proyecto.get(clave), clave
