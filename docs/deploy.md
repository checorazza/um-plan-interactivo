# Deploy en Vercel + Neon

Un solo proyecto de Vercel con dos **services**: el front (Vite) y la API
(Flask). Comparten dominio, así que el front llama a la API en relativo y no
hace falta CORS entre ellos.

## Cómo está armado

[`vercel.json`](../vercel.json) en la raíz:

| Service | `root`     | Qué es          | Público en        |
| ------- | ---------- | --------------- | ----------------- |
| `web`   | `frontend` | Vite (estático) | `/(.*)`           |
| `api`   | `backend`  | Flask (Python)  | `/api/(.*)`       |
| | | | |

Los rewrites van del más específico al más general: `/api/(.*)` primero y el
catch-all `/(.*)` al final. Las dos rutas son públicas.

**No hay bindings.** Un binding sirve para que un service llame a otro por
dentro; acá no pasa eso. Quien llama a la API es el navegador del usuario,
por HTTP público, igual que cualquier cliente. El front es estático: en
producción no corre código de servidor que pueda llamar a nada.

### El prefijo `/api`

La API cuelga de `/api` **también en desarrollo** (`Api(app, prefix='/api')` en
`src/factory.py`). Si en local colgara de la raíz y en producción de `/api`,
cualquier ruta mal armada aparecería recién al desplegar.

El front compone la URL como `VITE_API_URL + "/api" + ruta`. En local
`VITE_API_URL` es `http://127.0.0.1:5000`; en Vercel va **vacío**, y las
llamadas salen relativas al mismo dominio.

### Por qué hay un `pyproject.toml` en `backend/`

Dos motivos, y los dos salieron de errores reales del build.

Vercel busca sola la app WSGI y encuentra dos candidatas: `app.py` y
`tests/conftest.py`, que también expone una variable `app`. El
`[tool.vercel] entrypoint = "app:app"` desambigua.

Y **Vercel construye con `uv`**, que exige un proyecto PEP 621 de verdad: un
`pyproject.toml` que sólo tenga `[tool.vercel]` falla con
``No `project` table found``. Por eso están `[project]` con nombre, versión,
`requires-python` y las dependencias, y `[tool.uv] package = false`, que le
dice a uv que esto es una app y que instale las dependencias sin intentar
construir el proyecto como paquete.

Las dependencias quedan declaradas **dos veces**: en `requirements.txt`, que
es lo que usa `boot.sh` en desarrollo, y en `[project].dependencies`, que es
lo que instala Vercel. `tests/test_dependencias.py` verifica que coincidan;
si no, el deploy falla con un `ModuleNotFoundError` que no se reproduce en
local.

`uv.lock` se versiona para que el build sea reproducible. Cuando cambien las
dependencias hay que regenerarlo:

```bash
cd backend && .venv/Scripts/python.exe -m uv lock
```

`.vercelignore` deja afuera del deploy los tests, el venv, la base local, los
scripts, los seeds y los PDF de los planes.

## Variables de entorno en Vercel

Se cargan en Settings → Environment Variables del proyecto.

| Variable                | Valor                                              |
| ----------------------- | -------------------------------------------------- |
| `DATABASE_URL`          | La cadena **pooled** de Neon (el host lleva `-pooler`) |
| `JWT_SECRET_KEY`        | 32+ caracteres. `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `GOOGLE_CLIENT_ID`      | El OAuth Client ID de Google                        |
| `CORS_ORIGINS`          | `https://<tu-dominio>.vercel.app`                   |
| `VITE_API_URL`          | **vacío**                                           |
| `VITE_GOOGLE_CLIENT_ID` | El mismo client id de Google                        |

Las dos `VITE_*` se leen al construir el front, no en tiempo de ejecución: si
las cambiás hay que volver a desplegar.

`CORS_ORIGINS` no hace falta para el front, que es del mismo origen, pero sin
definirla queda el default de `localhost:5173`, y conviene que diga la verdad.

## Rendimiento

Tres cosas que costaban segundos y vale la pena no deshacer:

1. **La región de las funciones tiene que coincidir con la de la base.** Lo
   que se multiplica por cada consulta es la distancia *función ↔ Neon*, no la
   distancia hasta quien usa la app: el navegador habla con el CDN, que está
   en todos lados. Las dos están en `gru1` (São Paulo). Con la función en
   Washington y la base en São Paulo, cada consulta costaba ~140 ms.
2. **Ninguna respuesta puede hacer una consulta por fila.** Serializar un plan
   leyendo `materia.correlativas` hacía 50 consultas para 47 materias: 7
   segundos. `tests/test_consultas.py` cuenta las consultas de los endpoints
   de lectura justamente para que no vuelva.
3. **El catálogo se cachea en el CDN** (`Cache-Control` con `s-maxage`), así
   que la mayoría de las visitas no invocan la función ni tocan la base. El
   progreso de cada usuario nunca se cachea.

## Base de datos

### Conexiones

Cada request puede caer en un proceso nuevo, así que la app **no mantiene un
pool**: con Postgres usa `NullPool` y `pool_pre_ping` (ver `src/config.py`).
Por eso hay que usar la cadena **pooled** de Neon: es su pooler el que absorbe
el ir y venir de conexiones, no SQLAlchemy.

### Migraciones

No corren solas al desplegar, y es a propósito: una migración disparada desde
una función serverless puede ejecutarse varias veces en paralelo. Se corren a
mano, desde tu máquina.

Para no pegar la cadena de conexión en la consola —donde queda en el historial
del shell— se guarda en `backend/.env.produccion`, que está en el
`.gitignore`:

1. En Vercel: **Storage → la base → Quickstart → pestaña `.env.local` →
   "Show secret" → "Copy Snippet"**.
2. Pegar todo en `backend/.env.produccion`.
3. Correr:

```bash
cd backend && .venv/Scripts/python.exe scripts/migrar_produccion.py --con-seed
```

El script usa `DATABASE_URL_UNPOOLED` (la conexión **directa**) si está, que es
lo que Neon recomienda para DDL: el pooler no maneja bien los cambios de
esquema. Con `--con-seed` carga además los seis planes; sin el flag, sólo
migra.

### Corregir un plan ya cargado

Nunca se borra la carrera para volver a crearla. Los `estado_materia` cuelgan
de `materia.id_materia` con borrado en cascada, así que borrarla se llevaría
el progreso de **todos** los usuarios, sin aviso. Y hay correcciones
pendientes de confirmar con la facultad, así que va a pasar.

`seed.py --cargar --actualizar` pone los planes al día **en su lugar**: busca
cada materia por código, modifica las que ya están —conservando su id— y sólo
borra las que desaparecieron del plan. `migrar_produccion.py --con-seed` hace
lo mismo.

El front también lo soporta del otro lado: guarda cada estado junto con su
clave natural (carrera y código) y, si un id dejó de existir, recupera el
progreso por esa clave y lo vuelve a guardar con el id nuevo.

## Google OAuth

En Google Cloud Console, el OAuth Client ID (tipo "Aplicación web") necesita
estos **orígenes autorizados de JavaScript**:

- `http://localhost:5173` (desarrollo)
- `https://<tu-dominio>.vercel.app` (producción)

Hasta que exista el client id, el bloque de login no se muestra y la app
funciona igual, sólo que local. Eso es a propósito.

## Antes de desplegar

Vercel construye lo que esté en GitHub, no lo que tengas local: `git push`
primero.
