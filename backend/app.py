from dotenv import load_dotenv

load_dotenv()

from src.factory import create_app  # noqa: E402  (después de load_dotenv)

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=app.config['PORT'])
