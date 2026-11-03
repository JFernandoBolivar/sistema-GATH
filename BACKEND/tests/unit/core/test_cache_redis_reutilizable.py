"""El backend de caché reutiliza el cliente Redis en vez de crear uno por operación."""
from core.infrastructure.cache.redis_reutilizable import RedisCacheReutilizable


def test_reutiliza_el_mismo_cliente_por_pool():
    cache = RedisCacheReutilizable('redis://127.0.0.1:6399/0', {})
    cliente = cache._cache.get_client(write=True)
    assert cache._cache.get_client(write=True) is cliente
    assert cache._cache.get_client(write=False) is cliente  # un solo servidor: mismo pool


def test_respeta_la_configuracion_del_pool():
    cache = RedisCacheReutilizable('redis://127.0.0.1:6399/0', {'OPTIONS': {'socket_timeout': 2}})
    pool = cache._cache.get_client().connection_pool
    assert pool.connection_kwargs['socket_timeout'] == 2
