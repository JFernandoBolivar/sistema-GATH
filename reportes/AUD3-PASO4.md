# AUD3 PASO 4 — Seguridad (revisión white-box)

**Skills usadas:** `owasp-top-10-testing`, `find-security-vulnerabilities-in-code`
y `autenticacion-permisos-jwt` (la del proyecto; su nota histórica se contrastó
con el código real). Sin pruebas contra QA ni producción: solo lectura de código
y comprobaciones locales.

## Resumen

La sesión, el bloqueo de cuentas, el restablecimiento de contraseña, los
permisos, las subidas y las cabeceras están bien resueltos. Los riesgos reales
están en las **dependencias del frontend** (S4-01), en dos accesos que solo
piden sesión (S4-04/S4-05) y en la contraseña inicial del superadministrador
(S4-02). Se corrigió la IP de auditoría y de los intentos de login (S4-03).

## Hallazgos

### S4-01 — Dependencias del frontend con RCE y bypass de proxy (CRÍTICA, a decisión)

`pnpm audit --prod` reporta **67 vulnerabilidades: 7 críticas, 30 altas, 25
moderadas y 5 bajas**. Las críticas:

| Paquete | Aviso | Corregido en |
| ------- | ----- | ------------ |
| `next` 16.1.3 | RCE no autenticado en servidores Windows | >=16.3.3 |
| `next` | RCE no autenticado en Image Optimization con AVIF | >=16.3.3 |
| `next` | RCE no autenticado en Image Optimization con SVG | >=16.4.1 |
| `next` | RCE no autenticado en `use cache` con typed arrays | >=16.4.1 |
| `next-auth` | Errores de configuración hacen fallar abierto el chequeo de auth | sin parche |
| `next-auth` / `@auth/core` | Bypass del `@` por homoglifos en el normalizador de correo | @auth/core >=0.41.3 |

Entre las altas hay **bypass de middleware/proxy** en App Router (afecta a
`src/proxy.ts`), DoS en Server Actions/Server Components, SSRF en rewrites y
CVEs de `sharp`/`postcss`/`lodash`/`nanoid`.

Mitigantes presentes hoy: `poweredByHeader: false`, `dangerouslyAllowSVG` no
está activado, no hay `images.remotePatterns` (solo imágenes locales), la
autorización real la hace Django en cada petición y el proxy solo comprueba la
cookie. Aun así, el upgrade es obligatorio antes de producción.

**Recomendación:** rama `chore/next-upgrade` a `next >= 16.4.1` y `next-auth`
estable (o versión con `@auth/core >= 0.41.3`), con `next build`, `vitest` y la
E2E completa. Ya estaba anotado como **F2-01**; este paso lo eleva a bloqueante.

### S4-02 — Contraseña inicial del superadministrador igual a la cédula (ALTA, a decisión)

`preparar_produccion` crea la cuenta `30799436` con
`make_password(CEDULA_SUPERADMIN)` y una `PasswordInicial` que obliga el cambio
(7 días). Mientras no se cambie, cualquiera que conozca la cédula puede entrar.

**Recomendación:** leer una `SUPERADMIN_PASSWORD_INICIAL` del entorno (aleatoria,
mínimo 16) y mantener el cambio forzado; si no está definida, abortar el
bootstrap en producción.

### S4-03 — Auditoría y login registraban la IP del proxy (MEDIA, **corregido**)

`core/presentation/audit.py` y `LoginView` usaban `request.META['REMOTE_ADDR']`,
que detrás de nginx/Next es la IP del proxy: los registros de auditoría y de
bloqueos quedaban sin la IP del cliente (pérdida forense; el throttle de DRF sí
usaba `NUM_PROXIES`).

- Nuevo `core/presentation/ip_cliente.py::ip_del_cliente`, con la misma regla que
  DRF: con N proxies de confianza toma el salto N desde el final de
  `X-Forwarded-For`; sin proxies ignora la cabecera (falsificable).
- `origen_de_peticion` (auditoría) y `LoginView` lo usan.
- Pruebas nuevas en `tests/unit/core/test_ip_cliente.py` (5 casos: sin cabecera,
  1 y 2 proxies, 0 proxies, más proxies que saltos).

Recuerda la decisión de T2: el nginx de producción debe **sobrescribir**
`X-Forwarded-For` con `$remote_addr`, no solo añadirla.

### S4-04 — Archivos de `MEDIA_ROOT` accesibles con solo sesión (MEDIA, a decisión)

`core/presentation/views/media_views.py` sirve cualquier archivo de
`MEDIA_ROOT` a cualquier cuenta autenticada (solo deniega el prefijo
`familiares/`). Si en `MEDIA_ROOT` hay soportes de expedientes, un usuario
autenticado puede leer los de otro conociendo o adivinando la ruta.

