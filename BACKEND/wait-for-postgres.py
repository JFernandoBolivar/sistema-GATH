#!/usr/bin/env python3
import os
import sys
import time
import psycopg2
from psycopg2 import OperationalError

def wait_for_postgres():
    """
    Espera hasta que PostgreSQL esté listo para aceptar conexiones
    """
    db_config = {
        'host': os.environ.get('DJANGO_DB_HOST', '172.16.10.209'),
        'port': os.environ.get('DJANGO_DB_PORT', '5432'),
        'database': os.environ.get('DJANGO_DB_NAME', 'SIGEP'),
        'user': os.environ.get('DJANGO_DB_USER', 'postgres'),
        'password': os.environ.get('DJANGO_DB_PASSWORD', '3054=HitM')
    }
    
    max_retries = 30
    retry_interval = 2
    
    print(f"Esperando a que PostgreSQL esté disponible en {db_config['host']}:{db_config['port']}...")
    
    for attempt in range(max_retries):
        try:
            # Intentar conectar a PostgreSQL
            conn = psycopg2.connect(**db_config)
            conn.close()
            print("¡PostgreSQL está disponible!")
            return True
        except OperationalError as e:
            print(f"Intento {attempt + 1}/{max_retries}: PostgreSQL no disponible - {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(retry_interval)
            else:
                print("Error: PostgreSQL no estuvo disponible después de todos los intentos")
                return False
    
    return False

if __name__ == "__main__":
    if wait_for_postgres():
        sys.exit(0)
    else:
        sys.exit(1)
