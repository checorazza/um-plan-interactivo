"""Cabeceras de caché compartidas por los recursos.

El catálogo (carreras, años, materias, planes) es público y cambia sólo
cuando alguien carga un plan nuevo. Dejar que el CDN de Vercel lo sirva evita
invocar la función y pegarle a la base: la diferencia entre ~1 segundo y unos
pocos milisegundos.

El progreso del usuario es lo contrario: nunca se cachea. Va con
`Authorization`, así que Vercel no lo cachearía igual, pero decirlo explícito
evita que un cambio futuro filtre el progreso de una persona a otra.
"""

# El navegador revalida al minuto; el CDN se lo queda una hora y, mientras
# busca una versión nueva, sigue sirviendo la vieja en vez de hacer esperar.
CACHE_CATALOGO = {
    'Cache-Control': 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400'
}

SIN_CACHE = {'Cache-Control': 'private, no-store'}
