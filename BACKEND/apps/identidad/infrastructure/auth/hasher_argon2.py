"""Hasher Argon2id con los parámetros mínimos recomendados por OWASP.

Los valores por defecto de Django (memory_cost=100 MiB, parallelism=8) tardaban
~5 s por verificación en el contenedor y reservaban 100 MiB por login: con
logins simultáneos la RAM y la CPU se disparaban. OWASP (Password Storage Cheat
Sheet) recomienda como mínimo m=19 MiB, t=2, p=1: ~0,3 s medidos.

Mismo `algorithm` ('argon2') que el hasher de Django: los hashes existentes se
siguen verificando y Django los re-hashea con estos parámetros en el siguiente
login correcto (`must_update`).
"""
from django.contrib.auth.hashers import Argon2PasswordHasher


class Argon2OWASPPasswordHasher(Argon2PasswordHasher):
    time_cost = 2
    memory_cost = 19456  # KiB = 19 MiB
    parallelism = 1
