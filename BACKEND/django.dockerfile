FROM python:3.11-slim
# Instalar dependencias del sistema necesarias para psycopg2
RUN apt-get update && apt-get install -y \
    postgresql-client \
    build-essential \
    libpq-dev \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/Django
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
#RUN chmod +x wait-for-postgres.py

EXPOSE 8000
#CMD ["bash", "-c", "python3 wait-for-postgres.py && python3 manage.py runserver 0.0.0.0:8000"]
# Usar comando directo con python
 CMD ["python3", "manage.py", "runserver", "0.0.0.0:8000"]
