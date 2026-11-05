"""
Management command para poblar el catálogo maestro de permisos y la matriz inicial de roles.

Ejecutar:
    python manage.py seed_permisos
"""
import uuid

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.identidad.infrastructure.models.permiso_model import (
    PermisoModel,
    RolPermisoModel,
)
from apps.identidad.infrastructure.models.usuario_permiso_model import UsuarioPermisoModel
from apps.identidad.infrastructure.legado.cuenta_models import RolEspejo
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.identidad.infrastructure.repositories.repo_roles_orm import RepoRolesORM
from core.presentation.audit import registrar_auditoria

# Catálogo taxonómico de permisos del Sistema GATH: [modulo].[accion]
PERMISOS_CATALOGO = [
    # ─── 1. IDENTIDAD Y SEGURIDAD ───
    ("identidad.ver_usuarios", "Consultar listado y detalles de usuarios"),
    ("identidad.crear_usuarios", "Registrar nuevos usuarios en el sistema"),
    ("identidad.editar_usuarios", "Modificar datos de usuarios existentes"),
    ("identidad.desactivar_usuarios", "Activar o desactivar cuentas de usuario"),
    ("identidad.restablecer_acceso", "Restablecer el acceso de un trabajador (repone la contraseña inicial)"),
    ("identidad.cambiar_correo_acceso", "Elegir el correo de acceso de un trabajador (pase a pasivo)"),
    ("identidad.cambiar_password", "Forzar o gestionar cambio de contraseña"),
    ("identidad.ver_roles", "Consultar roles existentes"),
    ("identidad.crear_roles", "Crear nuevos roles institucionales"),
    ("identidad.editar_roles", "Modificar nombres o descripciones de roles"),
    ("identidad.eliminar_roles", "Eliminar roles no asignados"),
    ("identidad.asignar_permisos", "Modificar la matriz de permisos de roles"),
    ("identidad.desbloquear_cuentas", "Desbloquear cuentas tras incidentes de seguridad"),
    ("identidad.listar_permisos", "Consultar el catálogo completo de permisos"),
    ("identidad.consultar_permisos", "Consultar el permiso efectivo de una cuenta"),
    ("identidad.gestionar_permisos_individuales", "Gestionar los permisos individuales (overrides allow/deny) de una cuenta"),

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
    ("personal.exportar_pdf", "Exportar el expediente de un trabajador activo en PDF"),
    ("personal.reportes_error_ver", "Consultar y gestionar reportes de error en datos laborales"),

    # ─── 5. PERSONAL PASIVO ───
    ("pasivos.ver", "Consultar listado y ficha básica de personal pasivo"),
    ("pasivos.ver_detalle", "Consultar expediente completo de personal pasivo"),
    ("pasivos.crear", "Registrar nuevo personal jubilado/pensionado"),
    ("pasivos.editar", "Modificar datos de personal pasivo"),
    ("pasivos.exportar_pdf", "Exportar el expediente de un trabajador pasivo en PDF"),
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
    ("movimientos.exportar_pdf", "Exportar el historial de movimientos en PDF"),
    ("movimientos.exportar_excel", "Exportar el historial de movimientos en Excel"),
    ("personal.recibir_avisos_movimientos", "Recibir avisos de movimientos del personal (ingreso, traslado, egreso, cambio de cargo o de estatus)"),

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

    # ─── 13. CONFIGURACIÓN VISUAL (HU 0009 — Cintillo Editable) ───
    ("configuracion.editar", "Editar la configuración visual del cintillo institucional (PDFs)"),

    # ─── 14. PUNTO DE CUENTA ───
    ("puntocuenta.ver", "Consultar los puntos de cuenta generados por cambios de dependencia"),

    # ─── 15. AUTOGESTIÓN: solicitudes de actualización (PLAN_PRIORIDAD §2.4) ───
    ("autogestion.solicitar_actualizacion", "Solicitar la actualización de sus datos (flujo con revisión de Bienestar)"),
    ("autogestion.editar_borrador", "Editar su borrador de actualización mientras la ventana está habilitada"),
    ("autogestion.subir_soporte", "Subir soportes propios (títulos, actas) a una solicitud"),

    # ─── 16. BIENESTAR SOCIAL: revisión de actualizaciones ───
    ("bienestar.ver_solicitudes", "Consultar las solicitudes de actualización de los trabajadores"),
    ("bienestar.habilitar_ventana", "Habilitar o cerrar la ventana de actualización de un trabajador"),
    ("bienestar.revisar_actualizacion", "Revisar, observar o rechazar una solicitud de actualización"),
    ("bienestar.aprobar", "Aprobar (total o parcialmente) o rechazar una actualización de datos: decide UNA sola persona"),
    ("bienestar.prorrogar_ventana", "Prorrogar el plazo de una ventana de actualización de datos"),
    ("bienestar.configurar_secciones", "Configurar las secciones autogestionables (soporte obligatorio, activas)"),

    # ─── 17. FE DE VIDA DE PASIVOS ───
    ("fe_de_vida.solicitar", "Enviar su solicitud de fe de vida (pasivo)"),
    ("fe_de_vida.ver_propia", "Consultar el estado y la constancia de su fe de vida"),
    ("fe_de_vida.revisar", "Revisar evidencia, rechazar o pedir repetición de una fe de vida"),
    ("fe_de_vida.check_analista", "Dar el check de la Analista en una fe de vida"),
    ("fe_de_vida.check_administradora", "Dar el check de la Administradora en una fe de vida"),
    ("fe_de_vida.aprobar_directo", "Validar una fe de vida por aprobación directa de la Administradora"),
    ("fe_de_vida.ver_evidencia", "Ver la foto de evidencia de una fe de vida (URL prefirmada corta)"),
    ("fe_de_vida.verificar_constancia", "Verificar internamente una constancia de fe de vida"),
    ("fe_de_vida.ver_panel", "Consultar el panel de fe de vida de Bienestar"),
    ("fe_de_vida.configurar_plantilla", "Editar la plantilla de la constancia de fe de vida"),
    ("fe_de_vida.gestionar_procesos", "Crear, abrir y cerrar procesos de fe de vida"),
    ("fe_de_vida.prorrogar", "Conceder prórrogas (individual o general) en un proceso de fe de vida"),
    ("fe_de_vida.ver_cobertura", "Consultar la cobertura de un proceso de fe de vida (quién cumplió y quién no)"),
    ("fe_de_vida.ver_estadisticas", "Consultar las estadísticas de un proceso de fe de vida y exportar sus listados"),
    ("fe_de_vida.registrar_presencial", "Registrar la fe de vida de un pasivo que asiste de manera presencial"),

    # ─── 18. NOTIFICACIONES ───
    ("notificaciones.ver_propias", "Consultar y marcar como leídas sus notificaciones"),
    ("notificaciones.administrar", "Administrar el correo saliente (reintentos y fallidas)"),

    # ─── 12b. AUDITORÍA (ampliación) ───
    ("auditoria.exportar", "Exportar la bitácora de auditoría"),
]