Mitigantes: resolución segura de rutas (sin `..`, sin NUL, `resolve()` dentro de
la base), `nosniff`, adjunto para tipos no listados, `no-store`. Las fotos y
soportes nuevos van a SeaweedFS con clave UUID y se sirven por endpoints
autorizados, así que el riesgo se limita a archivos legados.

**Recomendación:** servir solo por clave opaca (como SeaweedFS) o comprobar el
dueño de la ruta; si `MEDIA_ROOT` queda vacío en producción, retirar el endpoint.

### S4-05 — Documentación OpenAPI visible para cualquier sesión (MEDIA, a decisión)

`/api/schema/`, `/api/docs/` y `/api/redoc/` usan `PERMISOS_DOCUMENTACION =
[IsAuthenticated]`. Cualquier cuenta (incluido un pasivo) puede descargar el
contrato completo: rutas, parámetros y modelos. Es divulgación de información,
no una brecha de datos.

**Recomendación:** exigir un permiso administrativo (p. ej. el de configuración
del sistema) o habilitarlo solo con `DEBUG`/red interna.

### S4-06 — Dependencias del backend sin auditar (BAJA, a decisión)

`pip-audit` no está instalado en la imagen y `requirements.txt` no está fijado
(deuda ya anotada). No se pudo comprobar CVE de Django/DRF desde aquí.

**Recomendación:** añadir `pip-audit` al CI y fijar versiones (misma tarea que
`requirements-dev.txt`).

### S4-07 — Datos del QR público del carnet (INFO, decisión ya anotada)

La ficha pública devuelve datos personales a quien tenga el hash (64 caracteres,
impreso en el carnet) y el POST `/medica/` devuelve datos de salud. Es el diseño
de emergencia del carnet; la visibilidad por dato es la decisión **S2-01**.

## Verificado (sin hallazgo)

| Área | Comprobación |
| ---- | ------------ |
| Cookies | `dj_access` 15 min y `dj_refresh` 8 h, `HttpOnly`, `Secure` (salvo DEBUG), `SameSite=Lax`, `path=/` |
| Rotación | `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`; el refresh revalida `is_active` y `permisos_version` y blacklistea el anterior |
| Logout | Blacklistea el refresh y limpia cookies **aunque** el blacklisteo falle |
| Bloqueo | 5 intentos → 15/30/60 min progresivos, audita en DB y en `security_backend.txt` |
| Enumeración | Mensaje genérico y hash ficticio para correos sin cuenta; prueba de tiempo constante |
| Contraseñas | Argon2id OWASP (m=19 MiB, t=2, p=1) + validadores de Django; cambio propio exige la actual y opera sobre `request.user` |
| Recuperación | Token firmado de un solo uso, 15 min, anti-replay por huella del hash, respuesta genérica |
| Permisos | 0 vistas sin `permission_classes`; 8 públicas previstas y con throttle; guarda de cédula propia en los recursos del trabajador |
| Inyección | Sin `eval/exec/pickle/yaml.load/os.system/shell=True`; `RawSQL` parametrizado; `cursor.execute(f...)` solo en migraciones con nombres de tabla constantes y parámetros ligados |
| XSS | Sin `dangerouslySetInnerHTML` salvo el CSS tipado del chart de shadcn; sin `innerHTML` fuera de pruebas |
| SSRF | Ninguna petición saliente con URL del usuario |
| Subidas | `validar_archivo` (tamaño, extensión y magic bytes) + `clave_segura` (UUID); import de invitados acotado (03-03) |
| Archivos | Streaming con MIME por extensión, `nosniff`, adjunto si no es imagen/PDF, rutas resueltas dentro de la base |
| Integración | `X-API-Key` con `hmac.compare_digest`, longitud mínima 16, throttle por sistema, sin log de la clave |
| Cabeceras | Next: CSP (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri`, `form-action`), XFO, HSTS, `nosniff`, Referrer, Permissions-Policy. Django: `SECURE_*`, HSTS, SSL redirect y cookies seguras por entorno |
| Secretos | `.env` no está versionado; sin claves ni contraseñas en el código (solo contraseñas de prueba) |
| Documentación | `/api/schema|docs|redoc` requieren sesión (ver S4-05) |

## Verificación de este paso

- `pytest tests/unit/core/test_ip_cliente.py tests/unit/core/test_auditoria_user_agent.py
  tests/integration/identidad/test_seguridad_cuentas_api.py
  tests/unit/identidad/test_login_tiempo_constante.py --create-db`: (resultado en la
  corrida de cierre).
- `pnpm audit --prod`: 67 vulnerabilidades (S4-01).
