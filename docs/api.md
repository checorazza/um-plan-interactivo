# API

Base: **`/api`**. En desarrollo, `http://127.0.0.1:5000/api` (el puerto se
configura con `PORT`); en producción el front y la API comparten dominio y
Vercel manda `/api/*` al servicio de Flask, así que el front llama en relativo.

El prefijo es el mismo en los dos entornos a propósito: si en local la API
colgara de la raíz y en producción de `/api`, cualquier ruta mal armada
aparecería recién al desplegar.

Todas las respuestas son JSON. Los errores traen `{"message": "..."}`, y algunos
agregan campos extra que se documentan abajo.

## Autenticación

El catálogo se lee **sin sesión**: la malla funciona sin iniciar sesión, y eso es
el caso principal de la app. La sesión sólo hace falta para sincronizar el
progreso y para cargar planes.

El flujo es: el front obtiene un ID token de Google Identity Services, lo canjea
en `POST /api/auth/google` por un JWT propio, y manda ese JWT en
`Authorization: Bearer <token>`.

### `POST /api/auth/google`

Canjea el ID token de Google por un JWT de la API. Crea el usuario la primera
vez, y actualiza su perfil (email, nombre, foto) en los logins siguientes.

```json
{ "id_token": "<ID token de Google Identity Services>" }
```

→ `200`

```json
{
  "access_token": "<JWT>",
  "usuario": {
    "id_usuario": 1,
    "email": "ceci@example.com",
    "nombre": "Ceci",
    "foto_url": "https://...",
    "es_admin": false
  }
}
```

→ `401` si el token no es válido, no fue emitido para nuestro `GOOGLE_CLIENT_ID`,
la cuenta no tiene el email verificado, o el servidor no tiene el login
configurado.

### `GET /me`

→ `200` con el perfil.

**Todos los fallos de autenticación son `401` con `{"message": ...}`**: falta
el token, está vencido, está mal formado, la firma no verifica, o el usuario
fue borrado. Por defecto `flask-jwt-extended` contesta `422` en varios de esos
casos; se unifican a propósito, porque `422` acá significa "el progreso no
cumple las reglas del plan" y el cliente tiene que poder distinguir una cosa
de la otra.

### `DELETE /me`

Borra la cuenta y todo su progreso (cascada). → `204`.

## Catálogo

Lectura pública. Las escrituras (`POST`, `PUT`, `DELETE`) exigen un usuario con
`es_admin`: → `401` sin token, `403` si el usuario no es admin.

### `GET /carreras/<id_carrera>/plan`

**El endpoint que usa el front.** Devuelve la carrera, sus años y todas sus
materias con las correlativas resueltas, en una sola llamada: es todo lo que
hace falta para dibujar la malla.

→ `200`

```json
{
  "carrera": { "id_carrera": 1, "nombre": "Ingeniería en Informática" },
  "anios": [
    { "id_anio": 1, "numero": 1, "id_carrera": 1, "creditos_requeridos": 0 },
    { "id_anio": 2, "numero": 2, "id_carrera": 1, "creditos_requeridos": 12 }
  ],
  "materias": [
    {
      "id_materia": 1,
      "codigo": "CP00",
      "nombre": "Precálculo",
      "creditos": 6,
      "semestre": "1",
      "id_anio": 1,
      "id_basica": 7,
      "correlativas": []
    },
    {
      "id_materia": 4,
      "codigo": "0003",
      "nombre": "Cálculo I",
      "creditos": 3,
      "semestre": "anual",
      "id_anio": 2,
      "id_basica": null,
      "correlativas": [1]
    }
  ]
}
```

Las materias vienen ordenadas por año, después por semestre (las anuales
primero, porque atraviesan los dos) y después por código: es el orden en que la
malla las dibuja.

→ `404` si la carrera no existe.

### Resto del catálogo

| Método                  | Ruta                        | Quién         |
| ----------------------- | --------------------------- | ------------- |
| `GET`                   | `/api/carreras`                 | público       |
| `GET`                   | `/api/carreras/<id>`            | público       |
| `POST` `PUT` `DELETE`   | `/api/carreras`, `/api/carreras/<id>` | admin       |
| `GET`                   | `/api/anios`, `/api/anios/<id>`     | público       |
| `POST` `PUT` `DELETE`   | `/api/anios`, `/api/anios/<id>`     | admin         |
| `GET`                   | `/api/materias`, `/api/materias/<id>` | público     |
| `POST` `PUT` `DELETE`   | `/api/materias`, `/api/materias/<id>` | admin       |

