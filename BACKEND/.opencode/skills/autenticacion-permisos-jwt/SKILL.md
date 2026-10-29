---
name: autenticacion-permisos-jwt
description: Autenticación y autorización del backend de GATH — modelo `cuenta` (AbstractBaseUser sin PermissionsMixin) con rol por FK, login/refresh/logout con simplejwt sobre cookies HttpOnly, migración de las comparaciones de `nombre_rol` a `HasPermission("modulo.accion")` con claim `permisos_version`, credencial de invitado del postulante y throttling de los endpoints de auth.
---

# Autenticación, roles y permisos (Backend)

## Contexto GATH

Proyecto **GATH** — Gestión y Administración de Talento Humano (CONATEL). Stack verificado: Django **5.2.7**, DRF **3.16.1**, `djangorestframework_simplejwt` **5.5.1** con `rest_framework_simplejwt.token_blacklist` en `INSTALLED_APPS` (`BACKEND/SIGEP/settings.py:47`), `AUTH_USER_MODEL = 'USER.cuenta'` (`settings.py:56`), autenticación por defecto `USER.authentication.CookieJWTAuthentication` y permiso por defecto `IsAuthenticated` (`settings.py:171-177`).
Decisiones que gobiernan esta skill: **D-07** (los roles evolucionan a permisología granular: la autorización se abstrae en códigos de permiso desde la Fase B3 y el esquema cambia en B9), **D-06** (rutas nuevas bajo `/api/v1/`), **D-08** (rotación de `SECRET_KEY`/`AUTH_SECRET` en una única ventana coordinada, A-05), **D-11** (`DatabaseCache` sobre PostgreSQL con fallo cerrado para los contadores de throttling), **D-12** (`pytest` + `pytest-django`).
Esta skill fue heredada de otro proyecto y **reconciliada** para GATH; el registro literal de la adaptación está en `PLAN_RECONSTRUCCION_ONION.v1.md` **§0.6.1** — *«Adoptada con enriquecimiento: se incorpora el claim `permisos_version` en el JWT (§I.6.9) para invalidar permisos revocados en minutos»*. El desarrollo largo de ese enriquecimiento está en `PLAN_RECONSTRUCCION_ONION.md` §I.6.9 (fase B9, entregables B9.1–B9.6).

**Esta skill gobierna el prerrequisito bloqueante de la Fase 2.** Hoy la autorización real vive en el frontend: **35** comparaciones de `nombre_rol` en **24** archivos de `NextJS/src` (**22** de ellas contra el literal `RECEPCIONISTA`) — hallazgo **MED-18** — mientras los endpoints de escritura del backend quedan abiertos a cualquier cuenta autenticada (**CRIT-08**: 135 endpoints protegidos solo con `IsAuthenticated`). Ninguna comprobación de la matriz de autorización de `FASE2_PROPUESTA_TECNICA.md` §7.2 existe todavía. Ver [[arquitectura-onion-feature-scream]] para dónde va cada pieza.

---

## Modelo `cuenta` y roles

`BACKEND/USER/models/user_models.py:45` — `class cuenta(AbstractBaseUser)`. `USERNAME_FIELD = 'cedula'`, `REQUIRED_FIELDS = []`.

**La identidad es la cédula del empleado, no un correo ni un username.** `cedula` es un `OneToOneField` a `RAC.Employee` por `to_field='cedulaidentidad'`, con `db_column='cedula'`: no hay cuenta sin empleado.

```python
class cuenta(AbstractBaseUser):
    cedula = models.OneToOneField("RAC.Employee", on_delete=models.CASCADE,
                                  to_field='cedulaidentidad', db_column='cedula', unique=True)
    departamento = models.ForeignKey(departaments, on_delete=models.CASCADE, null=True, blank=True)
    rol = models.ForeignKey(Rol, on_delete=models.SET_NULL, null=True, blank=True)
    is_active = models.BooleanField(default=True)
```

⚠️ **`cuenta` hereda de `AbstractBaseUser` SIN `PermissionsMixin`.** No existe `user.has_perm()`, ni `is_staff`, ni `is_superuser`, ni grupos de Django sobre los que apoyarse. Consecuencia verificada: `AdminSite.has_permission()` nunca concede acceso, así que `/admin/` es hoy inalcanzable por diseño (nota en `BACKEND/SIGEP/urls.py`). No escribas código que asuma la API de permisos de `django.contrib.auth`.

