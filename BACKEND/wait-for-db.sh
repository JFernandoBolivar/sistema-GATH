#!/bin/bash
# Script básico para esperar a que PostgreSQL esté disponible

echo "Esperando conexión a PostgreSQL..."

# Bucle infinito hasta que la conexión sea exitosa
until nc -z postgresdb 5432; do
  echo "PostgreSQL no está disponible - reintentando en 2 segundos..."
  sleep 2
done

echo "PostgreSQL está disponible - iniciando Django..."
python3 manage.py runserver 0.0.0.0:8000
