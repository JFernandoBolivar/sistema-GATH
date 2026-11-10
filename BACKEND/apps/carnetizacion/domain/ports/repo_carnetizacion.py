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

    def crear_plantilla(self, nombre: str, imagen: object, activar: bool = False) -> PlantillaCarnet:
        """Compatibilidad con subida legacy de imagen de fondo."""
        ...

    def ruta_imagen_plantilla(self, plantilla_id: int | str) -> str:
        """Ruta local de la imagen de la plantilla legacy; NotFoundError si no existe."""
        ...

    # --- Carnets Emitidos ---
    def listar_carnets(self, empleado_cedula: str | None = None) -> list[Carnet]:
        ...

    def obtener_por_hash(self, security_hash: str) -> Carnet | None:
        ...

    def obtener_por_id(self, carnet_id: int) -> Carnet | None:
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

    def generar_pdf(self, carnet_id: int) -> bytes:
        ...

    def obtener_estadisticas_carnets(self) -> dict[str, Any]:
        ...

    # --- Biblioteca de Medios (O44 - E4) ---
    def listar_elementos_biblioteca(self, categoria: str | None = None) -> list[ElementoBiblioteca]:
        """Obtiene la lista de logos, firmas e imágenes institucionales."""
        ...

    def obtener_elemento_biblioteca(self, elemento_id: str | int) -> ElementoBiblioteca:
        """Obtiene un recurso de la biblioteca por su identificador."""
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
    ) -> CampoCredencial:
        """Registra un nuevo campo personalizado para usar en las credenciales."""
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
