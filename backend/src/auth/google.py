"""Verificación del ID token que emite Google Identity Services.

El front manda el ID token a `POST /auth/google`; acá se comprueba la firma, el
emisor y que el token haya sido emitido para nuestro client id. Recién después
se crea o se busca el usuario.
"""

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

EMISORES_VALIDOS = ('accounts.google.com', 'https://accounts.google.com')


class ErrorDeToken(Exception):
    """El ID token no es válido, o no fue emitido para esta app."""


def verificar_id_token(token, client_id):
    """Devuelve los datos del usuario, o levanta `ErrorDeToken`.

    Está aislado en una función para que los tests la puedan reemplazar sin
    salir a la red.
    """
    if not client_id:
        raise ErrorDeToken('El login con Google no está configurado en el servidor')

    try:
        datos = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), client_id
        )
    except ValueError as error:
        raise ErrorDeToken(f'ID token inválido: {error}') from error

    if datos.get('iss') not in EMISORES_VALIDOS:
        raise ErrorDeToken('El emisor del token no es Google')

    sub = datos.get('sub')
    if not sub:
        raise ErrorDeToken('El token no trae el identificador de la cuenta')

    if not datos.get('email_verified', False):
        raise ErrorDeToken('La cuenta de Google no tiene el email verificado')

    return {
        'sub': sub,
        'email': datos.get('email', ''),
        'nombre': datos.get('name'),
        'foto_url': datos.get('picture'),
    }
