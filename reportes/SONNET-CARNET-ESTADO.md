# Estado Sonnet: carnetización (formas por puntos, check-in con carnet, campos con origen)

## Estado de las fallas
- El coordinador reportó 14 fallas en carnetización (253 pasan). Solo se identificaron 5, todas en `tests/integration/carnetizacion/test_campos_personalizados_origen.py`:
  consultar_no_exige, editar_asigna_origen, eliminar_con_permiso, resuelve_cada_origen, generar_pdf_pasa_el_valor.
- Las otras 9 no se conocen. NO he corregido ninguna falla todavía.
- Lancé pytest (solo carnetización) en segundo plano (tarea bv9t4v8ec); al escribir esto no había producido salida. Salida en:
  `C:\Users\josef\AppData\Local\Temp\claude\28f69c3684128d2e\30e3b145-52be-4e7a-a202-d43f81523371\tasks\bv9t4v8ec.output`
  Si la laptop se reinicia, la corrida se pierde.

## Hipótesis de las 5 fallas (sin confirmar)
- Probable causa común: `GET /campos/` (consultar), PATCH y DELETE devuelven error con el usuario falso, o hay un problema de fixtures en BD (p. ej. `CampoPersonalizadoModel`/`SexoModel`/`EmployeeModel` en la BD de prueba, tabla `CarnetCampoPersonalizado` sin la columna `origen` si la BD de prueba se reutiliza sin `--create-db`).
  Es MUY probable que las fallas se deban a que la BD de prueba reutilizada (`--reuse-db`) no tiene la columna `origen`: hace falta recrearla (`--create-db`) o que el coordinador lo haga una vez.
- Revisar primero con `pytest tests/integration/carnetizacion/test_campos_personalizados_origen.py --tb=short`.

## Archivos tocados (sin commit)
Backend (`BACKEND/apps/`):
- carnetizacion: `infrastructure/pdf/carnet_pdf.py`, `infrastructure/resolver_origen_campos.py` (nuevo), `infrastructure/repositories/repo_eventos_orm.py`, `infrastructure/repositories/repo_carnetizacion_orm.py`, `infrastructure/models/carnetizacion_models.py`, `infrastructure/mappers/mapper_carnetizacion.py`, `domain/entities/campo_credencial.py`, `domain/entities/evento.py`, `domain/ports/repo_eventos.py`, `domain/ports/repo_carnetizacion.py`, `domain/services/control_entrada_service.py`, `application/use_cases/gestionar_campos.py`, `presentation/serializers/carnetizacion_serializers.py`, `presentation/views/carnetizacion_views.py`, `migrations/0012_campo_personalizado_origen.py` (nuevo)
- identidad: `management/commands/seed_permisos.py`, `migrations/0015_seed_campos_personalizados_carnet.py` (nuevo)
Tests (`BACKEND/tests/`): `unit/carnetizacion/test_pdf_formas_puntos.py` (nuevo), `integration/carnetizacion/test_checkin_carnet_institucional.py` (nuevo), `integration/carnetizacion/test_campos_personalizados_origen.py` (nuevo), `unit/carnetizacion/test_registro_campos.py` (modificado)
Frontend (`NextJS/src/modules/carnetizacion/`): `ui/components/registro-campos-tab.tsx`, `domain/entities/origen-campo.ts` (nuevo), `domain/entities/carnet.ts`, `domain/ports/repo-carnetizacion.ts`, `infrastructure/http/carnetizacion-api.ts`, `infrastructure/mappers/mapper-carnetizacion.ts`, `infrastructure/repositories/repo-carnetizacion-api.ts`, `infrastructure/actions/carnetizacion-actions.ts`, `application/use-cases/gestionar-campos.ts` y tests `gestionar-campos.test.ts`, `carnetizacion.test.ts`, `disenar-carnet.test.ts`.

## Verificado
lint-imports 103 OK; makemigrations --check sin cambios; tsc, eslint (carnetizacion) y vitest carnetización (132) OK.

## Falta exactamente
1. Obtener la lista completa de los 14 fallos (correr pytest carnetización con `--tb=short`, sin `--create-db` salvo que la BD reutilizada no tenga la columna `origen`).
2. Diagnosticar y corregir los míos (campos con origen, check-in, PDF formas).
3. Reportar sin corregir los que vengan del motivo de reemisión (Antigravity).