**El rol NO es un choice en `cuenta`** — es una FK a `Rol`:

```python
class Rol(models.Model):
    nombre_rol = models.CharField(max_length=50, unique=True)
    descripcion_rol = models.TextField(null=True, blank=True)
```

Roles en producción: `ADMINISTRADOR`, `ANALISTA`, `PRESUPUESTO`, `BIENESTAR SOCIAL`, `RECEPCIONISTA`, `AUTOGESTION`. La Fase 2 agrega `CAPTACION` y `DIRECCION_GENERAL` (`FASE2_PROPUESTA_TECNICA.md` §7.1).

✅ **La etiqueta del rol 5 se corrigió** de «BIENSTAR SOCIAL» a `BIENESTAR SOCIAL` (tarea B14, 2026-10-29): UPDATE de dato con respaldo mediante `python manage.py renombrar_rol_bienestar` (idempotente). El rol se identifica por id y por permisos; no compares por `nombre_rol` en código nuevo.

> **Estado real vs. objetivo.** `Rol.codigo` **todavía no existe** en el modelo: hoy solo hay `nombre_rol`. Añadirlo como slug único es un pendiente de la Fase 2 (`FASE2_PROPUESTA_TECNICA.md` §5.5, tabla de §14). No importes `Rol.codigo` sin verificar antes que la migración ya está aplicada.

`RolEscrituraSerializer` (`USER/serializers/USER_serializers.py:20`) normaliza el nombre a mayúsculas sin espacios repetidos y valida la unicidad `iexact` a mano (desactiva el `UniqueValidator` de DRF para responder en español). Hay filas antiguas creadas antes de esa normalización: cualquier comparación de texto de rol debe normalizar igual.

---

## Autorización por códigos de permiso `[modulo].[accion]`

Es el modelo objetivo y **no es negociable** (C-3, reglas **B2** y **R16**): backend exige `HasPermission("personal.crear")`, frontend evalúa `puede("personal.crear")` contra `session.user.permisos: {id, code, name}[]`. **Cero comparaciones de nombre de rol en código de negocio.**

| Fase | Qué se construye |
|---|---|
| **B3.2** | `HasPermission("codigo")` como **única** forma de autorizar en las views. En esta fase el resolutor consulta un mapa `rol → códigos` declarado en el dominio: cierra el agujero ya y confina el intercambio de B9 al resolutor |
| **B3.3** | Aplicar `HasPermission` a los 148 puntos de entrada (138 `@api_view` + 10 `APIView`), con el inventario endpoint → código en `PERMISOS.md`. Cierra **CRIT-08** y **CRIT-12** |
| **B3.4** | `IsOwnerOrHasPermission` en autogestión: un empleado solo accede a su propia cédula (**ALTA-07**) |
| **B9.1** | Modelos `Modulo`, `Permiso` (~80 códigos), `RolPermiso`, `CuentaPermiso` (excepciones individuales) |
| **B9.3.5** | **`departamento` deja de participar en la autorización**: pasa a ser metadato organizacional |

Dos reglas de diseño del catálogo (§I.6.9): **separar lectura de escritura y aislar los datos sensibles** — `personal.ver` no implica `personal.ver_salud` ni `familiares.descargar_documento` (A-07) — y **el código nombra el módulo**, para que un log de auditoría identifique el módulo afectado sin consultar otra tabla. `identidad.gestionar_roles` se separa de `identidad.gestionar_usuarios` porque el CRUD de roles cambia la forma del sistema de permisos, no solo un dato (**CRIT-12**).

Los bindings de `HasPermission` viven en `apps/[modulo]/presentation/permissions/[modulo]_permissions.py`; el resolutor, en el dominio de `apps/identidad/`. Toda concesión o revocación se audita con quién, a quién, qué código y antes/después (**B9.6**, **S15**).

### Puente de contención vigente: `EsAdministrador`

Mientras B3.2 no exista, el único permiso propio del backend es `EsAdministrador` (`BACKEND/USER/permissions.py:51`): compara el `nombre_rol` normalizado contra la constante `ROL_ADMINISTRATIVO = "ADMINISTRADOR"`. Se usa en `USER/views/rol_views.py`, `USER/views/user_views.py` y `SIGEP/urls.py` (para cerrar `/api/schema/`, `/api/docs/` y `/api/redoc/`, **ALTA-14**).

