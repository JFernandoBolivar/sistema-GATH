"""Argon2 con parámetros OWASP: hashes nuevos livianos y compatibilidad con los viejos."""
from django.conf import settings
from django.contrib.auth.hashers import Argon2PasswordHasher, check_password, identify_hasher, make_password

from apps.identidad.infrastructure.auth.hasher_argon2 import Argon2OWASPPasswordHasher


def test_es_el_hasher_por_defecto():
    assert settings.PASSWORD_HASHERS[0].endswith('Argon2OWASPPasswordHasher')


def test_hash_nuevo_usa_parametros_owasp():
    encoded = make_password('Clave-Segura-2026')
    assert encoded.startswith('argon2$argon2id$')
    assert 'm=19456,t=2,p=1' in encoded
    assert check_password('Clave-Segura-2026', encoded)
    assert not check_password('otra', encoded)


def test_hash_viejo_valida_y_pide_actualizacion():
    viejo = Argon2PasswordHasher().encode('Clave-Vieja-2026', Argon2PasswordHasher().salt())
    assert 'm=102400' in viejo
    actualizado = {}

    def setter(raw):
        actualizado['nuevo'] = make_password(raw)

    assert check_password('Clave-Vieja-2026', viejo, setter=setter)
    assert 'm=19456' in actualizado['nuevo']
    assert isinstance(identify_hasher(actualizado['nuevo']), Argon2OWASPPasswordHasher)