# Permisos del catálogo que el rol ADMINISTRADOR NO recibe (G12): los avisos de
# movimientos son operativos de RRHH y Bienestar, no de administración del sistema.
PERMISOS_EXCLUIDOS_ADMINISTRADOR = frozenset({
    "personal.recibir_avisos_movimientos",
})

# Matriz de asignación por ID de rol conocido
ROL_ASIGNACIONES = {
    # 1: ADMINISTRADOR -> Todos los permisos, salvo las exclusiones nombradas
    1: [p[0] for p in PERMISOS_CATALOGO if p[0] not in PERMISOS_EXCLUIDOS_ADMINISTRADOR],

    # 2: ANALISTA -> Gestión operativa completa de RRHH
    2: [
        "identidad.ver_usuarios",
        "identidad.ver_roles",
        "identidad.restablecer_acceso",
        "identidad.cambiar_correo_acceso",
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
        "personal.exportar_pdf",
        "personal.reportes_error_ver",
        "pasivos.ver",
        "pasivos.ver_detalle",
        "pasivos.crear",
        "pasivos.editar",
        "pasivos.cambiar_condicion",
        "pasivos.exportar_pdf",
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
        "movimientos.exportar_pdf",
        "movimientos.exportar_excel",
        "personal.recibir_avisos_movimientos",
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
        "catalogos.ver",  # tablas de referencia (estados, parentescos...) que usan los formularios; NUNCA personal.ver
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
        "personal.exportar_pdf",
        "pasivos.ver",
        "pasivos.ver_detalle",
        "pasivos.exportar_pdf",
        "familiares.ver",
        "familiares.adjuntar_documento",
        "familiares.descargar_documento",
        "autogestion.censo_ver_todos",
        "autogestion.censo_exportar",
        "reportes.ver",
        "reportes.generar_pdf",
        "reportes.generar_excel",
        "personal.recibir_avisos_movimientos",
    ],

    # 9: RECEPCIONISTA -> Estricta consulta de personal y familiares (PLAN_ROL_RECEPCIONISTA).
    # Amplía a partir de CC-APP-2026-08-001 (Control de Cambio original del rol): el objetivo es
    # "revisar la información...tanto activos como pasivos" (expediente completo), pero "ocultar
    # ...la exportación de expedientes" -- por eso se otorga *.ver_detalle pero NO *.exportar_pdf.
    9: [
        "personal.ver",
        "personal.ver_detalle",
        "pasivos.ver",
        "familiares.ver",
    ],
}