Es **deliberadamente provisional y debe desaparecer, no evolucionar**. Regla de oro mientras exista: **el literal del rol vive solo en `USER/permissions.py`.** Ninguna vista compara `nombre_rol` por su cuenta. Si necesitas restringir un endpoint hoy, usa `EsAdministrador` o crea el código de permiso que le corresponderá — nunca un `EsAnalista`/`EsRecepcionista` nuevo.

---

## Login / JWT

`login_view` (`BACKEND/USER/views/user_views.py:65`, hoy en `POST /api/accounts/login/`) es un `@api_view(['POST'])` con `AllowAny` justificado en el propio archivo (regla S1). La verificación la hace `LoginSerializer` (`USER_serializers.py:187`): busca la cuenta por `cedula__correo__iexact`, valida `check_password()` e `is_active`, y devuelve mensajes genéricos para no revelar si el correo existe.

> **Ruta objetivo:** login único en `POST /api/v1/identidad/auth/login/` (D-06, C-6, **B12**). La ruta actual `/api/accounts/login/` seguirá respondiendo con cabecera `Deprecation: true` hasta que B8 verifique cero consumidores.

`TokenService.generate_tokens_for_user()` (`USER/services/token_service.py:15`) usa `RefreshToken.for_user()` de simplejwt **directo** — no hay `TokenObtainPairView` ni serializer custom — y **embebe claims propios**:

```python
refresh = RefreshToken.for_user(user)
refresh['cedula'] = str(user.cedula.cedulaidentidad) if user.cedula else None
refresh['rol'] = user.rol.nombre_rol if user.rol else None
```

La respuesta de login ya sale con el sobre `{status, message, data}` más una clave `tokens` que el frontend consume desde sus server actions. Al migrar a `apps/identidad/`, el sobre lo construye `core/presentation/envelope.py` (**C-1**, **B9**) y las excepciones las traduce `core/presentation/exception_handler.py` (**B10**), nunca la vista.

### El claim `permisos_version` (§I.6.9 · B9.4) — el enriquecimiento de GATH

| # | Entregable |
|---|---|
| **B9.4.1** | El JWT transporta **los códigos de permiso** más un claim **`permisos_version`** (entero por cuenta) |
| **B9.4.2** | Al modificar los permisos de una cuenta o de su rol **se incrementa `permisos_version`**. El refresco compara el claim con la base y, si difiere, **reconstruye el token**. Un permiso revocado deja de aplicar **en minutos, no en 8 horas** |
| **B9.4.3** | Si el conjunto de códigos hace crecer el token en exceso, transportar **solo** `permisos_version` y resolver en servidor con caché por cuenta. **Decidir con medición, no por anticipado** |

`permisos_version` es la respuesta concreta al riesgo del claim desactualizado: el token sigue siendo la vía de transporte, pero deja de ser la autoridad indefinida. Si cambias permisos en cualquier código nuevo, **incrementa el contador en la misma transacción** o el cambio no surtirá efecto hasta el próximo login.

---

## Cookies HttpOnly

`TokenService.set_token_cookies()` fija ambos tokens como cookies `HttpOnly`, y además los devuelve en el body (las server actions de NextJS también los usan en cabecera `Authorization`). Valores verificados en `SIGEP/settings.py:183-200`:

```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(hours=8),
    'ROTATE_REFRESH_TOKENS': True, 'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True, 'ALGORITHM': 'HS256', 'SIGNING_KEY': SECRET_KEY,
    'AUTH_COOKIE': 'access_token', 'AUTH_COOKIE_REFRESH': 'refresh_token',
    'AUTH_COOKIE_HTTP_ONLY': True, 'AUTH_COOKIE_SECURE': not DEBUG,
    'AUTH_COOKIE_SAMESITE': 'Lax', 'AUTH_COOKIE_PATH': '/',
}
```

`CookieJWTAuthentication` (`USER/authentication.py:10`) lee primero la cookie de acceso y **cae a la cabecera `Authorization`** si no la encuentra o si es inválida. La cookie de refresco se fija con `path='/api/accounts/'` (más estrecha que la de acceso, a propósito).

