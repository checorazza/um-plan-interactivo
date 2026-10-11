"""Helpers de autorización."""

from functools import wraps

from flask_jwt_extended import get_jwt_identity, jwt_required
from flask_restful import abort

from src.models import Usuario, db


def usuario_actual():
    """El usuario del JWT, o None si el token apunta a uno que ya no existe."""
    identidad = get_jwt_identity()
    if identidad is None:
        return None
    try:
        return db.session.get(Usuario, int(identidad))
    except (TypeError, ValueError):
        return None


def requiere_usuario(funcion):
    """Exige un JWT válido y que el usuario exista."""

    @wraps(funcion)
    @jwt_required()
    def interna(*args, **kwargs):
        usuario = usuario_actual()
        if usuario is None:
            abort(401, message='La sesión ya no es válida, volvé a iniciar sesión')
        return funcion(*args, usuario=usuario, **kwargs)

    return interna


def requiere_admin(funcion):
    """Exige un JWT válido de un usuario con `es_admin`.

    Protege la carga de planes: el catálogo es público para leer, pero sólo un
    admin puede modificarlo.
    """

    @wraps(funcion)
    @jwt_required()
    def interna(*args, **kwargs):
        usuario = usuario_actual()
        if usuario is None:
            abort(401, message='La sesión ya no es válida, volvé a iniciar sesión')
        if not usuario.es_admin:
            abort(403, message='Hace falta ser administrador')
        return funcion(*args, **kwargs)

    return interna
