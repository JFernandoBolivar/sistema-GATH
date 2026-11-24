"""Repositorios ORM de plantillas y documentos generados (F-1)."""
from django.db import IntegrityError, transaction

from apps.documentos.application.use_cases.gestionar_plantillas import huella_borrador
from apps.documentos.domain.entities.documentos import (
    DocumentoGenerado,
    FirmaDocumento,
    Plantilla,
    ValoresDocumento,
    VersionPlantilla,
)
from apps.documentos.infrastructure.models.documentos_models import (
    DocumentoGeneradoModel,
    FirmaDocumentoModel,
    PlantillaDocumentoModel,
    ValoresDocumentoModel,
    VersionPlantillaDocumentoModel,
)
from core.domain.exceptions import ConflictError, NotFoundError

_CAMPOS_BORRADOR = ('codigo', 'nombre', 'descripcion', 'momento', 'firmante', 'requiere_firma_clic', 'definicion',
                    'campos_propios', 'fondo_clave', 'fondo_sha256', 'fondo_nombre', 'fondo_paginas')


def _version(m: VersionPlantillaDocumentoModel) -> VersionPlantilla:
    return VersionPlantilla(
        id=str(m.id), plantilla_id=str(m.plantilla_id), numero=m.numero, modo=m.modo, definicion=m.definicion,
        campos_propios=m.campos_propios, fondo_clave=m.fondo_clave, fondo_sha256=m.fondo_sha256,
        fondo_paginas=m.fondo_paginas, metadatos=m.metadatos, definicion_sha256=m.definicion_sha256,
        publicada_por_id=m.publicada_por_id, publicada_en=m.publicada_en,
    )


def _plantilla(m: PlantillaDocumentoModel, huella_ultima: str | None) -> Plantilla:
    p = Plantilla(
        id=str(m.id), codigo=m.codigo, nombre=m.nombre, descripcion=m.descripcion, modo=m.modo, momento=m.momento,
        firmante=m.firmante, requiere_firma_clic=m.requiere_firma_clic, activa=m.activa,
        estado='publicada' if m.ultima_version else 'borrador', ultima_version=m.ultima_version,
        definicion=m.definicion, campos_propios=m.campos_propios, fondo_clave=m.fondo_clave,
        fondo_sha256=m.fondo_sha256, fondo_nombre=m.fondo_nombre, fondo_paginas=m.fondo_paginas,
        actualizada_en=m.updated_at,
    )
    p.cambios_sin_publicar = bool(m.ultima_version) and huella_borrador(p) != huella_ultima
    return p


class RepoPlantillasORM:
    def _huella_ultima(self, m: PlantillaDocumentoModel) -> str | None:
        if not m.ultima_version:
            return None
        return (VersionPlantillaDocumentoModel.objects.filter(plantilla=m, numero=m.ultima_version)
                .values_list('definicion_sha256', flat=True).first())

    def _a_entidad(self, m: PlantillaDocumentoModel) -> Plantilla:
        return _plantilla(m, self._huella_ultima(m))

    def listar(self) -> list[Plantilla]:
        return [self._a_entidad(m) for m in PlantillaDocumentoModel.objects.all()]

    def obtener(self, plantilla_id: str) -> Plantilla | None:
        try:
            m = PlantillaDocumentoModel.objects.filter(pk=plantilla_id).first()
        except (ValueError, TypeError):
            return None
        return self._a_entidad(m) if m else None

    def obtener_por_codigo(self, codigo: str) -> Plantilla | None:
        m = PlantillaDocumentoModel.objects.filter(codigo=codigo).first()
        return self._a_entidad(m) if m else None

    def crear(self, datos: dict) -> Plantilla:
        campos = {k: datos[k] for k in (*_CAMPOS_BORRADOR, 'modo') if k in datos}
        try:
            with transaction.atomic():
                m = PlantillaDocumentoModel.objects.create(
                    **campos, creado_por_id=datos.get('actor_id'), actualizado_por_id=datos.get('actor_id'))
        except IntegrityError as exc:
            raise ConflictError(f"Ya existe una plantilla con el código «{datos['codigo']}».", campo='codigo') from exc
        return self._a_entidad(m)

    def actualizar_borrador(self, plantilla_id: str, datos: dict) -> Plantilla:
        with transaction.atomic():
            m = PlantillaDocumentoModel.objects.select_for_update().filter(pk=plantilla_id).first()
            if m is None:
                raise NotFoundError('La plantilla no existe.')
            for k in _CAMPOS_BORRADOR:
                if k in datos:
                    setattr(m, k, datos[k])
            m.actualizado_por_id = datos.get('actor_id')
            m.save()
        return self._a_entidad(m)

    def publicar(self, plantilla_id: str, actor_id: int | None) -> VersionPlantilla:
        with transaction.atomic():
            m = PlantillaDocumentoModel.objects.select_for_update().get(pk=plantilla_id)
            p = _plantilla(m, None)
            v = VersionPlantillaDocumentoModel.objects.create(
                plantilla=m, numero=m.ultima_version + 1, modo=m.modo, definicion=m.definicion,
                campos_propios=m.campos_propios, fondo_clave=m.fondo_clave, fondo_sha256=m.fondo_sha256,
                fondo_paginas=m.fondo_paginas,
                metadatos={'codigo': m.codigo, 'nombre': m.nombre, 'momento': m.momento, 'firmante': m.firmante,
                           'requiere_firma_clic': m.requiere_firma_clic},
                definicion_sha256=huella_borrador(p), publicada_por_id=actor_id)
            m.ultima_version = v.numero
            m.save(update_fields=['ultima_version', 'updated_at'])
        return _version(v)

    def fijar_activa(self, plantilla_id: str, activa: bool) -> Plantilla:
        m = PlantillaDocumentoModel.objects.filter(pk=plantilla_id).first()
        if m is None:
            raise NotFoundError('La plantilla no existe.')
        m.activa = activa
        m.save(update_fields=['activa', 'updated_at'])
        return self._a_entidad(m)

    def versiones(self, plantilla_id: str) -> list[VersionPlantilla]:
        return [_version(v) for v in VersionPlantillaDocumentoModel.objects.filter(plantilla_id=plantilla_id)]

    def obtener_version(self, plantilla_id: str, numero: int) -> VersionPlantilla | None:
        v = VersionPlantillaDocumentoModel.objects.filter(plantilla_id=plantilla_id, numero=numero).first()
        return _version(v) if v else None

    def ultima_version(self, plantilla_id: str) -> VersionPlantilla | None:
        v = VersionPlantillaDocumentoModel.objects.filter(plantilla_id=plantilla_id).order_by('-numero').first()
        return _version(v) if v else None


