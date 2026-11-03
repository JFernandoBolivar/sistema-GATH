"""
Backend de caché Redis que reutiliza el cliente (rendimiento, 2026-11-03).

`django.core.cache.backends.redis.RedisCacheClient.get_client()` crea un
`redis.Redis` nuevo en CADA operación. Construirlo rellena su tabla de ~160
callbacks de respuesta: medido, ~0,7 ms de CPU por operación y unas 10
operaciones por petición (throttling, permisos, contexto de sesión), es decir
~7 ms de CPU por petición solo en crear clientes.

`redis.Redis` es seguro entre hilos (cada comando toma una conexión del pool),
así que basta un cliente por pool. Tras un fork, el pool detecta el cambio de
PID y abre conexiones nuevas, por lo que funciona con `gunicorn --preload`.
El comportamiento de la caché no cambia: mismas claves, serializador y pools.
"""
from django.core.cache.backends.redis import RedisCache, RedisCacheClient


class RedisCacheClientReutilizable(RedisCacheClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._clientes = {}

    def get_client(self, key=None, *, write=False):
        pool = self._get_connection_pool(write)
        cliente = self._clientes.get(id(pool))
        if cliente is None:
            cliente = self._client(connection_pool=pool)
            self._clientes[id(pool)] = cliente
        return cliente


class RedisCacheReutilizable(RedisCache):
    def __init__(self, server, params):
        super().__init__(server, params)
        self._class = RedisCacheClientReutilizable
