"""
C20: alta de pensionados por sobrevivencia como personal pasivo.

Réplica funcional de `ejecutar_creacion_sobrevivientes` del legado
(`RAC/services/egreso_services.py`, no presente en el repositorio; ver
supuestos en el repo ORM). NO crea cuenta de usuario: la cuenta AUTOGESTION se
crea después, cuando RRHH carga el correo (C7/C16).
"""
from apps.pasivos.application.dtos.pasivos_dtos import CrearSobrevivientesDTO
from apps.pasivos.domain.entities.sobreviviente import ResultadoAltaSobreviviente
from apps.pasivos.domain.ports.repo_sobrevivientes import RepoSobrevivientes
from core.domain.exceptions import NotFoundError, ValidationError


def ejecutar_creacion_sobrevivientes(
    repo: RepoSobrevivientes, dto: CrearSobrevivientesDTO
) -> list[ResultadoAltaSobreviviente]:
    if not repo.titular_fallecido(dto.cedula_titular):
        raise ValidationError(
            'El titular no tiene un egreso por fallecimiento registrado; '
            'no se puede dar de alta una pensión de sobrevivencia.'
        )

    # Regla: activo/pasivo = tipoPersonal; el tipo de pensionado es la nómina.
    tipo_nomina_id = repo.resolver_tipo_nomina_sobrevivencia(dto.tipo_nomina_id)

    familiares = repo.listar_familiares_beneficiarios(dto.cedula_titular, dto.familiar_ids)
    if dto.familiar_ids:
        faltantes = set(dto.familiar_ids) - {f.id for f in familiares}
        if faltantes:
            raise NotFoundError(
                f'Familiares {sorted(faltantes)} no pertenecen al titular {dto.cedula_titular}.'
            )
    if not familiares:
        raise NotFoundError('El titular no tiene familiares beneficiarios (herederos) registrados.')

    sin_cedula = [f.id for f in familiares if not f.cedula]
    if sin_cedula:
        raise ValidationError(
            f'Los familiares {sin_cedula} no tienen cédula registrada; '
            'es obligatoria para crear al pensionado.'
        )

    return [
        repo.crear_pasivo_sobreviviente(
            cedula_titular=dto.cedula_titular,
            familiar_id=f.id,
            tipo_nomina_id=tipo_nomina_id,
            usuario_id=dto.usuario_id,
        )
        for f in familiares
    ]
