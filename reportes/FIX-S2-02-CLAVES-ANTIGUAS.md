# FIX-S2-02 — Las cuentas antiguas nunca vencían su contraseña inicial

**Fecha:** 2026-11-11
**Rama:** `feature/fe-de-vida-pasivos`
**Hallazgo:** S2-02 (clave inicial de cuentas antiguas)

## Problema

El vencimiento de la contraseña inicial (`identidad_cuenta_password_inicial`,
que el login consulta en `auth_views.py`) solo existe para las cuentas creadas
después de ese control. En la base local hay **486 cuentas activas** que siguen
con la cédula como contraseña y **no tienen fila**, así que nunca caducan: un
tercero que conozca la cédula puede entrar indefinidamente.

## Solución (Onion)

| Capa | Pieza |
| ---- | ----- |
| `domain` | `apps/identidad/domain/value_objects/clave_inicial.py` (`CuentasConClaveInicial`) y el puerto `RepoPasswordInicial` ampliado con `cuentas_activas_sin_vencimiento_con_clave_inicial()` y `emitir_varias()` |
| `application` | `use_cases/vencer_claves_iniciales.py`: decide el plazo, coordina el barrido y devuelve conteos (`ResultadoVencimientoClaves`); sin Django |
| `infrastructure` | `repo_password_inicial_orm.py`: recorre en lotes las cuentas activas sin fila y compara el hash con la cédula usando `django.contrib.auth.hashers.check_password` (solo compara, no regraba); emite las filas en bloque |
| presentación | comando `vencer_claves_iniciales_antiguas` (`--dry-run`, `--encolar`) |

El plazo **no** se lee de la constante: el caso de uso recibe el lector de
parámetros y consulta `plazos.password_inicial_dias` con
`LectorConfiguracionORM` (la tabla `configuracion_parametro_sistema`), con piso
defensivo de 1 día por si el valor estuviera corrupto.

### Reglas

- Solo se tocan cuentas **activas** y **sin fila** de vencimiento.
- Solo si `check_password(cédula, hash)` es verdadero (la clave sigue siendo la
  cédula). Se usa el comparador de Django y no `cuenta.check_password`, que pasa
  por el backend de autenticación y puede reescribir el hash.
- Las que cambiaron la clave y las que ya tienen fila quedan intactas.
- Idempotente: una segunda pasada no encuentra cuentas que ajustar.
- Log con **solo conteos** (`revisadas`, `ajustadas`, `dias`), nunca cédulas.

## Ejecución automática tras el despliegue

Se eligió el patrón que ya usa el proyecto: **comando en el arranque**
(`docker-entrypoint.sh`) + **tarea Celery** + **red de seguridad en el beat**.

1. `docker-entrypoint.sh`, después de `migrate` y `seed_permisos`, ejecuta
   `manage.py vencer_claves_iniciales_antiguas --encolar`. Solo consulta la
   marca y publica la tarea (`apply_async(retry=False)`), así que tarda
   milisegundos y **no bloquea el arranque**. Si el broker todavía no está
   listo, falla rápido y sigue. Se puede desactivar con
   `VENCER_CLAVES_INICIALES=0` (p. ej. en un entorno donde se quiera conservar
   el acceso con cédula).
2. El barrido (~1000 hashes, minutos) corre en el **worker** de Celery
   (`identidad.vencer_claves_iniciales_antiguas`).
3. `CELERY_BEAT_SCHEDULE` tiene una entrada cada 15 minutos como red de
   seguridad: si el arranque no pudo encolar o la pasada falló, se reintenta
   hasta terminar. Una vez hecha, cada tick es una consulta por índice y sale.

**Marca persistente**: nueva tabla `identidad_ejecucion_unica`
(`EjecucionUnicaModel`, migración `identidad/0012`) con la clave
`vencer_claves_iniciales_antiguas`. Solo se escribe **al terminar bien**; si el
proceso muere antes, no hay marca y la siguiente pasada reintenta.

**Candado**: `cache.add` (Redis en el despliegue) con 2 h de vencimiento evita
que dos ejecuciones se solapen. Si el worker muere a mitad, el candado caduca y
el beat reintenta; no requiere limpieza manual.

## Uso manual

```bash
# Ver cuántas cuentas se ajustarían, sin escribir nada
python manage.py vencer_claves_iniciales_antiguas --dry-run

# Aplicar ahora (idempotente)
python manage.py vencer_claves_iniciales_antiguas

# Forzar otra ejecución automática (p. ej. tras restaurar una copia):
# borrar la marca; el siguiente arranque o el beat la vuelven a encolar.
python manage.py shell -c "from apps.identidad.infrastructure.models.ejecucion_unica_model import EjecucionUnicaModel as M; print(M.objects.filter(clave='vencer_claves_iniciales_antiguas').delete())"
```

## Tests

`tests/integration/identidad/test_vencer_claves_iniciales.py` (9 casos):

- cuenta antigua con la cédula → recibe fila con `vence_en = ahora + plazo`;
- cuenta con la clave cambiada → no recibe fila;
- cuenta con fila previa → intacta (mismo `vence_en`);
- segunda ejecución → no hace nada (ni filas nuevas ni cambios);
- el plazo sale del parámetro (`plazos.password_inicial_dias = 3` → 3 días);
- `--dry-run` cuenta pero no escribe;
- comando: reporta conteos y **no** imprime cédulas;
- el arranque no encola si ya existe la marca;
- la tarea no se solapa si el candado está tomado.

## Verificación

- `pytest tests/unit/identidad tests/integration/identidad`: **298 passed**
  (incluye los 9 casos de S2-02; el archivo nuevo pasa solo: 9/9).
- `lint-imports`: **91 contratos, 0 rotos**
- `makemigrations --check --dry-run`: **No changes detected** (la migración
  `0012_ejecucionunicamodel` queda incluida)
- `manage.py check`: **sin incidencias**

Sin commit: los cambios quedan en el árbol de trabajo.

## Nota operativa

Al desplegar, las ~486 cuentas afectadas quedan con el plazo del parámetro
(7 días por defecto) para cambiar la contraseña. Pasado ese plazo el login
responde con el aviso de contraseña inicial vencida que ya existe; no hay
cambios de interfaz ni de contrato de API.
