"""Imprime cuántas carreras hay cargadas. Lo usa `boot.sh` para saber si
tiene que correr el seed; no sirve para nada más."""

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from src.factory import create_app  # noqa: E402
from src.models import Carrera  # noqa: E402

app = create_app()
with app.app_context():
    print(Carrera.query.count())
