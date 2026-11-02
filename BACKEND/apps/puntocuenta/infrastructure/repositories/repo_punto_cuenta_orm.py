"""Implementación ORM del puerto `RepoPuntoCuenta` (Regla D-09)."""
from apps.puntocuenta.infrastructure.mappers.mapper_punto_cuenta import a_entidad
from apps.puntocuenta.infrastructure.models.punto_cuenta_model import PuntoCuentaModel


class RepoPuntoCuentaORM:
    def crear(
        self,
        *,
        cargo_id,
        cedula,
        dependencia_origen_id,
        dependencia_destino_id,
        motivo_id,
        usuario_id,
    ):
        fila = PuntoCuentaModel.objects.create(
            cargo_id=cargo_id,
            empleado_cedula=cedula,
            dependencia_origen_id=dependencia_origen_id,
            dependencia_destino_id=dependencia_destino_id,
            motivo_id=motivo_id,
            usuario_id=usuario_id,
        )
        return a_entidad(fila)

    def adjuntar_documento(self, id, clave):
        fila = PuntoCuentaModel.objects.get(pk=id)
        fila.documento_pdf_clave = clave
        fila.save(update_fields=['documento_pdf_clave', 'updated_at'])
        return a_entidad(fila)

    def listar(self):
        return [a_entidad(f) for f in PuntoCuentaModel.objects.all()]

    def obtener_por_id(self, id):
        fila = PuntoCuentaModel.objects.filter(pk=id).first()
        return a_entidad(fila) if fila else None
