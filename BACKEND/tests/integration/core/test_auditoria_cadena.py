import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import DatabaseError, connection, transaction

from core.domain.auditoria import GENESIS_AUDITORIA
from core.infrastructure.models.auditoria import AuditoriaLog
from core.presentation.audit import registrar_auditoria


pytestmark = pytest.mark.django_db


def _registrar(accion='crear', trace='trace-1'):
    return registrar_auditoria(
        trace_id=trace,
        actor_id=1,
        actor_cedula='V-1',
        actor_rol='ADMINISTRADOR',
        accion=accion,
        modulo='personal',
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        dispositivo='ESCRITORIO',
        estado_nuevo={'nombre': 'Ana'},
    )


def test_encadena_desde_genesis_y_verifica():
    primero = _registrar('crear', 't1')
    segundo = _registrar('editar', 't2')

    assert primero.hash_anterior == GENESIS_AUDITORIA
    assert segundo.hash_anterior == primero.hash_actual
    assert primero.hash_actual != segundo.hash_actual
    call_command('verificar_cadena_auditoria')


def test_modelo_no_permite_actualizar_ni_borrar():
    registro = _registrar()
    registro.accion = 'alterada'
    with pytest.raises(ValueError, match='inmutable'):
        registro.save()
    with pytest.raises(ValueError, match='inmutable'):
        registro.delete()


def _trigger_instalado():
    if connection.vendor != 'postgresql':
        return False
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM pg_trigger WHERE tgname = %s",
            ['gath_auditoria_append_only_trigger'],
        )
        return cursor.fetchone() is not None


def test_bd_rechaza_update_y_delete_de_la_bitacora():
    if not _trigger_instalado():
        pytest.skip('trigger append-only no instalado en la BD de pruebas (--nomigrations)')
    registro = _registrar()
    with pytest.raises(DatabaseError), transaction.atomic():
        AuditoriaLog.objects.filter(pk=registro.pk).update(accion='alterada')
    with pytest.raises(DatabaseError), transaction.atomic():
        AuditoriaLog.objects.filter(pk=registro.pk).delete()


def test_comando_detecta_registro_manipulado():
    _registrar('crear', 't1')
    AuditoriaLog.objects.bulk_create([
        AuditoriaLog(
            trace_id='t2',
            actor_id=1,
            modulo='personal',
            accion='editar',
            hash_anterior='0' * 64,
            hash_actual='f' * 64,
            resultado=AuditoriaLog.Resultado.SUCCESS,
        )
    ])
    with pytest.raises(CommandError, match='Cadena rota'):
        call_command('verificar_cadena_auditoria')
