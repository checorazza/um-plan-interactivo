"""Qué se puede cachear y qué no.

El catálogo es público y casi inmutable: dejarlo en el CDN de Vercel evita
invocar la función. El progreso de cada persona es lo contrario, y ahí el
riesgo no es de rendimiento sino de privacidad: una respuesta cacheada en un
CDN compartido podría servirle a alguien el progreso de otro.
"""

PUBLICAS = ['/api/carreras']


def test_el_catalogo_se_puede_cachear(client, plan_um):
    id_carrera = plan_um['carrera'].id_carrera
    rutas = PUBLICAS + [f'/api/carreras/{id_carrera}/plan']

    for ruta in rutas:
        cache = client.get(ruta).headers.get('Cache-Control', '')
        assert 'public' in cache, ruta
        assert 's-maxage' in cache, ruta


def test_el_progreso_nunca_se_cachea(client, auth, plan_um):
    for ruta in ('/api/me', '/api/me/estados'):
        cache = client.get(ruta, headers=auth).headers.get('Cache-Control', '')
        assert 'no-store' in cache, ruta
        assert 'public' not in cache, ruta


def test_una_respuesta_de_error_no_queda_cacheada(client):
    # Un 404 cacheado por una hora dejaría una carrera nueva invisible
    cache = client.get('/api/carreras/9999/plan').headers.get('Cache-Control', '')
    assert 'public' not in cache
