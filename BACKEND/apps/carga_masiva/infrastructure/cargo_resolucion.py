"""Resolución de los datos de cargo de la carga masiva (FIX-CARGA4).

El Excel trae **nombres** de catálogo (nivel, dirección, denominación, etc.).
Aquí se convierten a ids y se valida la jerarquía organizacional antes de
previsualizar el código que generará `RepoCargosORM.crear_cargo`.
"""
from apps.cargos.infrastructure.models.cargo_models import (
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.catalogos.infrastructure.models.catalogo_models import GradoModel, TipoNominaModel
from apps.catalogos.infrastructure.repositories.motivos_por_categoria import (
    listar_motivos_de_operacion,
)
from apps.organizacion.infrastructure.models.organizacion_models import (
    CoordinacionModel,
    DependenciaModel,
    DireccionGeneralModel,
    DireccionLineaModel,
    OrganismoAdscritoModel,
)
from core.domain.categorias_motivo import Operacion
from core.domain.exceptions import ValidationError


def _texto(datos: dict, clave: str) -> str:
    return str(datos.get(clave) or '').strip()


def _buscar(modelo, campo: str, valor: str, etiqueta: str):
    if not valor:
        raise ValidationError(f'Indique {etiqueta}.')
    obj = modelo.objects.filter(**{f'{campo}__iexact': valor}).first()
    if obj is None:
        raise ValidationError(f'{etiqueta.capitalize()} «{valor}» no existe en el catálogo.')
    return obj


def resolver_datos_cargo(datos: dict) -> dict:
    """Devuelve los ids del cargo; lanza ValidationError con un mensaje legible."""
    denominacion = _buscar(
        DenominacionCargoModel, 'cargo', _texto(datos, 'denominacion_id'),
        'la denominación del cargo',
    )
    especifica = _buscar(
        DenominacionCargoEspecificoModel, 'cargo', _texto(datos, 'especifica_id'),
        'la denominación específica',
    )
    dependencia = _buscar(
        DependenciaModel, 'dependencia', _texto(datos, 'dependencia_id'),
        'el nivel / dependencia',
    )
    direccion_general = _buscar(
        DireccionGeneralModel, 'direccion_general',
        _texto(datos, 'direccion_general_id'), 'la dirección / oficina',
    )
    if direccion_general.dependenciaId_id != dependencia.pk:
        raise ValidationError(
            f'La dirección «{direccion_general.direccion_general}» no pertenece '
            f'al nivel «{dependencia.dependencia}».'
        )

    direccion_linea = None
    nombre_linea = _texto(datos, 'direccion_linea_id')
    if nombre_linea:
        direccion_linea = _buscar(
            DireccionLineaModel, 'direccion_linea', nombre_linea,
            'la dirección de línea / división',
        )
        if direccion_linea.direccionGeneral_id != direccion_general.pk:
            raise ValidationError(
                f'La dirección de línea «{direccion_linea.direccion_linea}» no '
                f'pertenece a «{direccion_general.direccion_general}».'
            )

    coordinacion = None
    nombre_coordinacion = _texto(datos, 'coordinacion_id')
    if nombre_coordinacion:
        coordinacion = _buscar(
            CoordinacionModel, 'coordinacion', nombre_coordinacion,
            'la coordinación',
        )
        if direccion_linea is not None:
            if coordinacion.direccionLinea_id != direccion_linea.pk:
                raise ValidationError(
                    f'La coordinación «{coordinacion.coordinacion}» no pertenece '
                    f'a «{direccion_linea.direccion_linea}».'
                )
        elif coordinacion.direccionLinea_id:
            linea = DireccionLineaModel.objects.filter(pk=coordinacion.direccionLinea_id).first()
            if linea is not None and linea.direccionGeneral_id != direccion_general.pk:
                raise ValidationError(
                    f'La coordinación «{coordinacion.coordinacion}» no pertenece '
                    f'a «{direccion_general.direccion_general}».'
                )

    grado = None
    nombre_grado = _texto(datos, 'grado_id')
    if nombre_grado:
        grado = _buscar(GradoModel, 'grado', nombre_grado, 'el grado')

    organismo = None
    nombre_organismo = _texto(datos, 'organismo_id')
    if nombre_organismo:
        organismo = _buscar(
            OrganismoAdscritoModel, 'Organismoadscrito', nombre_organismo,
            'el organismo adscrito',
        )

    tipo_nomina = _buscar(
        TipoNominaModel, 'nomina', _texto(datos, 'tipo_nomina_id'),
        'el tipo de nómina',
    )
    if not tipo_nomina.es_activo:
        raise ValidationError(
            f'La nómina «{tipo_nomina.nomina}» no es de personal activo.'
        )

    motivo_id = None
    nombre_motivo = _texto(datos, 'motivo_id')
    if nombre_motivo:
        motivos = listar_motivos_de_operacion(Operacion.ASIGNAR_CARGO)
        motivo = next(
            (m for m in motivos if str(m.get('nombre', '')).strip().upper() == nombre_motivo.upper()),
            None,
        )
        if motivo is None:
            raise ValidationError(f'El motivo «{nombre_motivo}» no existe para asignación de cargo.')
        motivo_id = motivo['id']

    return {
        'denominacion_id': denominacion.pk,
        'especifica_id': especifica.pk,
        'tipo_nomina_id': tipo_nomina.pk,
        'dependencia_id': dependencia.pk,
        'direccion_general_id': direccion_general.pk,
        'direccion_linea_id': direccion_linea.pk if direccion_linea else None,
        'coordinacion_id': coordinacion.pk if coordinacion else None,
        'organismo_id': organismo.pk if organismo else None,
        'grado_id': grado.pk if grado else None,
        'observaciones': '',
        'motivo_id': motivo_id,
    }


def previsualizar_codigo(datos_cargo: dict) -> str:
    """Código que generará `crear_cargo` para estos datos (sin crear nada)."""
    return RepoCargosORM().previsualizar_codigo(datos_cargo)