### 🚨 Incoherencia ABIERTA en el nombre de las cookies

Los nombres correctos —los que **usa el frontend hoy**— son **`dj_access`** (15 min) y **`dj_refresh`** (8 h): `NextJS/src/lib/api-client.ts:76-90` los escribe con `httpOnly`, `secure` en producción, `sameSite: "lax"` y `path: "/"`. El backend, en cambio, declara `access_token`/`refresh_token` (`SIGEP/settings.py:196-197`).

**Esta discrepancia está abierta y rompe el login en producción si se «corrige» un solo lado.** Al escribir código nuevo usa `dj_access`/`dj_refresh` como nombres objetivo, y **no toques ninguno de los dos extremos sin cambiar el otro en el mismo despliegue coordinado**. La normalización pertenece a `core/presentation/cookies.py` (**B2.17**), donde queda un único punto de verdad para los nombres, en lugar de dos constantes en repos distintos. `session.maxAge` de NextAuth se sincroniza estrictamente a **8 horas** (D-08) para que la sesión del frontend no sobreviva al refresco del backend.

### ⚠️ Advertencia obligatoria sobre `SIGNING_KEY`

`SIGNING_KEY` es `SECRET_KEY`. **Rotar `SECRET_KEY` no solo invalida todas las sesiones: invalida todos los carnets ya impresos.** `CARNETIZACION/models.py:62` calcula `security_hash` como `sha256(id|cedula|fecha_emision|SECRET_KEY)` y `api_validar_carnet` (`CARNETIZACION/views.py:247`) lo **recalcula con la clave vigente**: tras la rotación, todo carnet emitido antes falla la validación. Por eso la rotación es una ventana de mantenimiento coordinada con operaciones (**D-08**, **A-05**, hito H-1) y no una tarea suelta. Ningún secreto va a git (**CRIT-03**).

---

## Refresh y logout

`refresh_view` (`user_views.py:167`) es `AllowAny` con justificación explícita: la petición llega precisamente cuando el access token ya expiró, así que la credencial que autoriza es el refresh token (cookie `HttpOnly`, con caída al body). `logout_view` (:123) blacklistea el refresh y limpia ambas cookies — y las limpia **también si el blacklisteo falla**.

🐛 **Defecto real pendiente (ALTA-08), no lo replique:** en `token_service.py:119` la rotación hace

```python
new_refresh = RefreshToken.for_user(refresh.payload.get('user_id'))   # ← recibe un int, no una cuenta
```

Además, el token rotado **pierde los claims `cedula` y `rol`**, y **no se revalida `is_active`** en el refresco: una cuenta desactivada sigue renovando sesión hasta que expira el refresh. **B3.6** corrige las tres cosas: pasar la instancia de usuario, preservar los claims (y los permisos) y revalidar `is_active` en cada refresco, con la emisión en `apps/identidad/application/use_cases/` y la fijación de cookies en `core/presentation/cookies.py` (**R-11**).

---

## Cambio de contraseña forzoso

`CuentaSerializer.get_debe_cambiar_password()` (`USER_serializers.py:75`) devuelve `True` cuando la contraseña **es igual a la cédula** (el valor por defecto del alta). `cambiar_password_primera_vez` (`user_views.py:504`) exige la contraseña actual, rechaza que la nueva sea igual a la anterior y valida con `validate_password()` (**S5**). Es el mecanismo que la Fase 2 reutiliza para la credencial de invitado, así que **no crees un segundo camino de cambio forzoso**.

> Pendiente verificado: `settings.py` **no declara `PASSWORD_HASHERS`**, así que rige el orden por defecto de Django (PBKDF2). Argon2 no está en `requirements.txt`. Ver [[uso-librerias-backend]] antes de afirmar que Argon2 es el primer hasher.

---

## Credencial de invitado del postulante (Fase 2)

`FASE2_PROPUESTA_TECNICA.md` §4.3 introduce un segundo mecanismo de acceso que **no** es una cuenta:

