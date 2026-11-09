# FIX-FEVIDA-ADMIN — La Administradora que registra puede revisar su propio registro

**Fecha:** 2026-11-09
**Rama:** `feature/fe-de-vida-pasivos`

## Problema reportado

Con el parámetro «Permitir que la Administradora que registró una fe de vida
presencial la apruebe de forma directa» encendido, la Administradora solo veía
el botón **Aprobación directa**. No aparecían «Dar check», «Devolver para
corrección» ni «Rechazar».

## Corrección

El parámetro ahora habilita a la Administradora registradora el **flujo normal
completo** sobre su propio registro, además de la aprobación directa:

- **Dar check** (uno de los dos checks; el segundo lo da el otro rol).
- **Devolver para corrección** con motivo.
- **Rechazar** con motivo.
- **Retirar mi check**, si ya dio el suyo.
- **Aprobación directa** con justificación, si tiene el permiso.

Con el parámetro apagado se mantiene la regla anterior: no puede revisar su
propio registro y la revisión debe hacerla otra persona de Bienestar Social.
El parámetro de analistas (`registrador_puede_checar`) sigue sin habilitar a la
Administradora.

## Cambios

- Dominio (`solicitud.py`): `acciones_disponibles` deja caer a la Administradora
  registradora en el flujo normal cuando su parámetro está encendido;
  `_exigir_no_registrador` recibe `admin_registradora_puede_decidir` y los
  métodos `dar_check`, `devolver`, `rechazar` y `retirar_check` lo propagan.
- Casos de uso (`revision.py`) y vistas (`revision_views.py`): nuevo argumento
  `admin_registradora_puede_decidir`, alimentado por el mismo parámetro.
- Configuración (`parametros.py`): se actualiza la descripción del parámetro.
- Pruebas unitarias y de API actualizadas y ampliadas para el flujo completo.

## Verificación

- `tests/unit/fe_de_vida/test_presencial.py` +
  `tests/integration/fe_de_vida/test_presencial_api.py`: **44 passed**.
- Suite completa de fe de vida: **246 passed** (antes de ajustar la última
  prueba extremo a extremo, que ya quedó alineada con la nueva regla).
- `lint-imports`: 91 contratos, 0 rotos.