def _generado(m: DocumentoGeneradoModel) -> DocumentoGenerado:
    return DocumentoGenerado(
        id=str(m.id), plantilla_id=str(m.plantilla_id), version_id=str(m.version_id), version_numero=m.version.numero,
        sujeto_tipo=m.sujeto_tipo, sujeto_id=m.sujeto_id, datos_snapshot=m.datos_snapshot, pdf_clave=m.pdf_clave,
        pdf_sha256=m.pdf_sha256, generado_por_id=m.generado_por_id, generado_en=m.created_at,
        huella_datos=m.huella_datos, trabajador_cedula=m.trabajador_cedula)


def _firma(m: FirmaDocumentoModel) -> FirmaDocumento:
    return FirmaDocumento(
        id=str(m.id), documento_id=str(m.documento_id), firmante_tipo=m.firmante_tipo, firmante_id=m.firmante_id,
        firmado_en=m.firmado_en, ip=m.ip, user_agent=m.user_agent, sha256_firmado=m.sha256_firmado,
        texto_conformidad=m.texto_conformidad)


class RepoDocumentosORM:
    def guardar_generado(self, datos: dict) -> DocumentoGenerado:
        m = DocumentoGeneradoModel.objects.create(**datos)
        return _generado(DocumentoGeneradoModel.objects.select_related('version').get(pk=m.pk))

    def obtener_generado(self, documento_id: str) -> DocumentoGenerado | None:
        try:
            m = DocumentoGeneradoModel.objects.select_related('version').filter(pk=documento_id).first()
        except (ValueError, TypeError):
            return None
        return _generado(m) if m else None

    def listar_generados(self, sujeto_tipo: str, sujeto_id: str) -> list[DocumentoGenerado]:
        qs = DocumentoGeneradoModel.objects.select_related('version').filter(sujeto_tipo=sujeto_tipo, sujeto_id=sujeto_id)
        return [_generado(m) for m in qs]

    def guardar_firma(self, datos: dict) -> FirmaDocumento:
        try:
            with transaction.atomic():
                return _firma(FirmaDocumentoModel.objects.create(**datos))
        except IntegrityError as exc:
            raise ConflictError('Este firmante ya firmó el documento.') from exc

    def firmas_de(self, documento_id: str) -> list[FirmaDocumento]:
        return [_firma(f) for f in FirmaDocumentoModel.objects.filter(documento_id=documento_id)]

    def vincular_trabajador(self, sujeto_tipo: str, sujeto_id: str, cedula: str) -> int:
        """Deja en cada documento del sujeto aún sin vincular la cédula del trabajador (id opaco, sin FK)."""
        return DocumentoGeneradoModel.objects.filter(
            sujeto_tipo=sujeto_tipo, sujeto_id=str(sujeto_id), trabajador_cedula='').update(trabajador_cedula=cedula)

    def documentos_de_trabajador(self, cedula: str) -> list[DocumentoGenerado]:
        qs = DocumentoGeneradoModel.objects.select_related('version').filter(trabajador_cedula=cedula)
        return [_generado(m) for m in qs]

    def guardar_valores(self, sujeto_tipo: str, sujeto_id: str, plantilla_id: str, valores: dict) -> ValoresDocumento:
        m, _ = ValoresDocumentoModel.objects.update_or_create(
            plantilla_id=plantilla_id, sujeto_tipo=sujeto_tipo, sujeto_id=str(sujeto_id), defaults={'valores': valores})
        return ValoresDocumento(sujeto_tipo, str(sujeto_id), str(m.plantilla_id), m.valores)

    def valores_de(self, sujeto_tipo: str, sujeto_id: str) -> dict[str, dict]:
        """`{plantilla_id: {clave: valor}}` de todo lo que el sujeto llenó."""
        qs = ValoresDocumentoModel.objects.filter(sujeto_tipo=sujeto_tipo, sujeto_id=str(sujeto_id))
        return {str(m.plantilla_id): m.valores for m in qs}
