"""
Puerto del Repositorio de Carnetización (Reglas B1, B21, O44 - E3).
"""
from typing import Any, Protocol

from apps.carnetizacion.domain.entities.campo_credencial import CampoCredencial
from apps.carnetizacion.domain.entities.carnet import Carnet
from apps.carnetizacion.domain.entities.elemento_biblioteca import ElementoBiblioteca
from apps.carnetizacion.domain.entities.plantilla import PlantillaCarnet
from apps.carnetizacion.domain.entities.privacidad import FichaQr
from apps.carnetizacion.domain.entities.tipo_credencial import TipoCredencial
from apps.carnetizacion.domain.entities.verificacion_integracion import VerificacionCarnet


class RepoCarnetizacion(Protocol):
    # --- Tipos de Credencial (Catálogo) ---
    def listar_tipos_credencial(
        self, solo_activos: bool = True, grupo: str | None = None
    ) -> list[TipoCredencial]:
        """Lista los tipos de credencial registrados, opcionalmente por grupo."""
        ...

    def obtener_tipo_credencial(self, codigo: str) -> TipoCredencial | None:
        """Obtiene un tipo de credencial por su código slug."""
        ...

    # --- Plantillas de Carnet (Motor por capas en mm, dos caras, versiones) ---
    def listar_plantillas(
        self,
        codigo_tipo: str | None = None,
        estado: str | None = None,
        solo_activas: bool = False,
    ) -> list[PlantillaCarnet]:
        """Lista las plantillas disponibles."""
        ...

    def listar_plantillas_paginado(
        self,
        codigo_tipo: str | None = None,
        estado: str | None = None,
        solo_activas: bool = False,
        busqueda: str = "",
        offset: int = 0,
        limite: int = 12,
    ) -> tuple[list[PlantillaCarnet], int]:
        """Una página de plantillas del motor y el total que cumple los filtros."""
        ...

    def obtener_plantilla(self, plantilla_id: str | int) -> PlantillaCarnet | None:
        """Obtiene una plantilla específica por su ID."""
        ...

    def obtener_plantilla_activa(
        self,
        codigo_tipo: str = "trabajador",
        regla_criterio: str = "todos",
        regla_valor: str = "*",
    ) -> PlantillaCarnet | None:
        """Obtiene la plantilla actualmente activa que coincida con tipo y regla."""
        ...

    def crear_plantilla_borrador(
        self,
        nombre: str,
        codigo_tipo: str,
        definicion: dict[str, Any],
        ancho_mm: float = 54.0,
        alto_mm: float = 85.6,
        orientacion: str = "vertical",
        regla_criterio: str = "todos",
        regla_valor: str = "*",
        descripcion: str = "",
        creado_por: str | None = None,
        plantilla_raiz_id: str | None = None,
    ) -> PlantillaCarnet:
        """Crea una nueva plantilla en estado borrador."""
        ...

    def actualizar_borrador(
        self,
        plantilla_id: str | int,
        nombre: str | None = None,
        definicion: dict[str, Any] | None = None,
        ancho_mm: float | None = None,
        alto_mm: float | None = None,
        orientacion: str | None = None,
        regla_criterio: str | None = None,
        regla_valor: str | None = None,
        descripcion: str | None = None,
    ) -> PlantillaCarnet:
        """Actualiza una plantilla en estado borrador."""
        ...

    def publicar_plantilla(
        self,
        plantilla_id: str | int,
        activar: bool = True,
        publicado_por: str | None = None,
    ) -> PlantillaCarnet:
        """
        Publica una plantilla, generando una versión inmutable e incrementando el versionado.
        Si activar=True, desactiva cualquier otra plantilla activa del mismo tipo y regla.
        """
        ...

    def activar_plantilla(self, plantilla_id: str | int) -> PlantillaCarnet:
        """
        Activa o reactiva una versión publicada específica.
        Garantiza la regla: solo una activa por tipo de credencial y regla.
        """
        ...

    def listar_versiones_plantilla(self, plantilla_raiz_id: str | int) -> list[PlantillaCarnet]:
        """Obtiene el historial cronológico de versiones de una plantilla."""
        ...

    def eliminar_plantilla(self, plantilla_id: str | int) -> None:
        """Elimina una plantilla no activa (la activa está protegida)."""
        ...

    # --- Carnets Emitidos ---
    def listar_carnets(self, empleado_cedula: str | None = None) -> list[Carnet]:
        ...

    def obtener_por_hash(self, security_hash: str) -> Carnet | None:
        ...

    def obtener_por_id(self, carnet_id: int) -> Carnet | None:
        ...

    def obtener_carnet_vigente(self, empleado_cedula: str) -> Carnet | None:
        """Carnet activo (vigente) del empleado, o None si no tiene."""
        ...

    def motivo_id_para_reemision(self, motivo_reemision: str) -> int | None:
        """Id del catálogo `MotivosEmision` que corresponde al motivo de reemisión."""
        ...

    def sugerencias_reglas_color(self) -> dict[str, list[str]]:
        """Cargos y oficinas reales del último cargo activo de cada titular."""
        ...

    def emitir_carnet(
        self,
        empleado_cedula: str,
        motivo_id: int,
        observaciones: str | None = None,
        plantilla_id: str | int | None = None,
    ) -> Carnet:
        ...

    def revocar_carnet(self, carnet_id: int) -> Carnet:
        ...

    def empleado_existe(self, cedula: str) -> bool:
        ...

    def registrar_foto_perfil(self, cedula: str, clave: str) -> None:
        ...

    def generar_pdf(self, carnet_id: int, nombre_override: str | None = None, imprenta: bool = False) -> bytes:
        ...

    def listar_motivos_emision(self) -> list[dict[str, Any]]:
        """Motivos de emisión activos, ya listos para el formulario de carnet."""
        ...

    def obtener_estadisticas_carnets(self) -> dict[str, Any]:
        ...

    # --- Biblioteca de Medios (O44 - E4) ---
    def listar_elementos_biblioteca(self, categoria: str | None = None) -> list[ElementoBiblioteca]:
        """Obtiene la lista de logos, firmas e imágenes institucionales."""
        ...

    def listar_elementos_biblioteca_paginado(
        self,
        categoria: str | None = None,
        busqueda: str = "",
        offset: int = 0,
        limite: int = 12,
    ) -> tuple[list[ElementoBiblioteca], int]:
        """Una página de recursos de la biblioteca y el total que cumple los filtros."""
        ...

    def obtener_elemento_biblioteca(self, elemento_id: str | int) -> ElementoBiblioteca:
        """Obtiene un recurso de la biblioteca por su identificador."""
        ...

    def buscar_elemento_biblioteca_por_contenido(
        self, contenido: bytes
    ) -> ElementoBiblioteca | None:
        """Busca un recurso ya guardado cuyo archivo tenga exactamente ese contenido."""
        ...

    def guardar_elemento_biblioteca(
        self,
        nombre: str,
        categoria: str,
        contenido: bytes,
        nombre_archivo: str,
        creado_por: str | None = None,
        descripcion: str = "",
    ) -> ElementoBiblioteca:
        """Valida y guarda un recurso multimedia en la biblioteca compartida."""
        ...

    def eliminar_elemento_biblioteca(self, elemento_id: str | int) -> bool:
        """Elimina un recurso de la biblioteca multimedia."""
        ...

    # --- Registro de Campos Autorizados y Personalizados (O44 - E5) ---
    def listar_campos_credencial(self, tipo_credencial: str = "trabajador") -> list[CampoCredencial]:
        """Obtiene la lista de campos autorizados del expediente y personalizados para el tipo dado."""
        ...

    def crear_campo_personalizado(
        self,
        codigo: str,
        etiqueta: str,
        grupo: str = "personalizado",
        tipo_credencial: str = "todos",
        sensible: bool = False,
        descripcion: str = "",
        valor_ejemplo: str = "",
        origen: str = "",
    ) -> CampoCredencial:
        """Registra un nuevo campo personalizado para usar en las credenciales."""
        ...

    def actualizar_campo_personalizado(
        self,
        codigo: str,
        etiqueta: str,
        origen: str,
        descripcion: str = "",
        valor_ejemplo: str = "",
        sensible: bool = False,
    ) -> CampoCredencial:
        """Edita un campo personalizado existente (el código no cambia)."""
        ...

    def eliminar_campo_personalizado(self, codigo: str) -> bool:
        """Elimina un campo personalizado registrado."""
        ...

    # --- QR y Privacidad por Dato (O44 - E9) ---
    def consultar_ficha_qr(
        self,
        security_hash: str,
        usuario_sesion: Any | None = None,
        ip: str = "",
        user_agent: str = "",
        accion: str = "ESCANEO",
    ) -> FichaQr:
        """
        Consulta la ficha institucional de un carnet a través del código QR aleatorio.
        Aplica los filtros de privacidad por dato y el nivel de acceso (público, con sesión, administrador).
        Registra la bitácora de escaneos y aperturas médicas.
        """
        ...

    def verificar_carnet_integracion(self, security_hash: str) -> VerificacionCarnet:
        """Resuelve un hash (carnet de personal o credencial externa) para un sistema integrado, sin privacidad por dato ni salud."""
        ...

    def obtener_preferencia_privacidad(self, employee_id: int) -> dict[str, str]:
        """Obtiene la configuración de privacidad por dato del trabajador."""
        ...

    def guardar_preferencia_privacidad(
        self,
        employee_id: int,
        preferencias: dict[str, str],
    ) -> dict[str, str]:
        """Actualiza la configuración de privacidad por dato del trabajador."""
        ...

    def obtener_privacidad_por_cedula(self, cedula: str) -> dict[str, str]:
        """Obtiene las preferencias de visibilidad a partir de la cédula del titular."""
        ...

    def guardar_privacidad_por_cedula(
        self,
        cedula: str,
        preferencias: dict[str, str],
    ) -> dict[str, str]:
        """Guarda las preferencias de visibilidad a partir de la cédula del titular."""
        ...

    def anular_carnet_por_egreso(
        self,
        employee_id: int,
        motivo: str = "Egreso de la institución",
    ) -> int:
        """Anula automáticamente cualquier carnet activo tras el egreso de un trabajador."""
        ...

    # --- Solicitudes de carnet (Autogestión → bandeja de RRHH) ---

    def crear_solicitud_carnet(self, cedula: str, motivo_id: int, justificacion: str = '') -> dict:
        """Registra la solicitud del trabajador (una pendiente a la vez)."""
        ...

    def ultima_solicitud_carnet(self, cedula: str) -> dict | None:
        ...

    def cancelar_solicitud_carnet(self, cedula: str, solicitud_id: str) -> dict:
        ...

    def listar_solicitudes_carnet(self, estado: str | None = None) -> list[dict]:
        ...

    def exigir_solicitud_pendiente(self, solicitud_id: str, cedula: str) -> None:
        ...

    def aprobar_solicitud_carnet(
        self, solicitud_id: str, cedula: str, carnet_id: int, resuelta_por: str,
    ) -> dict:
        ...

    def rechazar_solicitud_carnet(self, solicitud_id: str, motivo: str, resuelta_por: str) -> dict:
        ...

    # --- Vista previa con las dos caras (B-1) ---

    def generar_vista_previa_caras(
        self, cedula: str, nombre_override: str | None = None, foto_bytes: bytes | None = None,
    ) -> dict:
        """{'anverso', 'reverso'} en PNG (data URL) del carnet que se emitiría para el titular."""
        ...

    def vista_previa_plantilla(
        self, plantilla_id: str, definicion: dict | None = None, cedula: str | None = None,
    ) -> dict:
        """{'anverso', 'reverso'} de una plantilla (también borrador o con cambios sin guardar)."""
        ...

    # --- PDF tal como se emitió (B-4) ---

    def guardar_pdf_emitido(self, carnet_id: int, pdf: bytes, formato: str = 'normal') -> None:
        ...

    def pdf_emitido_guardado(self, carnet_id: int) -> bytes | None:
        """El PDF normal tal como se emitió (sha256 verificado), o None si no hay copia válida."""
        ...

    # --- Ciclo físico del carnet (B-5) ---

    def estado_fisico_carnet(self, carnet_id: int) -> dict:
        ...

    def estados_fisicos(self, carnet_ids: list[int]) -> dict[int, str]:
        ...

    def marcar_carnet_impreso(self, carnet_id: int, por: str) -> dict:
        ...

    def marcar_carnet_entregado(self, carnet_id: int, recibido_por: str, por: str) -> dict:
        ...

    def anular_carnet(self, carnet_id: int, motivo: str, por: str) -> dict:
        ...

    # --- Impresión por lote de carnets de trabajadores (B-6) ---

    def cola_impresion_carnets(self) -> list[dict]:
        ...

    def generar_pdf_lote_carnets(
        self, carnet_ids: list[int], marcar_impresos: bool = False, por: str = '',
        modo_duplex: str = 'ninguno',
    ) -> bytes:
        ...
