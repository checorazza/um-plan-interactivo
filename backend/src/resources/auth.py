from flask import current_app
from flask_jwt_extended import create_access_token
from flask_restful import Resource, abort, reqparse

from src.auth import ErrorDeToken, verificar_id_token
from src.auth.guards import requiere_usuario
from src.models import Usuario, db
from src.resources import SIN_CACHE

parser = reqparse.RequestParser()
parser.add_argument(
    'id_token', type=str, required=True, help="Falta el id_token de Google"
)


class AuthGoogle(Resource):
    """`POST /auth/google`: canjea un ID token de Google por un JWT propio."""

    def post(self):
        args = parser.parse_args()

        try:
            datos = verificar_id_token(
                args['id_token'], current_app.config.get('GOOGLE_CLIENT_ID')
            )
        except ErrorDeToken as error:
            abort(401, message=str(error))

        usuario = Usuario.query.filter_by(google_sub=datos['sub']).first()
        if usuario is None:
            usuario = Usuario(
                google_sub=datos['sub'],
                email=datos['email'],
                nombre=datos['nombre'],
                foto_url=datos['foto_url'],
            )
            db.session.add(usuario)
        else:
            # El perfil puede haber cambiado desde el último login.
            usuario.email = datos['email']
            usuario.nombre = datos['nombre']
            usuario.foto_url = datos['foto_url']

        db.session.commit()

        return {
            # La identidad del JWT va como string: lo exige flask-jwt-extended.
            'access_token': create_access_token(identity=str(usuario.id_usuario)),
            'usuario': usuario.to_json(),
        }, 200


class Yo(Resource):
    """`GET /me`: el perfil del usuario de la sesión. `DELETE /me`: borrar cuenta."""

    @requiere_usuario
    def get(self, usuario):
        return usuario.to_json(), 200, SIN_CACHE

    @requiere_usuario
    def delete(self, usuario):
        # Los estados se van en cascada (ON DELETE CASCADE).
        db.session.delete(usuario)
        db.session.commit()
        return '', 204
