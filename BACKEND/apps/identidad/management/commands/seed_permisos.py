"""
Management command para poblar el catálogo maestro de permisos y la matriz inicial de roles.

Ejecutar:
    python manage.py seed_permisos
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.identidad.infrastructure.models.permiso_model import (
    PermisoModel,
    RolPermisoModel,
)
from apps.identidad.infrastructure.legado.cuenta_models import RolEspejo

# Catálogo taxonómico de permisos del Sistema GATH: [modulo].[accion]
PERMISOS_CATALOGO = [
    # ─── 1. IDENTIDAD Y SEGURIDAD ───
    ("identidad.ver_usuarios", "Consultar listado y detalles de usuarios"),
    ("identidad.crear_usuarios", "Registrar nuevos usuarios en el sistema"),
    ("identidad.editar_usuarios", "Modificar datos de usuarios existentes"),
    ("identidad.desactivar_usuarios", "Activar o desactivar cuentas de usuario"),
    ("identidad.cambiar_password", "Forzar o gestionar cambio de contraseña"),
    ("identidad.ver_roles", "Consultar roles existentes"),
    ("identidad.crear_roles", "Crear nuevos roles institucionales"),
    ("identidad.editar_roles", "Modificar nombres o descripciones de roles"),
    ("identidad.eliminar_roles", "Eliminar roles no asignados"),
    ("identidad.asignar_permisos", "Modificar la matriz de permisos de roles"),
    ("identidad.desbloquear_cuentas", "Desbloquear cuentas tras incidentes de seguridad"),

    # ─── 2. ORGANIZACIÓN ───
    ("organizacion.ver", "Consultar dependencias, direcciones y coordinaciones"),
    ("organizacion.crear", "Registrar nuevas unidades organizativas"),
    ("organizacion.editar", "Modificar unidades organizativas"),
    ("organizacion.eliminar", "Desactivar o eliminar unidades organizativas"),
    ("organizacion.ver_sedes", "Consultar sedes y ubicaciones físicas"),
    ("organizacion.gestionar_sedes", "Crear y modificar sedes físicas"),

    # ─── 3. CATÁLOGOS ───
    ("catalogos.ver", "Consultar tablas maestras (profesiones, parentescos, etc.)"),
    ("catalogos.crear", "Registrar nuevos elementos en catálogos"),
    ("catalogos.editar", "Modificar elementos de catálogos"),
    ("catalogos.eliminar", "Desactivar elementos de catálogos"),

    # ─── 4. PERSONAL ACTIVO ───
    ("personal.ver", "Consultar ficha básica y listado de trabajadores activos"),
    ("personal.ver_detalle", "Consultar expediente completo de trabajador activo"),
    ("personal.crear", "Registrar nuevo trabajador activo"),
    ("personal.editar_personales", "Actualizar datos personales y de contacto"),
    ("personal.editar_laborales", "Actualizar datos de contratación y nómina"),
    ("personal.editar_educacion", "Actualizar nivel de instrucción y títulos"),
    ("personal.editar_vivienda", "Actualizar información habitacional"),
    ("personal.ver_salud", "Consultar información médica y salud (PII protegido)"),
    ("personal.editar_salud", "Actualizar información médica y antecedentes de salud"),
    ("personal.egresar", "Procesar egreso de personal activo"),
    ("personal.reincorporar", "Reincorporar trabajador egresado"),
    ("personal.carga_masiva", "Ejecutar importación masiva de personal vía Excel"),

    # ─── 5. PERSONAL PASIVO ───
    ("pasivos.ver", "Consultar listado y ficha básica de personal pasivo"),
    ("pasivos.ver_detalle", "Consultar expediente completo de personal pasivo"),
    ("pasivos.crear", "Registrar nuevo personal jubilado/pensionado"),
    ("pasivos.editar", "Modificar datos de personal pasivo"),
    ("pasivos.cambiar_condicion", "Actualizar condición pasiva (jubilado, sobreviviente)"),

    # ─── 6. CARGOS Y UBICACIONES ───
    ("cargos.ver", "Consultar catálogo de cargos y vacantes"),
    ("cargos.crear", "Crear nuevas denominaciones de cargos"),
    ("cargos.editar", "Modificar denominaciones o requisitos de cargos"),
    ("cargos.asignar", "Asignar titular a un cargo"),
    ("cargos.prestar", "Registrar préstamo de cargo a otra dependencia"),
    ("cargos.revertir_prestamo", "Revertir préstamo de cargo"),
    ("cargos.desincorporar", "Desincorporar o eliminar cargo vacante"),

    # ─── 7. FAMILIARES Y CARGAS ───
    ("familiares.ver", "Consultar familiares y cargas de trabajadores"),
    ("familiares.crear", "Registrar nuevo familiar o carga"),
    ("familiares.editar", "Modificar datos de familiar"),
    ("familiares.eliminar", "Desactivar o eliminar carga familiar"),
    ("familiares.adjuntar_documento", "Adjuntar partidas o constancias familiares"),
    ("familiares.descargar_documento", "Descargar documentos adjuntos de familiares"),

    # ─── 8. MOVIMIENTOS E HISTORIAL ───
    ("movimientos.ver", "Consultar historial de movimientos y transiciones"),
    ("movimientos.registrar_traslado", "Registrar cambio de dependencia o ubicación"),
    ("movimientos.registrar_ascenso", "Registrar ascenso de cargo o grado"),
    ("movimientos.registrar_aumento", "Registrar ajuste salarial"),
    ("movimientos.anular", "Anular movimiento laboral registrado"),

    # ─── 9. REPORTES Y CONSTANCIAS ───
    ("reportes.ver", "Acceder al módulo de reportes"),
    ("reportes.generar_pdf", "Generar y descargar reportes en PDF"),
    ("reportes.generar_excel", "Generar y descargar reportes en Excel"),
    ("reportes.emitir_constancias", "Emitir constancias de trabajo y certificaciones"),
    ("reportes.estadisticas", "Consultar estadísticas consolidadas de RRHH"),

    # ─── 10. CARNETIZACIÓN ───
    ("carnetizacion.ver", "Consultar estado de carnetización y carnets emitidos"),
    ("carnetizacion.disenar", "Gestionar plantillas de carnet"),
    ("carnetizacion.emitir", "Emitir y generar carnets con QR criptográfico"),
    ("carnetizacion.revocar", "Revocar o invalidar carnet emitido"),
    ("carnetizacion.reimprimir", "Solicitar reimpresión de carnet"),

    # ─── 11. AUTOGESTIÓN ───
    ("autogestion.ver_propio", "Consultar expediente personal propio"),
    ("autogestion.actualizar_propio", "Actualizar datos personales propios"),
    ("autogestion.censo_ver_propio", "Consultar formulario de censo propio"),
    ("autogestion.censo_actualizar_propio", "Responder o modificar su censo socioeconómico"),
    ("autogestion.censo_ver_todos", "Consultar censos de todos los trabajadores (RRHH)"),
    ("autogestion.censo_exportar", "Exportar consolidado de censos"),

    # ─── 12. AUDITORÍA ───
    ("auditoria.ver_logs", "Consultar bitácora de transacciones y auditoría"),
    ("auditoria.ver_seguridad", "Consultar incidentes y bloqueos de seguridad"),
]

# Matriz de asignación por ID de rol conocido
ROL_ASIGNACIONES = {
    # 1: ADMINISTRADOR -> Todos los permisos
    1: [p[0] for p in PERMISOS_CATALOGO],

    # 2: ANALISTA -> Gestión operativa completa de RRHH
    2: [
        "identidad.ver_usuarios",
        "identidad.ver_roles",
        "organizacion.ver",
        "organizacion.crear",
        "organizacion.editar",
        "organizacion.ver_sedes",
        "catalogos.ver",
        "catalogos.crear",
        "catalogos.editar",
        "personal.ver",
        "personal.ver_detalle",
        "personal.crear",
        "personal.editar_personales",
        "personal.editar_laborales",
        "personal.editar_educacion",
        "personal.editar_vivienda",
        "personal.egresar",
        "personal.reincorporar",
        "personal.carga_masiva",
        "pasivos.ver",
        "pasivos.ver_detalle",
        "pasivos.crear",
        "pasivos.editar",
        "pasivos.cambiar_condicion",
        "cargos.ver",
        "cargos.crear",
        "cargos.editar",
        "cargos.asignar",
        "cargos.prestar",
        "cargos.revertir_prestamo",
        "familiares.ver",
        "familiares.crear",
        "familiares.editar",
        "familiares.eliminar",
        "familiares.adjuntar_documento",
        "familiares.descargar_documento",
        "movimientos.ver",
        "movimientos.registrar_traslado",
        "movimientos.registrar_ascenso",
        "movimientos.registrar_aumento",
        "reportes.ver",
        "reportes.generar_pdf",
        "reportes.generar_excel",
        "reportes.emitir_constancias",
        "reportes.estadisticas",
        "carnetizacion.ver",
        "carnetizacion.emitir",
        "carnetizacion.reimprimir",
        "autogestion.censo_ver_todos",
        "autogestion.censo_exportar",
    ],

    # 3: AUTOGESTION -> Servicios y censo del propio empleado
    3: [
        "autogestion.ver_propio",
        "autogestion.actualizar_propio",
        "autogestion.censo_ver_propio",
        "autogestion.censo_actualizar_propio",
    ],

    # 4: PRESUPUESTO -> Consulta de cargos, estructura y reportes financieros/laborales
    4: [
        "organizacion.ver",
        "organizacion.ver_sedes",
        "personal.ver",
        "pasivos.ver",
        "cargos.ver",
        "cargos.asignar",
        "reportes.ver",
        "reportes.generar_pdf",
        "reportes.generar_excel",
        "reportes.estadisticas",
    ],

    # 5: BIENESTAR SOCIAL -> Salud, familiares, censos y reportes
    5: [
        "personal.ver",
        "personal.ver_detalle",
        "personal.ver_salud",
        "personal.editar_salud",
        "pasivos.ver",
        "pasivos.ver_detalle",
        "familiares.ver",
        "familiares.adjuntar_documento",
        "familiares.descargar_documento",
        "autogestion.censo_ver_todos",
        "autogestion.censo_exportar",
        "reportes.ver",
        "reportes.generar_pdf",
        "reportes.generar_excel",
    ],

    # 9: RECEPCIONISTA -> Estricta consulta de personal y familiares (PLAN_ROL_RECEPCIONISTA)
    9: [
        "personal.ver",
        "pasivos.ver",
        "familiares.ver",
    ],
}


class Command(BaseCommand):
    help = "Puebla el catálogo taxonómico de permisos y la matriz inicial de roles en apps.identidad"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Iniciando seed de catálogo de permisos..."))

        with transaction.atomic():
            # 1. Upsert de Permisos
            permisos_creados = 0
            permisos_actualizados = 0
            permiso_objs = {}

            for codigo, nombre in PERMISOS_CATALOGO:
                obj, created = PermisoModel.objects.update_or_create(
                    codigo=codigo,
                    defaults={"nombre": nombre},
                )
                permiso_objs[codigo] = obj
                if created:
                    permisos_creados += 1
                else:
                    permisos_actualizados += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"Permisos procesados: {len(PERMISOS_CATALOGO)} "
                    f"({permisos_creados} creados, {permisos_actualizados} actualizados)."
                )
            )

            # 2. Asignación a Roles
            asignaciones_creadas = 0
            roles_existentes = {r.id: r.nombre_rol for r in RolEspejo.objects.all()}

            for rol_id, codigos in ROL_ASIGNACIONES.items():
                if rol_id not in roles_existentes:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Rol ID {rol_id} no existe en tabla user_rol. Omitiendo asignación."
                        )
                    )
                    continue

                nombre_rol = roles_existentes[rol_id]
                for codigo in codigos:
                    permiso_obj = permiso_objs.get(codigo)
                    if not permiso_obj:
                        continue

                    _, created = RolPermisoModel.objects.get_or_create(
                        rol_id=rol_id,
                        permiso=permiso_obj,
                    )
                    if created:
                        asignaciones_creadas += 1

                self.stdout.write(
                    f" - Rol '{nombre_rol}' (ID {rol_id}): {len(codigos)} permisos vinculados."
                )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Matriz rol-permiso actualizada. Total nuevas asignaciones: {asignaciones_creadas}."
                )
            )