- **La credencial no es una fila en `cuenta`**: es un registro propio con su hash, su ventana, su vencimiento y su **`scope = expediente:{id}`**. No hereda ningún permiso del sistema, y `POSTULANTE` **no es una fila en `Rol`** — es un rol sintético que solo existe en la sesión (§13.3).
- **Dos ventanas de vigencia:** Ventana 1 (captura inicial) y Ventana 2 (consolidación para contratar, reabierta por `CAPTACION` con contraseña temporal nueva y vencimiento a 5 días). La credencial se **revoca al enviar**, no al vencer.
- **La cédula es un dato público, así que la contraseña es el único secreto.** De ahí lo demás: cambio forzoso en el primer ingreso de cada ventana (reutilizando `debe_cambiar_password`), complejidad mínima, **bloqueo temporal por intentos fallidos** y vencimiento corto.
- **`exp` acotado a 2 h** en el `jwt` callback de NextAuth, al menor valor entre el vencimiento de la credencial y dos horas: una sesión de invitado no debe sobrevivir a su propia ventana.
- **El gate del middleware del frontend es UX, no seguridad.** La autoridad es el `scope` del token de invitado, que **Django revalida en cada llamada** (§13.3, §12.5). Un invitado no puede enumerar ni leer otro expediente.
- Sin la corrección de **CRIT-08**, esta credencial es la única barrera real del flujo de postulación — otra razón por la que §7 es prerrequisito.

Cuando implementes el acceso de invitado, el endpoint de servido de archivos autoriza **antes** de entregar y asienta el acceso en la bitácora (§12.5, cierra CRIT-06/CRIT-07). Ver [[patrones-drf-implementacion]].

---

## Throttling de seguridad — estado real: NO configurado

`REST_FRAMEWORK` (`SIGEP/settings.py:171-181`) **no declara `DEFAULT_THROTTLE_CLASSES` ni `DEFAULT_THROTTLE_RATES`**, y `settings.py` **no declara `CACHES`** (**ALTA-17**). Es decir: **hoy no hay ningún límite de intentos en login ni en refresh** (**ALTA-04**). El comentario de `login_view` lo deja anotado como pendiente de B0.10.

Objetivo, en dos pasos:

| Fase | Entregable |
|---|---|
| **B0.10** | Activar `ScopedRateThrottle` en login y reposición de contraseña sobre **`DatabaseCache` en PostgreSQL** (`python manage.py createcachetable`) con **política de fallo cerrado** (ALTA-04, ALTA-17, **D-11**) |
| **B3.12** | Rate limiting definitivo por scope y **bloqueo progresivo tras 5 intentos fallidos**, con el incidente registrado en `security_backend.txt` y en DB (cierra ALTA-04 en definitivo) |

Reglas al crear scopes: **el backend de caché es `DatabaseCache` sobre PostgreSQL, nunca Redis** (D-11 evita un cuarto almacén y garantiza límites consistentes entre workers de gunicorn); **el refresco necesita su propio scope**, porque una petición sin `Authorization` válido cae en el scope `anon` y puede expulsar usuarios legítimos justo cuando renuevan sesión; y todo endpoint público nuevo con tráfico alto (catálogos, búsquedas) lleva `throttle_scope` propio con el límite justificado en un comentario. Los tests aíslan la caché de throttling con `override_settings` (**B3.14**) — ver [[testing-backend-django]].

---

## ⚠️ Reglas anuladas respecto a la versión heredada

**1. «El rol nunca va dentro del JWT».** La versión original de esta skill ordenaba: *«Si necesitas el rol/estatus del usuario en una petición autenticada posterior, no lo busques en el payload del token — consulta `request.user` directo»*, y en sus comandos: *«Nunca leas el rol desde el JWT»*.

**Esa regla queda anulada en GATH.** La advertencia era correcta en su diagnóstico —un claim embebido se desactualiza— y es justamente **la razón de existir de `permisos_version`**. GATH **sí transporta** el rol y los códigos de permiso en el token (`token_service.py:26` ya embebe `rol`), y resuelve la frescura con el contador de **B9.4.2**: al cambiar los permisos se incrementa el entero, el refresco detecta la diferencia y reconstruye el token, de modo que un permiso revocado deja de aplicar en minutos y no en las 8 horas del refresh. Registro de la divergencia: `PLAN_RECONSTRUCCION_ONION.md` §0.4.3 fila **B-l**. Lo que **sigue prohibido** es autorizar comparando un **nombre de rol** (**R16**), venga del token o de la base.

