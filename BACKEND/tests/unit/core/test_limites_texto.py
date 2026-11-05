"""Límites de texto libre (direcciones, motivos, observaciones) en los serializers de escritura."""
import pytest

from apps.autogestion.presentation.serializers.actualizacion_serializers import RechazarSolicitudSerializer
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import JustificacionSerializer, MotivoSerializer
from apps.personal.infrastructure.serializers.empleado_escritura_serializers import DatosViviendaEscrituraSerializer
from core.domain.limites_texto import DIRECCION_MAX, DIRECCION_MIN, MOTIVO_MAX, MOTIVO_MIN


@pytest.mark.parametrize('serializer,campo', [
    (MotivoSerializer, 'motivo'),
    (JustificacionSerializer, 'justificacion'),
    (RechazarSolicitudSerializer, 'motivo'),
])
def test_motivos_exigen_minimo_y_maximo_con_error_por_campo(serializer, campo):
    corto = serializer(data={campo: 'a' * (MOTIVO_MIN - 1)})
    assert not corto.is_valid()
    assert 'al menos' in str(corto.errors[campo][0])
    largo = serializer(data={campo: 'a' * (MOTIVO_MAX + 1)})
    assert not largo.is_valid()
    assert 'no puede superar' in str(largo.errors[campo][0])
    assert serializer(data={campo: 'a' * MOTIVO_MIN}).is_valid()
    assert serializer(data={campo: 'a' * MOTIVO_MAX}).is_valid()


def test_direccion_exacta_exige_minimo_y_maximo():
    campo = DatosViviendaEscrituraSerializer().fields['direccion_exacta']
    with pytest.raises(Exception) as corto:
        campo.run_validation('a' * (DIRECCION_MIN - 1))
    assert 'al menos' in str(corto.value)
    with pytest.raises(Exception) as largo:
        campo.run_validation('a' * (DIRECCION_MAX + 1))
    assert 'no puede superar' in str(largo.value)
    assert campo.run_validation('a' * DIRECCION_MIN)
