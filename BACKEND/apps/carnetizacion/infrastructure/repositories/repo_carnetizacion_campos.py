"""Repositorio de carnetizaciÃ³n: campos."""
from django.db.models import Q

from core.domain.exceptions import NotFoundError, ValidationError
from apps.carnetizacion.domain.entities.campo_credencial import (
    CAMPOS_AUTORIZADOS_EXPEDIENTE,
    CampoCredencial,
)
from apps.carnetizacion.infrastructure.mappers.mapper_carnetizacion import (
    campo_personalizado_a_entidad,
)
from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
    CampoPersonalizadoModel,
)

# Import entre módulos en infrastructure (apps.cargos y apps.personal): mismo patrón ya
# establecido en `apps.reportes`/`apps.autogestion`/`apps.pasivos`.




class RepoCamposCredencialMixin:
    def listar_campos_credencial(self, tipo_credencial: str = "trabajador") -> list[CampoCredencial]:
        """Obtiene la lista de campos autorizados del expediente y personalizados para el tipo dado."""
        nativos = [
            c for c in CAMPOS_AUTORIZADOS_EXPEDIENTE
            if c.tipo_credencial in ("todos", tipo_credencial)
        ]
        personalizados_qs = CampoPersonalizadoModel.objects.filter(
            Q(tipo_credencial="todos") | Q(tipo_credencial=tipo_credencial)
        )
        personalizados = [campo_personalizado_a_entidad(p) for p in personalizados_qs]
        return nativos + personalizados

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
        """Registra un nuevo campo personalizado para credenciales."""
        if CampoPersonalizadoModel.objects.filter(codigo=codigo).exists():
            raise ValidationError(f"Ya existe un campo con el código '{codigo}'")

        obj = CampoPersonalizadoModel.objects.create(
            codigo=codigo,
            etiqueta=etiqueta,
            grupo=grupo,
            tipo_credencial=tipo_credencial,
            sensible=sensible,
            descripcion=descripcion,
            valor_ejemplo=valor_ejemplo,
            origen=origen,
        )
        return campo_personalizado_a_entidad(obj)

    def actualizar_campo_personalizado(
        self,
        codigo: str,
        etiqueta: str,
        origen: str,
        descripcion: str = "",
        valor_ejemplo: str = "",
        sensible: bool = False,
    ) -> CampoCredencial:
        """Edita etiqueta, origen del dato, descripción, ejemplo y sensibilidad de un campo personalizado."""
        obj = CampoPersonalizadoModel.objects.filter(codigo=codigo).first()
        if not obj:
            raise NotFoundError(f"Campo personalizado '{codigo}' no encontrado")
        obj.etiqueta = etiqueta
        obj.origen = origen
        obj.descripcion = descripcion
        obj.valor_ejemplo = valor_ejemplo
        obj.sensible = sensible
        obj.save(update_fields=['etiqueta', 'origen', 'descripcion', 'valor_ejemplo', 'sensible', 'updated_at'])
        return campo_personalizado_a_entidad(obj)

    def eliminar_campo_personalizado(self, codigo: str) -> bool:
        """Elimina un campo personalizado registrado."""
        obj = CampoPersonalizadoModel.objects.filter(codigo=codigo).first()
        if not obj:
            raise NotFoundError(f"Campo personalizado '{codigo}' no encontrado")
        obj.delete()
        return True