# ─── Roles nuevos (PLAN_PRIORIDAD §2.4) ─────────────────────────────────────
# Se crean por nombre (el id lo asigna la secuencia de USER_rol) si no existen; el
# seed nunca renombra ni mueve usuarios de roles existentes.
ROL_BIENESTAR_SOCIAL_ID = 5
NOTIFICACIONES_PROPIAS = "notificaciones.ver_propias"

# Slots historicos de ROL_ASIGNACIONES -> nombre real del rol. El seed resuelve
# por nombre para no depender de IDs que cambian entre bases heredadas.
NOMBRES_ROL = {
    1: "ADMINISTRADOR",
    2: "ANALISTA",
    3: "AUTOGESTION",
    4: "PRESUPUESTO",
    5: "BIENESTAR SOCIAL",
    9: "RECEPCIONISTA",
}


def _normalizar_rol(nombre: str) -> str:
    """Unifica tildes de base: la BD legada tiene «BIENSTAR SOCIAL»."""
    return " ".join(
        str(nombre or "").strip().upper().replace("BIENSTAR", "BIENESTAR").split()
    )

# Autogestión (PLAN §2.4 actualizado): UNA sola persona aprueba, así que Analista y Administradora
# tienen EL MISMO permiso `bienestar.aprobar`; ya no hay checks por rol ni aprobación directa en
# autogestión (siguen en la fe de vida con `fe_de_vida.*`).
PERMISOS_BIENESTAR_ANALISTA = [
    "bienestar.ver_solicitudes",
    "bienestar.habilitar_ventana",
    "bienestar.revisar_actualizacion",
    "bienestar.aprobar",
    "bienestar.prorrogar_ventana",
    "personal.editar_personales",
    "personal.editar_laborales",
    "personal.editar_educacion",
    "personal.editar_vivienda",
    "fe_de_vida.revisar",
    "fe_de_vida.check_analista",
    "fe_de_vida.ver_evidencia",
    "fe_de_vida.verificar_constancia",
    "fe_de_vida.ver_panel",
    "fe_de_vida.ver_cobertura",
    "fe_de_vida.ver_estadisticas",
    "fe_de_vida.registrar_presencial",
]
# La Administradora NO hereda el check de la Analista de la fe de vida: ese doble check exige dos
# personas distintas (para validar sola existe la aprobación directa, auditada).
PERMISOS_BIENESTAR_ADMIN = [
    p for p in PERMISOS_BIENESTAR_ANALISTA if p != "fe_de_vida.check_analista"
] + [
    "bienestar.configurar_secciones",
    # Decisión H: crear/abrir/cerrar procesos y conceder prórrogas es solo de la Administradora.
    "fe_de_vida.gestionar_procesos",
    "fe_de_vida.prorrogar",
    "fe_de_vida.check_administradora",
    "fe_de_vida.aprobar_directo",
    "fe_de_vida.configurar_plantilla",
]