**2. Modelo de usuario, perfiles y verificación de email del proyecto de origen.** La versión heredada describía un `Usuario(AbstractUser)` con `USERNAME_FIELD = 'email'`, una FK a `Perfil` con `tipo_perfil` (operador/inversor/gobierno/conatel), un campo `trazabilidad` autogenerado, un flujo de **registro con verificación de email por `TimestampSigner` a 72 horas** con reenvío, los permisos `IsConatelAdmin` / `IsVerificado`, una sección de **habilitación de operador contra la BD RECAUDACION**, y una nota sobre un archivo `AUDITORIA_BACKEND.md` con marcadores `BE-02`/`BE-03`.

**Nada de eso existe en GATH.** El modelo es `cuenta` + `Rol` por FK identificada por cédula; **no hay registro público, ni verificación de email, ni estatus de verificación** — el alta de cuentas es `register_view` (`user_views.py:250`) protegido con `[IsAuthenticated, EsAdministrador]`, más el comando `USER/management/commands/crear_usuarios.py`, y la Fase 2 documenta que **el postulante no tiene correo institucional**, razón por la cual los avisos se convierten en **tareas para Captación** en vez de correos (§4.3). Los identificadores `BE-02`/`BE-03` y `AUDITORIA_BACKEND.md` **no aparecen en ningún archivo de este repositorio**: los hallazgos de GATH se numeran `CRIT-nn`/`ALTA-nn`/`MED-nn` en `PLAN_RECONSTRUCCION_ONION.v1.md`. La integración con RECAUDACION en GATH queda **reservada para fuentes legadas** (§I.4.6: `SAGP`, `SIGEP`, `migrar/`) y no tiene nada que ver con la autenticación — ver [[integracion-bd-recaudacion]].

---

## Comandos

### 1. Proteger un endpoint nuevo

```
@skill protege [endpoint] para que solo [rol o capacidad] pueda acceder
```

1. Traduce la capacidad a un **código de permiso** `[modulo].[accion]` y aplica `HasPermission("modulo.accion")`. Si el código no está en el catálogo, agrégalo ahí primero (`PERMISOS.md` se regenera desde el catálogo, no se mantiene a mano).
2. Si el recurso es propiedad de una persona (autogestión, expediente propio), usa `IsOwnerOrHasPermission` comparando la **cédula** de `request.user`, no su rol (**ALTA-07**).
3. Si el resolutor de B3.2 aún no existe en el árbol, usa `EsAdministrador` de `USER/permissions.py` y deja el código de permiso previsto anotado en un comentario. **No crees permisos nuevos por nombre de rol.**
4. Cero comparaciones de `nombre_rol`, `Rol.descripcion_rol` o `departamento` en la vista o el servicio (**B2**, **R16**, **B9.3.5**). El literal del rol vive solo en `USER/permissions.py` mientras ese puente exista.
5. Test de éxito **y** test de 403 por cada permiso, con `pytest` (**D-12**, **B3.14**).

### 2. Tocar login, refresco o cookies

1. Nombres de cookie: `dj_access` / `dj_refresh`, y **cambio coordinado backend + frontend** en el mismo despliegue (ver la incoherencia abierta arriba).
2. Emisión y rotación de tokens: preserva los claims (`cedula`, `rol`, permisos), revalida `is_active` y pasa la **instancia** de usuario a `RefreshToken.for_user()` (**B3.6**).
3. Si cambias permisos de una cuenta o de un rol, incrementa **`permisos_version`** en la misma transacción y audita el antes/después (**B9.4.2**, **B9.6**, **S15**).
4. Nunca propongas rotar `SECRET_KEY` sin advertir el efecto sobre los carnets ya impresos (**D-08**, **A-05**).

### 3. Añadir un acceso temporal o de alcance acotado

Sigue el patrón de la credencial de invitado (§4.3): **registro propio con hash, ventana, vencimiento y `scope`**, fuera de `cuenta`; cambio de contraseña forzoso en el primer ingreso reutilizando `debe_cambiar_password`; bloqueo por intentos fallidos sobre `DatabaseCache` (D-11); `exp` acotado y **revalidación del `scope` en el backend en cada llamada**. No reutilices el JWT de sesión de un empleado para esto: son mecanismos distintos con propósitos distintos.
