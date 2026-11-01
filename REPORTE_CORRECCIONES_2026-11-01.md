# Reporte de correcciones — 2026-11-01

Origen: `REPORTE_AUDITORIA_INTEGRAL_2026-11-01.md` y `MENSAJES_OPENCODE_CORRECCIONES_2026-11-01.md`.
Rama: `feature/fe-de-vida-pasivos`. Sin commit ni push.

---

## Mensaje 1 — Rendimiento del backend (A-01, A-02, A-04)

### Resumen

1. `/personal` pasó de 670 955 bytes a 200 033 y de 10 a 8 consultas: el listado ya no serializa el expediente anidado.
2. `/auth/me` pasó de 14 consultas y p50 735 ms a 4 consultas en frío, 1 en caliente y p50 44.5 ms.
3. Django dejó `runserver` y `CONN_MAX_AGE=0`: corre gunicorn `gthread` con 2*CPU+1 workers, 2 hilos, timeout 60 y conexiones reutilizadas 60 s.
4. Con 50 usuarios concurrentes el p50 bajó de 9 511 ms a 3 966 ms y el p99 de 19 031 ms a 14 981 ms, sin errores.
5. La respuesta de ambos endpoints conserva la misma forma; el detalle del expediente no cambió.

### Tabla

| ID | Estado | Archivos | Test | Medición antes → después |
|---|---|---|---|---|
| A-01 | Corregido | `apps/personal/presentation/serializers/personal_serializers.py`, `apps/personal/presentation/views/personal_views.py`, `apps/personal/infrastructure/repositories/repo_personal_orm.py` | `tests/integration/personal/test_listado_personal_liviano.py` (3 tests) | Payload **670 955 B → 200 033 B** (−70 %); consultas **10 → 8**, constantes con N=10 y N=50; p50 **976.1 → 711.4 ms** |
| A-02 | Corregido | `apps/identidad/infrastructure/cache/permisos_cache.py` (nuevo), `cache/__init__.py` (nuevo), `infrastructure/repositories/repo_cuentas_orm.py`, `infrastructure/mappers/mapper_cuenta.py`, `infrastructure/auth/jwt_authentication.py`, `infrastructure/serializers/cuenta_lectura_serializers.py`, `presentation/views/auth_views.py`, `domain/entities/cuenta.py` | `tests/integration/identidad/test_me_cache_permisos.py` (4 tests) + `tests/unit/identidad/test_permisos_version.py` (ajustado, 8 tests) | Consultas **14 → 4 en frío / 1 en caliente**; p50 **734.8 → 44.5 ms**; p95 **982.9 → 312.4 ms** |
| A-04 | Corregido | `GATH/settings.py`, `django.dockerfile` | `tests/unit/core/test_settings_concurrencia.py` (2 tests) | `runserver` → gunicorn `gthread` (9 workers, 2 hilos, timeout 60); `CONN_MAX_AGE` **0 → 60** con health checks |
| A-03 (medición) | Corregido | `auditoria_2026-11-01/*_despues.txt`, `docker_stats_carga_limpia.txt` | Carga 1/10/25/50 con `docker stats` | p50 **380 → 380 / 1 712 → 1 306 / 4 198 → 1 702 / 9 511 → 3 966 ms**; p99 50 usuarios **19 031 → 14 981 ms**; 0 errores; CPU Django pico 536.75 %, media 179.19 % |

### Notas de la medición

- El listado de `/personal` devuelve **todos** los activos (869 filas), no 10: el `limit` no se usa en ese endpoint. La comparación es sobre la misma respuesta completa; el test de payload < 30 KB usa 10 filas en la base de pruebas.
- La primera medición de carga con `carga_api.py` dio 429 en los escalones de 25 y 50 porque las 500 peticiones usan una sola cuenta y el throttle es `user: 300/minute`. La tabla usa la repetición sin throttling acumulado (`carga_api_sin_throttle.txt`): se limpia el contador entre escalones y las 500 peticiones de 50 usuarios van en dos tandas con 65 s de espera.
- `/personal` sigue por encima de 700 ms porque el endpoint pagina en el cliente y sirve 869 filas. Paginar en servidor cambiaría el contrato del frontend: **Requiere decisión**.
- Estáticos y admin: no hay rutas registradas (`/admin/` y `/static/…` ya respondían 404 antes del cambio); no hay regresión. Logo/PDF y subida/descarga/borrado en SeaweedFS verificados con el contenedor nuevo (PDF 569 014 B, magic `%PDF`; SeaweedFS escritura 1 927 ms, lectura 52 ms, borrado OK).
- `drf-spectacular` no se tocó en este mensaje.

### Archivos modificados

Backend:

- `GATH/settings.py`
- `django.dockerfile`
- `apps/personal/presentation/serializers/personal_serializers.py`
- `apps/personal/presentation/views/personal_views.py`
- `apps/personal/infrastructure/repositories/repo_personal_orm.py`
- `apps/identidad/domain/entities/cuenta.py`
- `apps/identidad/infrastructure/mappers/mapper_cuenta.py`
- `apps/identidad/infrastructure/repositories/repo_cuentas_orm.py`
- `apps/identidad/infrastructure/auth/jwt_authentication.py`
- `apps/identidad/infrastructure/serializers/cuenta_lectura_serializers.py`
- `apps/identidad/infrastructure/cache/__init__.py` (nuevo)
- `apps/identidad/infrastructure/cache/permisos_cache.py` (nuevo)
- `apps/identidad/presentation/views/auth_views.py`

Tests:

- `tests/integration/personal/test_listado_personal_liviano.py` (nuevo)
- `tests/integration/identidad/test_me_cache_permisos.py` (nuevo)
- `tests/unit/core/test_settings_concurrencia.py` (nuevo)
- `tests/unit/identidad/test_permisos_version.py` (ajustado al nuevo `get_user`)

Mediciones:

- `auditoria_2026-11-01/tiempos_api_despues.txt`
- `auditoria_2026-11-01/consultas_por_endpoint_despues.txt`
- `auditoria_2026-11-01/carga_api_despues.txt`
- `auditoria_2026-11-01/carga_api_sin_throttle.txt`
- `auditoria_2026-11-01/docker_stats_carga.txt`
- `auditoria_2026-11-01/docker_stats_carga_limpia.txt`