# Ampliaciones aditivas a roles existentes (por id).
# Permisos de autogestión por solicitud que se retiran (PLAN §2.4: reemplazados por `bienestar.aprobar`).
# Revisado el 2026-10-29: ningún código del backend ni del frontend los referencia; solo los tenían
# ANALISTA_BIENESTAR / ADMIN_BIENESTAR (y ADMINISTRADOR). El seed los retira de forma idempotente,
# salvo que algún usuario tenga una excepción individual que los cite (entonces los conserva y avisa).
PERMISOS_RETIRADOS = ("bienestar.check_analista", "bienestar.check_administradora", "bienestar.aprobar_directo")

# Asignaciones que se retiran de un rol (por nombre) sin borrar el permiso del catálogo. Idempotente; no toca
# excepciones individuales de usuario.
ASIGNACIONES_RETIRADAS = {
    "ANALISTA_BIENESTAR": ("fe_de_vida.gestionar_procesos", "fe_de_vida.prorrogar"),
    # RECEPCIONISTA solo consulta familiares de activos y pasivos: no necesita
    # catálogos, organización ni su propio expediente.
    "RECEPCIONISTA": (
        "autogestion.ver_propio",
        "catalogos.ver",
        "organizacion.ver",
    ),
    # G12: aunque el rol 1 conserva casi todo el catálogo, los avisos de
    # movimientos quedan solo para RRHH y Bienestar. Retirarlo aquí hace que
    # volver a correr el seed quite una asignación heredada.
    "ADMINISTRADOR": ("personal.recibir_avisos_movimientos",),
}

ROL_ASIGNACIONES[2] += ["fe_de_vida.verificar_constancia"]
# B8: «Mi expediente» exige `autogestion.ver_propio`; todo trabajador con cuenta ve su propia ficha,
# así que se añade (aditivo) a los roles de personal que antes entraban solo por IsAuthenticated.
for _rol_id in (2, 4):
    ROL_ASIGNACIONES[_rol_id].append("autogestion.ver_propio")
# Catálogo de tipos de nómina y organismos para los roles que gestionan
# pasivos: sin `catalogos.ver` y `organizacion.ver`, el filtro de pasivos y el
# alta directa quedan vacíos (403). ANALISTA_BIENESTAR y ADMIN_BIENESTAR
# heredan de BIENESTAR SOCIAL (5).
for _rol_id in (4, 5):
    ROL_ASIGNACIONES[_rol_id].append("catalogos.ver")
    ROL_ASIGNACIONES[_rol_id].append("organizacion.ver")
ROL_ASIGNACIONES[3] += [
    "autogestion.solicitar_actualizacion",
    "autogestion.editar_borrador",
    "autogestion.subir_soporte",
    # Fe de vida: el permiso lo tiene todo AUTOGESTION; que el trabajador sea pasivo es su
    # CONDICIÓN (dato derivado, validado en servidor), no un rol.
    "fe_de_vida.solicitar",
    "fe_de_vida.ver_propia",
]
ROL_ASIGNACIONES[ROL_BIENESTAR_SOCIAL_ID] += ["fe_de_vida.verificar_constancia", "autogestion.ver_propio"]
for _rol_id in (2, 3, 4, ROL_BIENESTAR_SOCIAL_ID, 9):
    ROL_ASIGNACIONES[_rol_id].append(NOTIFICACIONES_PROPIAS)

