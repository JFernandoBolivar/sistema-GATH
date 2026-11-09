"""FIX-CARGA3: los serializers de escritura exigen los mismos campos que la carga."""
import pytest

from apps.personal.infrastructure.serializers.empleado_escritura_serializers import (
    AntecedenteServicioEscrituraSerializer,
    EmpleadoActualizarSerializer,
    EmpleadoCrearSerializer,
    FormacionComplementariaEscrituraSerializer,
    PerfilFisicoEscrituraSerializer,
)

pytestmark = pytest.mark.django_db


def test_alta_exige_nacionalidad_y_estado_civil():
    campos = EmpleadoCrearSerializer().fields
    assert campos['nacionalidad_id'].required is True
    assert campos['estado_civil_id'].required is True


def test_edicion_no_permite_vaciar_nacionalidad_ni_estado_civil():
    campos = EmpleadoActualizarSerializer().fields
    assert campos['nacionalidad_id'].allow_null is False
    assert campos['estado_civil_id'].allow_null is False


def test_perfil_fisico_exige_las_tres_tallas_basicas():
    campos = PerfilFisicoEscrituraSerializer().fields
    for nombre in ('tallaCamisa', 'tallaPantalon', 'tallaZapatos'):
        assert campos[nombre].required is True
    assert campos['tallaChaqueta'].required is False


def test_formacion_complementaria_exige_institucion():
    campos = FormacionComplementariaEscrituraSerializer().fields
    assert campos['institucion'].required is True


def test_antecedentes_exige_fecha_de_egreso():
    campos = AntecedenteServicioEscrituraSerializer().fields
    assert campos['fecha_egreso'].required is True


def test_autogestion_exige_institucion_y_fecha_de_egreso_al_crear():
    from apps.autogestion.domain.value_objects.secciones import REQUERIDOS_AL_CREAR

    assert 'institucion_id' in REQUERIDOS_AL_CREAR['formacion_complementaria']
    assert 'fecha_egreso' in REQUERIDOS_AL_CREAR['antecedente_servicio']
