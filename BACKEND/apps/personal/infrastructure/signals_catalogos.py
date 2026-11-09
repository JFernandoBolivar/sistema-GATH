"""
Invalidación de la caché de catálogos (Fase 2 de rendimiento).

Cualquier alta, edición o borrado en una tabla maestra que alimente un
catálogo invalida la versión global de la caché. Se centraliza aquí para no
tener que recordar una llamada en cada caso de uso ni en cada vista.
"""
from django.apps import apps
from django.db.models.signals import post_delete, post_save

from core.presentation.cache_catalogos import invalidar_catalogos

MODELOS_CATALOGO = (
    # Catálogos propios del expediente.
    'personal.PoliticaModel',
    'personal.CondicionViviendaModel',
    'personal.CodigoPostalModel',
    'personal.GrupoSanguineoModel',
    'personal.NivelAcademicoModel',
    'personal.CarreraModel',
    'personal.MencionModel',
    'personal.InstitucionModel',
    'personal.TipoPrendaModel',
    'personal.RegionTallaModel',
    'personal.TallaModel',
    'personal.CapacitacionModel',
    'personal.GrupoCapacitacionModel',
    'personal.AlergiaModel',
    'personal.CategoriaAlergiaModel',
    'personal.CategoriaPatologiaModel',
    'personal.PatologiaCronicaModel',
    'personal.CategoriaDiscapacidadModel',
    'personal.DiscapacidadModel',
    # Tablas maestras compartidas.
    'catalogos.SexoModel',
    'catalogos.EstatusModel',
    'catalogos.TipoNominaModel',
    'catalogos.ParentescoModel',
    'catalogos.TipoProcedenciaModel',
    'catalogos.EstadoCivilModel',
    'catalogos.NacionalidadModel',
    'catalogos.EstadoModel',
    'catalogos.MunicipioModel',
    'catalogos.ParroquiaModel',
    'organizacion.OrganismoAdscritoModel',
)


def _invalidar_catalogo(sender, **kwargs) -> None:
    invalidar_catalogos()


def conectar_invalidacion_catalogos() -> None:
    for etiqueta in MODELOS_CATALOGO:
        modelo = apps.get_model(etiqueta)
        post_save.connect(
            _invalidar_catalogo,
            sender=modelo,
            dispatch_uid=f'catalogo-save-{etiqueta}',
            weak=False,
        )
        post_delete.connect(
            _invalidar_catalogo,
            sender=modelo,
            dispatch_uid=f'catalogo-delete-{etiqueta}',
            weak=False,
        )