ROLES_NUEVOS = {
    "ANALISTA_BIENESTAR": (
        "Analista de Bienestar: revisa actualizaciones y fe de vida (check de la Analista). Nunca aprueba directo.",
        ROL_ASIGNACIONES[ROL_BIENESTAR_SOCIAL_ID] + PERMISOS_BIENESTAR_ANALISTA,
    ),
    "ADMIN_BIENESTAR": (
        "Administradora de Bienestar: check de la Administradora, aprobación directa y parametrización.",
        ROL_ASIGNACIONES[ROL_BIENESTAR_SOCIAL_ID] + PERMISOS_BIENESTAR_ADMIN,
    ),
    "AUDITOR": (
        "Auditor de solo lectura: consulta la bitácora, los incidentes de seguridad y, sin editar, usuarios y roles.",
        [
            "auditoria.ver_logs",
            "auditoria.exportar",
            "auditoria.ver_seguridad",
            "notificaciones.ver_propias",
            # D4: lectura de usuarios/roles/matriz; nunca edita ni gestiona overrides.
            "identidad.ver_usuarios",
            "identidad.ver_roles",
            "identidad.listar_permisos",
            "identidad.consultar_permisos",
        ],
    ),
    "JEFE_RRHH": (
        "Jefe de RRHH: consulta la gestión de personal, pasivos, movimientos y cobertura de fe de vida; no administra usuarios ni la matriz.",
        [
            "identidad.ver_usuarios",
            "identidad.ver_roles",
            "identidad.listar_permisos",
            "identidad.consultar_permisos",
            "personal.ver",
            "personal.ver_detalle",
            "personal.exportar_pdf",
            "pasivos.ver",
            "pasivos.ver_detalle",
            "pasivos.exportar_pdf",
            "catalogos.ver",
            "movimientos.ver",
            "reportes.ver",
            "reportes.generar_pdf",
            "reportes.generar_excel",
            "reportes.estadisticas",
            "fe_de_vida.ver_cobertura",
            "fe_de_vida.verificar_constancia",
            "autogestion.ver_propio",
            "notificaciones.ver_propias",
        ],
    ),
    "RECEPCIONISTA": (
        "Consulta de familiares de trabajadores activos y pasivos. Sin registrar, actualizar ni exportar.",
        ROL_ASIGNACIONES[9],
    ),
}
# ADMINISTRADOR conserva todo el catálogo (incluidos los códigos nuevos), salvo
# las exclusiones nombradas arriba.
ROL_ASIGNACIONES[1] = [
    p[0] for p in PERMISOS_CATALOGO if p[0] not in PERMISOS_EXCLUIDOS_ADMINISTRADOR
]


