"""Implementación ORM del puerto `RepoVersionesImagenCintillo` (Regla D-09)."""
from django.db import transaction

from apps.configuracion.domain.entities.version_imagen_cintillo import VersionImagenCintillo
from apps.configuracion.infrastructure.models.version_imagen_cintillo_model import VersionImagenCintilloModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel


def _nombres(cedulas) -> dict[str, str]:
    cedulas = {c for c in cedulas if c}
    if not cedulas:
        return {}
    filas = EmployeeModel.objects.filter(cedulaidentidad__in=cedulas).values('cedulaidentidad', 'nombres', 'apellidos')
    return {f['cedulaidentidad']: f"{f['nombres']} {f['apellidos']}".strip() for f in filas}


def _a_entidad(fila, nombres: dict[str, str]) -> VersionImagenCintillo:
    return VersionImagenCintillo(
        id=str(fila.pk),
        campo=fila.campo,
        clave=fila.clave,
        mime=fila.mime,
        tamano=fila.tamano,
        subido_en=fila.created_at.isoformat(),
        subido_por_id=fila.subido_por_id,
        subido_por_cedula=fila.subido_por_cedula,
        subido_por_nombre=nombres.get(fila.subido_por_cedula, ''),
        es_vigente=fila.es_vigente,
    )


class RepoVersionesImagenCintilloORM:
    @transaction.atomic
    def registrar(self, campo, clave, mime, tamano, usuario_id, usuario_cedula, maximo):
        # Serializa las subidas concurrentes del mismo campo.
        list(VersionImagenCintilloModel.objects.select_for_update().filter(campo=campo).values_list('pk', flat=True))
        VersionImagenCintilloModel.objects.filter(campo=campo, es_vigente=True).update(es_vigente=False)
        nueva = VersionImagenCintilloModel.objects.create(
            campo=campo, clave=clave, mime=mime, tamano=tamano,
            subido_por_id=usuario_id, subido_por_cedula=usuario_cedula or '', es_vigente=True,
        )
        # Las que sobran son las más viejas no vigentes (la nueva es la vigente y nunca se poda).
        sobrantes = list(
            VersionImagenCintilloModel.objects.filter(campo=campo, es_vigente=False)
            .order_by('-created_at')[max(maximo - 1, 0):]
        )
        descartadas = [s.clave for s in sobrantes]
        if sobrantes:
            VersionImagenCintilloModel.objects.filter(pk__in=[s.pk for s in sobrantes]).delete()
        # Si otra versión (o la configuración) aún usa la clave, su archivo no se borra.
        en_uso = set(VersionImagenCintilloModel.objects.filter(clave__in=descartadas).values_list('clave', flat=True))
        descartadas = [c for c in descartadas if c not in en_uso]
        return _a_entidad(nueva, _nombres([usuario_cedula])), descartadas

    def listar(self, campo):
        filas = list(VersionImagenCintilloModel.objects.filter(campo=campo).order_by('-created_at'))
        nombres = _nombres(f.subido_por_cedula for f in filas)
        return [_a_entidad(f, nombres) for f in filas]

    def obtener(self, version_id):
        try:
            fila = VersionImagenCintilloModel.objects.filter(pk=version_id).first()
        except (ValueError, TypeError):
            return None
        if fila is None:
            return None
        return _a_entidad(fila, _nombres([fila.subido_por_cedula]))

    @transaction.atomic
    def marcar_vigente(self, version_id):
        fila = VersionImagenCintilloModel.objects.select_for_update().get(pk=version_id)
        VersionImagenCintilloModel.objects.filter(campo=fila.campo, es_vigente=True).update(es_vigente=False)
        fila.es_vigente = True
        fila.save(update_fields=['es_vigente', 'updated_at'])
        return _a_entidad(fila, _nombres([fila.subido_por_cedula]))
