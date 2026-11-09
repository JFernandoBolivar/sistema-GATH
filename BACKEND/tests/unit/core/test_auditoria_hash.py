from core.domain.auditoria import (
    GENESIS_AUDITORIA,
    calcular_hash_registro,
    dispositivo_de_user_agent,
)


def test_hash_determinista_y_sensible_al_contenido():
    registro = {
        'id': '0197c9a0-1b2c-7d3e-8f40-123456789abc',
        'trace_id': 'trace-1',
        'actor_id': 1,
        'actor_cedula': 'V-1',
        'actor_rol': 'ADMINISTRADOR',
        'modulo': 'personal',
        'accion': 'crear',
        'recurso_tipo': 'empleado',
        'recurso_id': '1',
        'ip_origen': '127.0.0.1',
        'user_agent': 'Mozilla/5.0',
        'dispositivo': 'ESCRITORIO',
        'estado_previo': None,
        'estado_nuevo': {'nombre': 'Ana'},
        'resultado': 'SUCCESS',
    }
    uno = calcular_hash_registro(registro, GENESIS_AUDITORIA)
    dos = calcular_hash_registro(registro, GENESIS_AUDITORIA)
    otro = calcular_hash_registro({**registro, 'accion': 'editar'}, GENESIS_AUDITORIA)
    assert uno == dos
    assert uno != otro
    assert len(uno) == 64


def test_dispositivo_por_user_agent():
    assert dispositivo_de_user_agent('') == 'DESCONOCIDO'
    assert dispositivo_de_user_agent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)') == 'MOVIL'
    assert dispositivo_de_user_agent('Mozilla/5.0 (iPad; CPU OS 17_0)') == 'TABLET'
    assert dispositivo_de_user_agent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)') == 'ESCRITORIO'
    assert dispositivo_de_user_agent('Googlebot/2.1') == 'BOT'