class Command(BaseCommand):
    help = "Puebla el catálogo de permisos y la matriz inicial de roles de apps.identidad (M6)."

    ACCION_SEED = "identidad.matriz_actualizada_por_seed"
    ACTOR_SEED = "sistema (seed)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-invalidar-sesiones",
            action="store_true",
            help="No sube permisos_version de las cuentas de los roles cuya matriz cambió.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Iniciando seed de catálogo de permisos..."))

        with transaction.atomic():
            # 1. Catálogo: solo se CREA lo que no existe. La metadata existente
            #    puede actualizarse, pero eso no toca la matriz.
            permisos_creados: set[str] = set()
            permisos_actualizados = 0
            permiso_objs = {}

            for codigo, nombre in PERMISOS_CATALOGO:
                obj, created = PermisoModel.objects.update_or_create(
                    codigo=codigo,
                    defaults={"nombre": nombre},
                )
                permiso_objs[codigo] = obj
                if created:
                    permisos_creados.add(codigo)
                else:
                    permisos_actualizados += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"Permisos procesados: {len(PERMISOS_CATALOGO)} "
                    f"({len(permisos_creados)} creados, {permisos_actualizados} actualizados)."
                )
            )

            # 2a. Roles nuevos: se crean una sola vez, con su conjunto inicial.
            repo_roles = RepoRolesORM()
            roles_creados: set[int] = set()
            for nombre, (descripcion, _codigos) in ROLES_NUEVOS.items():
                if not repo_roles.existe_nombre(nombre):
                    rol = repo_roles.crear(nombre, descripcion)
                    roles_creados.add(rol.identificador)
            self.stdout.write(f"Roles nuevos creados: {len(roles_creados)} de {len(ROLES_NUEVOS)}.")

            roles_retirados = self._retirar_permisos()

            # 2b. Matriz. Para un rol que YA existe solo se agregan los permisos
            #     NUEVOS del catálogo (los creados en esta corrida); la pantalla
            #     manda y un permiso retirado no se re-agrega. Un rol recién
            #     creado recibe su conjunto inicial completo.
            asignaciones_creadas = 0
            roles_existentes = {r.id: r.nombre_rol for r in RolEspejo.objects.all()}
            ids_por_nombre = {
                _normalizar_rol(nombre): rid for rid, nombre in roles_existentes.items()
            }

            # Las claves de ROL_ASIGNACIONES son "slots" historicos (1..9). El rol
            # real se resuelve por NOMBRE: en bases heredadas RECEPCIONISTA puede
            # tener otro ID, y usar el numero dejaba sus permisos sin aplicar.
            asignaciones: dict[int, tuple[list[str], bool]] = {}
            for rol_id, codigos in ROL_ASIGNACIONES.items():
                nombre = NOMBRES_ROL.get(rol_id)
                destino = ids_por_nombre.get(_normalizar_rol(nombre)) if nombre else None
                if destino is None:
                    continue
                # Si el ID real no coincide con el slot, sus vinculos previos
                # quedaron huerfanos: se aplica el conjunto completo.
                asignaciones[destino] = (list(codigos), destino != rol_id)
            for nombre, (_descripcion, codigos) in ROLES_NUEVOS.items():
                rol_id = ids_por_nombre.get(_normalizar_rol(nombre))
                if rol_id is not None:
                    asignaciones[rol_id] = (list(codigos), rol_id in roles_creados)
            # El ADMINISTRADOR conserva todo el catálogo salvo las exclusiones
            # explícitas (G12), incluidas las que se creen en esta corrida.
            rol_admin = ids_por_nombre.get("ADMINISTRADOR")
            if rol_admin is not None:
                asignaciones[rol_admin] = (
                    [
                        p[0] for p in PERMISOS_CATALOGO
                        if p[0] not in PERMISOS_EXCLUIDOS_ADMINISTRADOR
                    ],
                    False,
                )

            roles_modificados: set[int] = set()
            for rol_id, (codigos, aplicar_completo) in asignaciones.items():
                if rol_id not in roles_existentes:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Rol ID {rol_id} no existe en tabla user_rol. Omitiendo asignación."
                        )
                    )
                    continue

                nombre_rol = roles_existentes[rol_id]
                if rol_id in roles_creados or aplicar_completo:
                    a_agregar = set(codigos)
                else:
                    a_agregar = set(codigos) & permisos_creados
                if rol_id == 1:
                    a_agregar -= PERMISOS_EXCLUIDOS_ADMINISTRADOR

                antes = self._codigos_del_rol(rol_id)
                nuevas_del_rol = 0
                for codigo in sorted(a_agregar):
                    permiso_obj = permiso_objs.get(codigo)
                    if not permiso_obj:
                        continue
                    _, created = RolPermisoModel.objects.get_or_create(
                        rol_id=rol_id,
                        permiso=permiso_obj,
                    )
                    if created:
                        asignaciones_creadas += 1
                        nuevas_del_rol += 1

                despues = self._codigos_del_rol(rol_id)
                if antes != despues:
                    roles_modificados.add(rol_id)
                    self._auditar_matriz(rol_id, nombre_rol, antes, despues)

                self.stdout.write(
                    f" - Rol '{nombre_rol}' (ID {rol_id}): {len(despues)} permisos vinculados."
                )

            # 3. Retiros explícitos por código (G12 y ajustes nombrados).
            for nombre, codigos in ASIGNACIONES_RETIRADAS.items():
                rol_id = ids_por_nombre.get(_normalizar_rol(nombre))
                if rol_id is None:
                    continue
                antes = self._codigos_del_rol(rol_id)
                RolPermisoModel.objects.filter(
                    rol_id=rol_id, permiso__codigo__in=codigos
                ).delete()
                despues = self._codigos_del_rol(rol_id)
                if antes != despues:
                    roles_modificados.add(rol_id)
                    self._auditar_matriz(rol_id, nombre, antes, despues)
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Asignaciones retiradas de {nombre}: {len(antes - despues)}."
                        )
                    )

            roles_modificados |= set(roles_retirados)
            if roles_modificados and not options["no_invalidar_sesiones"]:
                repo_version = RepoPermisosVersionORM()
                cuentas = sum(repo_version.incrementar_por_rol(rid) for rid in sorted(roles_modificados))
                self.stdout.write(f"Sesiones invalidadas por cambio de matriz: {cuentas} cuentas.")

            self.stdout.write(
                self.style.SUCCESS(
                    f"Matriz rol-permiso actualizada. Total nuevas asignaciones: {asignaciones_creadas}."
                )
            )

    @staticmethod
    def _codigos_del_rol(rol_id: int) -> set[str]:
        return set(
            RolPermisoModel.objects.filter(rol_id=rol_id).values_list(
                "permiso__codigo", flat=True
            )
        )

    def _auditar_matriz(self, rol_id: int, nombre_rol: str, antes: set[str], despues: set[str]) -> None:
        registrar_auditoria(
            trace_id=uuid.uuid4().hex,
            actor_id=None,
            actor_cedula=self.ACTOR_SEED,
            actor_rol="SISTEMA",
            accion=self.ACCION_SEED,
            modulo="identidad",
            recurso_tipo="Rol",
            recurso_id=str(rol_id),
            estado_previo={"rol": nombre_rol, "permisos": sorted(antes)},
            estado_nuevo={"rol": nombre_rol, "permisos": sorted(despues)},
        )

    def _retirar_permisos(self) -> list[int]:
        """Retira permisos obsoletos (PERMISOS_RETIRADOS) y audita la matriz afectada."""
        roles_afectados: set[int] = set()
        for codigo in PERMISOS_RETIRADOS:
            permiso = PermisoModel.objects.filter(codigo=codigo).first()
            if permiso is None:
                continue
            if UsuarioPermisoModel.objects.filter(permisos_custom__icontains=codigo).exists():
                self.stdout.write(
                    self.style.WARNING(
                        f"Permiso {codigo} conservado: hay excepciones de usuario que lo citan."
                    )
                )
                continue
            roles = list(
                RolPermisoModel.objects.filter(permiso=permiso).values_list("rol_id", flat=True)
            )
            antes_por_rol = {rol_id: self._codigos_del_rol(rol_id) for rol_id in roles}
            RolPermisoModel.objects.filter(permiso=permiso).delete()
            permiso.delete()
            for rol_id in roles:
                despues = self._codigos_del_rol(rol_id)
                self._auditar_matriz(
                    rol_id, f"ROL_{rol_id}", antes_por_rol[rol_id], despues
                )
                roles_afectados.add(rol_id)
            self.stdout.write(self.style.SUCCESS(f"Permiso obsoleto retirado: {codigo}."))
        return sorted(roles_afectados)
