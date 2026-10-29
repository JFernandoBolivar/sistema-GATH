FROM python:3.14.10
# Logs de Django sin búfer (si no, `docker logs` queda vacío) y sin .pyc en la imagen.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
# Instalar dependencias del sistema necesarias para psycopg2
RUN apt-get update && apt-get install -y \
    postgresql-client \
    build-essential \
    libpq-dev \
    default-libmysqlclient-dev \
    pkg-config \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/Django
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# sed: quita los CRLF que deja un checkout en Windows (autocrlf), o sh no lo ejecuta.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 8000
# Espera a PostgreSQL y aplica migraciones en cada arranque, antes del CMD.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["python3", "manage.py", "runserver", "0.0.0.0:8000"]
