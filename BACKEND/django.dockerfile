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
# Arial para los PDF (core/infrastructure/pdf/fuentes.py): paquete oficial que
# descarga las fuentes de Microsoft aceptando su licencia (componente contrib).
# Si la descarga falla (servidor sin salida a internet), la imagen se construye
# igual y los PDF usan Helvetica, de métricas idénticas.
RUN sed -i 's/^Components: main$/Components: main contrib/' /etc/apt/sources.list.d/debian.sources \
    && echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections \
    && apt-get update \
    && (DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ttf-mscorefonts-installer \
        || echo "AVISO: no se pudo instalar Arial; los PDF usarán Helvetica") \
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
# Servidor de aplicación (A-04): gunicorn con workers/hilos configurables por
# entorno. Por defecto 2*CPU+1 workers (fórmula de gunicorn) y 2 hilos.
CMD ["sh", "-c", "gunicorn GATH.wsgi:application --preload --bind 0.0.0.0:8000 --worker-class gthread --workers ${GUNICORN_WORKERS:-$(python3 -c 'import os; print(2 * len(os.sched_getaffinity(0)) + 1)')} --threads ${GUNICORN_THREADS:-2} --timeout ${GUNICORN_TIMEOUT:-60} --max-requests 1000 --max-requests-jitter 100 --worker-tmp-dir /dev/shm --access-logfile - --error-logfile -"]