Body de materia:

```json
{
  "codigo": "0004",
  "nombre": "Cálculo II",
  "creditos": 6,
  "semestre": "2",
  "id_anio": 3,
  "correlativas": [4]
}
```

`semestre` es obligatorio y tiene que ser `"1"`, `"2"` o `"anual"`.

`correlativas` es opcional y, en `PUT`, **reemplaza** la lista completa.
→ `422` si alguna correlativa no existe, si la materia se pide como correlativa
de sí misma, o si se formaría un ciclo (el mensaje incluye el camino:
`"Las correlativas formarían un ciclo: 1 -> 3 -> 2 -> 1"`).

## Progreso del usuario

Requieren sesión. **Toda escritura se valida contra las reglas del plan en el
servidor**, no sólo en el front.

Las reglas están en [`backend/src/domain/reglas.py`](../backend/src/domain/reglas.py)
y se replican en el front; el resumen está en [PLAN.md](PLAN.md).

### `GET /me/estados`

→ `200` con el progreso del usuario en **todas** las carreras.

```json
[{ "id_materia": 1, "estado": "aprobada", "actualizado_en": "2026-10-10T23:00:00+00:00" }]
```

`estado` es `"regular"` o `"aprobada"`. Una materia sin estado **no aparece**: no
se guardan filas en null.

### `PUT /me/estados/<id_materia>`

Cambia el estado de una materia. Si es una **básica** (`id_basica` no nulo), el
cambio se propaga a las materias equivalentes de las otras carreras, y la
respuesta lo informa:

```json
{
  "id_materia": 4,
  "estado": "aprobada",
  "actualizado_en": "...",
  "propagado_a": [31],
  "no_propagado": [
    { "id_materia": 58, "nombre": "Cálculo I", "motivo": "Te faltan 26 créditos para 3º año (tenés 12 de 38)", "causa": "creditos" }
  ]
}
```

`no_propagado` son las carreras donde aplicar el cambio dejaría el plan en un
estado inalcanzable; ahí no se toca nada. Los dos campos sólo aparecen si la
materia es una básica.

```json
{ "estado": "aprobada" }
```

- `200` con el estado guardado.
- `400` si `estado` no es `regular` ni `aprobada`.
- `404` si la materia no existe.
- `422` si **esta** materia no cumple las reglas. Trae `causa`:
  `creditos` o `correlativa`, y un `message` listo para mostrar
  (`"Te faltan 12 créditos para 2º año (tenés 0 de 12)"`,
  `"Primero tenés que aprobar: Precálculo"`).
- `409` si el cambio es válido para esta materia pero **deja inconsistentes
  otras** — por ejemplo bajar de `aprobada` a `regular` una materia que es
  correlativa de otra ya aprobada. Trae `conflictos`:

```json
{
  "message": "El cambio deja inconsistentes otras materias. ...",
  "conflictos": [
    { "id_materia": 4, "motivo": "Primero tenés que aprobar: Precálculo", "causa": "correlativa" }
  ]
}
```

En ese caso el cliente muestra el diálogo de cascada y, cuando el usuario
confirma, manda el progreso resultante completo con `PUT /me/estados`. El
servidor nunca guarda un estado inconsistente.

### `DELETE /me/estados/<id_materia>`

Quita el estado. Es idempotente: `204` también si la materia no tenía estado.
Si es una básica, responde `200` con `propagado_a` y `no_propagado` en vez de
`204`.
→ `409` con `conflictos` si desmarcarla rompe otras (mismo contrato que arriba).

### `PUT /me/estados`

Reemplaza **todo** el progreso del usuario. Es lo que usa el push del sync y lo
que resuelve las cascadas.

```json
{
  "estados": [
    { "id_materia": 1, "estado": "aprobada" },
    { "id_materia": 4, "estado": "regular" }
  ]
}
```

- `200` con el progreso guardado (mismo formato que `GET /me/estados`). Puede
  traer **más** materias de las enviadas: las básicas se expanden a sus
  equivalentes antes de validar y guardar. Si el cuerpo manda explícitamente
  dos equivalentes con estados distintos, se respeta lo que mandó.
- `400` si el cuerpo está mal formado.
- `422` si alguna materia no existe, o si el conjunto **no es alcanzable**: no
  existe ningún orden en el que se pudiera haber llegado a él respetando los
  créditos y las correlativas. Trae `conflictos` con las materias culpables.

Las materias de distintas carreras no se afectan entre sí: cada carrera se valida
con su propio plan, y los créditos de una no cuentan para los años de otra.
