"""Piezas compartidas por los casos de uso de postulación. Sin Django."""
from datetime import datetime, timezone

from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.ports.repos import RepoPostulacion
from apps.postulacion.domain.services.efectos import Vigencias
from core.domain.configuracion import (
    CLAVE_CAPTACION_ESPERA_DIFERIDO_DIAS,
    CLAVE_CAPTACION_HORAS_ESCALAMIENTO_CONTACTO,
    CLAVE_CAPTACION_PSICOFISICO_OBLIGATORIO,
    CLAVE_CAPTACION_REINGRESO_PASIVO,
    CLAVE_CAPTACION_REQUIERE_DIRECCION_GENERAL,
    CLAVE_CAPTACION_REQUIERE_PRESUPUESTO,
    CLAVE_CAPTACION_VIGENCIA_RESERVA_PUESTO_DIAS,
    CLAVE_CAPTACION_VIGENCIA_VENTANA1_DIAS,
    CLAVE_CAPTACION_VIGENCIA_VENTANA2_DIAS,
    REINGRESO_PASIVO_MODOS,
    REINGRESO_PASIVO_PERMITIR,
)
from core.domain.exceptions import NotFoundError, ValidationError
from core.domain.ports import LectorConfiguracion


def ahora_utc() -> datetime:
    return datetime.now(timezone.utc)


def leer_vigencias(config: LectorConfiguracion) -> Vigencias:
    """Los días salen de los parámetros del sistema (C-3, C-4) por el puerto del kernel."""
    return Vigencias(
        ventana1_dias=config.obtener_entero(CLAVE_CAPTACION_VIGENCIA_VENTANA1_DIAS),
        ventana2_dias=config.obtener_entero(CLAVE_CAPTACION_VIGENCIA_VENTANA2_DIAS),
        reserva_puesto_dias=config.obtener_entero(CLAVE_CAPTACION_VIGENCIA_RESERVA_PUESTO_DIAS),
        espera_diferido_dias=config.obtener_entero(CLAVE_CAPTACION_ESPERA_DIFERIDO_DIAS),
    )


def leer_horas_escalamiento_contacto(config: LectorConfiguracion) -> int:
    """Horas (parámetro `captacion.horas_escalamiento_contacto`, 48 por defecto) tras las que un contacto pendiente se escala."""
    return max(1, config.obtener_entero(CLAVE_CAPTACION_HORAS_ESCALAMIENTO_CONTACTO) or 48)


def leer_psicofisico_obligatorio(config: LectorConfiguracion) -> bool:
    return config.obtener_booleano(CLAVE_CAPTACION_PSICOFISICO_OBLIGATORIO)


def leer_reingreso_pasivo(config: LectorConfiguracion) -> str:
    """Opción vigente de `captacion.reingreso_pasivo` (C-9); un valor desconocido cuenta como «permitir»."""
    valor = (config.obtener_texto(CLAVE_CAPTACION_REINGRESO_PASIVO) or '').strip()
    return valor if valor in REINGRESO_PASIVO_MODOS else REINGRESO_PASIVO_PERMITIR


def flujo_vigente(config: LectorConfiguracion) -> dict[str, bool | str]:
    """Copia (snapshot) del proceso de ingreso vigente, para guardarla en el expediente al abrirse (M-1): campos
    `requiere_presupuesto` y `requiere_direccion_general`; y (C-9) `reingreso_pasivo`. Después, cambiar los parámetros
    no altera ese expediente."""
    return {
        'reingreso_pasivo': leer_reingreso_pasivo(config),
        'requiere_presupuesto': config.obtener_booleano(CLAVE_CAPTACION_REQUIERE_PRESUPUESTO),
        'requiere_direccion_general': config.obtener_booleano(CLAVE_CAPTACION_REQUIERE_DIRECCION_GENERAL),
    }


def obtener_expediente(repo: RepoPostulacion, expediente_id: str, bloquear: bool = False) -> ExpedientePostulacion:
    exp = repo.obtener_expediente(expediente_id, bloquear=bloquear)
    if exp is None:
        raise NotFoundError("El expediente de postulación no existe.")
    return exp


def texto_normalizado(valor: str | None, etiqueta: str, *, maximo: int, obligatorio: bool = True) -> str:
    """Colapsa espacios y valida obligatoriedad y largo máximo."""
    valor = ' '.join((valor or '').split())
    if obligatorio and not valor:
        raise ValidationError(f"{etiqueta} es obligatorio.")
    if len(valor) > maximo:
        raise ValidationError(f"{etiqueta} admite como máximo {maximo} caracteres.")
    return valor
