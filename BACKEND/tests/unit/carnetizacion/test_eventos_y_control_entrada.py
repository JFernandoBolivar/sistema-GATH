"""
Pruebas Unitarias e Integración para Eventos, Invitados y Control de Entrada con QR (O45-B).
"""
import uuid
from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from apps.carnetizacion.application.dtos.evento_dtos import (
    CheckInRequestDTO,
    EventoCrearDTO,
    InvitadoCrearDTO,
)
from apps.carnetizacion.application.use_cases.control_entrada_evento import (
    ControlEntradaEventoUseCase,
)
from apps.carnetizacion.application.use_cases.emitir_credencial_evento import (
    EmitirCredencialesEventoUseCase,
    EnviarCredencialesCorreoUseCase,
)
from apps.carnetizacion.application.use_cases.gestionar_eventos import (
    ActualizarEventoUseCase,
    CrearCategoriaEventoUseCase,
    CrearEventoUseCase,
    CrearZonaEventoUseCase,
    ListarEventosUseCase,
    ObtenerEventoDetalleUseCase,
)
from apps.carnetizacion.application.use_cases.gestionar_invitados import (
    ActualizarInvitadoUseCase,
    CrearInvitadoUseCase,
    ImportarInvitadosUseCase,
    ListarInvitadosUseCase,
)
from apps.carnetizacion.application.use_cases.obtener_panel_evento import (
    ObtenerPanelEventoUseCase,
)
from apps.carnetizacion.domain.entities.evento import (
    EstadoEvento,
    EstadoInvitado,
    ResultadoControlEntrada,
)
from apps.carnetizacion.infrastructure.pdf.evento_pdf import (
    generar_gafete_evento_pdf,
    generar_lote_gafetes_evento_pdf,
)
from apps.carnetizacion.infrastructure.repositories.repo_eventos_orm import (
    RepoEventosORM,
)

pytestmark = pytest.mark.django_db


def test_crear_evento_con_categorias_y_zonas_defecto():
    repo = RepoEventosORM()
    ahora = timezone.now()
    dto = EventoCrearDTO(
        nombre="Encuentro Nacional de Telecomunicaciones 2026",
        lugar="Poliedro de Caracas",
        fecha_inicio=ahora + timedelta(days=5),
        fecha_fin=ahora + timedelta(days=7),
        descripcion="Evento institucional FITELVEN",
    )

    crear_uc = CrearEventoUseCase(repo)
    evento = crear_uc.ejecutar(dto)

    assert evento.id is not None
    assert evento.nombre == "Encuentro Nacional de Telecomunicaciones 2026"
    assert evento.lugar == "Poliedro de Caracas"
    assert len(evento.categorias) == 4  # Invitado especial, Autoridad, Prensa, Staff
    assert len(evento.zonas) == 3  # Salón principal, Área de prensa, Todas las áreas

    detalle = ObtenerEventoDetalleUseCase(repo).ejecutar(evento.id)
    assert detalle is not None
    assert detalle.nombre == evento.nombre


def test_crear_invitado_manual_y_generacion_qr_hash():
    repo = RepoEventosORM()
    ahora = timezone.now()
    evento = CrearEventoUseCase(repo).ejecutar(
        EventoCrearDTO(
            nombre="Gala Conatel 2026",
            lugar="Sede Principal",
            fecha_inicio=ahora,
            fecha_fin=ahora + timedelta(days=1),
        )
    )

    cat_id = evento.categorias[0].id
    zona_id = evento.zonas[0].id

    crear_inv_uc = CrearInvitadoUseCase(repo)
    inv = crear_inv_uc.ejecutar(
        InvitadoCrearDTO(
            evento_id=evento.id,
            nombre_completo="Carlos Alberto Mendoza",
            categoria_id=cat_id,
            zona_id=zona_id,
            documento_identidad="V-18765432",
            organizacion="Ministerio del Poder Popular",
            correo="carlos.mendoza@mpp.gob.ve",
            mesa="Mesa Presidencial 1",
            es_acompanante=False,
        )
    )

    assert inv.id is not None
    assert inv.nombre_completo == "Carlos Alberto Mendoza"
    assert inv.codigo_credencial.startswith("INV-")
    assert len(inv.security_hash) == 64  # SHA-256
    assert inv.estado == "registrado"


def test_importar_invitados_vista_previa_y_confirmar():
    repo = RepoEventosORM()
    ahora = timezone.now()
    evento = CrearEventoUseCase(repo).ejecutar(
        EventoCrearDTO(
            nombre="Cumbre de Ciberseguridad",
            lugar="Auditorio Conatel",
            fecha_inicio=ahora,
            fecha_fin=ahora + timedelta(hours=8),
        )
    )

    filas_cruda = [
        {
            "nombre": "Dra. Elena Ramos",
            "categoria": "Autoridad",
            "zona": "Salón principal",
            "documento": "V-12345678",
            "organizacion": "Cantv",
            "correo": "eramos@cantv.com.ve",
        },
        {
            "nombre": "Lic. Pedro Infante",
            "categoria": "Prensa",
            "zona": "Área de prensa",
            "documento": "V-23456789",
            "organizacion": "VTV",
            "correo": "pinfante@vtv.gob.ve",
        },
        {
            "nombre": "",  # Fila inválida por falta de nombre
            "categoria": "Staff",
            "zona": "Todas las áreas",
        },
    ]

    importar_uc = ImportarInvitadosUseCase(repo)

    # 1. Vista previa (aplicar = False)
    resumen_prev = importar_uc.ejecutar(evento.id, filas_cruda, aplicar=False)
    assert resumen_prev.total_filas == 3
    assert resumen_prev.filas_validas == 2
    assert resumen_prev.filas_invalidas == 1
    assert len(repo.listar_invitados(evento.id)) == 0

    # 2. Confirmación (aplicar = True)
    resumen_conf = importar_uc.ejecutar(evento.id, filas_cruda, aplicar=True)
    assert resumen_conf.filas_validas == 2
    assert len(repo.listar_invitados(evento.id)) == 2


def test_emitir_credenciales_evento_en_lote():
    repo = RepoEventosORM()
    ahora = timezone.now()
    evento = CrearEventoUseCase(repo).ejecutar(
        EventoCrearDTO(
            nombre="Conferencia 5G",
            lugar="Sala Plenaria",
            fecha_inicio=ahora,
            fecha_fin=ahora + timedelta(days=2),
        )
    )

    cat_id = evento.categorias[0].id
    zona_id = evento.zonas[0].id

    # Crear 3 invitados
    for i in range(3):
        CrearInvitadoUseCase(repo).ejecutar(
            InvitadoCrearDTO(
                evento_id=evento.id,
                nombre_completo=f"Asistente Número {i+1}",
                categoria_id=cat_id,
                zona_id=zona_id,
                correo=f"asistente{i+1}@correo.com",
            )
        )

    emitir_uc = EmitirCredencialesEventoUseCase(repo)
    resultado = emitir_uc.ejecutar(evento.id)

    assert resultado["total_procesados"] == 3
    assert resultado["total_emitidos"] == 3

    invitados = repo.listar_invitados(evento.id)
    for inv in invitados:
        assert inv.estado == EstadoInvitado.EMITIDO
        assert inv.fecha_emision is not None


def test_control_entrada_acceso_permitido_y_bitacora():
    repo = RepoEventosORM()
    ahora = timezone.now()
    evento = CrearEventoUseCase(repo).ejecutar(
        EventoCrearDTO(
            nombre="Simposio Satelital",
            lugar="Sala Simón Bolívar",
            fecha_inicio=ahora - timedelta(hours=1),
            fecha_fin=ahora + timedelta(hours=5),
        )
    )

    inv = CrearInvitadoUseCase(repo).ejecutar(
        InvitadoCrearDTO(
            evento_id=evento.id,
            nombre_completo="Ing. Mariana Rojas",
            categoria_id=evento.categorias[0].id,
            zona_id=evento.zonas[0].id,
            documento_identidad="V-19888777",
            organizacion="ABAE",
        )
    )

    # 1er Escaneo: Acceso Permitido
    checkin_uc = ControlEntradaEventoUseCase(repo)
    resp = checkin_uc.ejecutar(
        CheckInRequestDTO(
            codigo_o_hash=inv.security_hash,
            evento_id=evento.id,
            zona_id=evento.zonas[0].id,
        ),
        ahora=ahora,
    )

    assert resp.resultado == ResultadoControlEntrada.ACCESO_PERMITIDO.value
    assert "Acceso permitido" in resp.mensaje
    assert resp.nombre_completo == "Ing. Mariana Rojas"

    # Verificar actualización de estado en DB
    inv_actualizado = repo.obtener_invitado(inv.id)
    assert inv_actualizado is not None
    assert inv_actualizado.estado == EstadoInvitado.INGRESO
    assert inv_actualizado.fecha_ingreso is not None


def test_control_entrada_ya_ingreso_muestra_hora():
    repo = RepoEventosORM()
    ahora = timezone.now()
    evento = CrearEventoUseCase(repo).ejecutar(
        EventoCrearDTO(
            nombre="Foro de Espectro Radioeléctrico",
            lugar="Auditorio",
            fecha_inicio=ahora - timedelta(hours=2),
            fecha_fin=ahora + timedelta(hours=4),
        )
    )

    inv = CrearInvitadoUseCase(repo).ejecutar(
        InvitadoCrearDTO(
            evento_id=evento.id,
            nombre_completo="Dr. Roberto Silva",
            categoria_id=evento.categorias[0].id,
            zona_id=evento.zonas[0].id,
            documento_identidad="V-15666777",
        )
    )

    checkin_uc = ControlEntradaEventoUseCase(repo)
    hora_primer_ingreso = ahora - timedelta(minutes=35)

    # Primer ingreso registrado
    checkin_uc.ejecutar(
        CheckInRequestDTO(codigo_o_hash=inv.security_hash, evento_id=evento.id),
        ahora=hora_primer_ingreso,
    )

    # Segundo escaneo posterior: Ya Ingresó
    resp2 = checkin_uc.ejecutar(
        CheckInRequestDTO(codigo_o_hash=inv.security_hash, evento_id=evento.id),
        ahora=ahora,
    )

    assert resp2.resultado == ResultadoControlEntrada.YA_INGRESO.value
    assert "Ya ingresó a las" in resp2.mensaje


def test_control_entrada_no_valida_por_otro_evento_o_anulada():
    repo = RepoEventosORM()
    ahora = timezone.now()
    evento1 = CrearEventoUseCase(repo).ejecutar(
        EventoCrearDTO(
            nombre="Evento Uno",
            lugar="Lugar A",
            fecha_inicio=ahora,
            fecha_fin=ahora + timedelta(hours=3),
        )
    )
    evento2 = CrearEventoUseCase(repo).ejecutar(
        EventoCrearDTO(
            nombre="Evento Dos",
            lugar="Lugar B",
            fecha_inicio=ahora,
            fecha_fin=ahora + timedelta(hours=3),
        )
    )

    inv1 = CrearInvitadoUseCase(repo).ejecutar(
        InvitadoCrearDTO(
            evento_id=evento1.id,
            nombre_completo="Invitado Uno",
            categoria_id=evento1.categorias[0].id,
            zona_id=evento1.zonas[0].id,
        )
    )

    checkin_uc = ControlEntradaEventoUseCase(repo)

    # 1. Hash inexistente
    resp_invalido = checkin_uc.ejecutar(
        CheckInRequestDTO(codigo_o_hash="hash_inexistente_123456", evento_id=evento1.id)
    )
    assert resp_invalido.resultado == ResultadoControlEntrada.NO_VALIDA.value

    # 2. Invitado de evento1 presentado en puerta de evento2
    resp_otro_evento = checkin_uc.ejecutar(
        CheckInRequestDTO(codigo_o_hash=inv1.security_hash, evento_id=evento2.id)
    )
    assert resp_otro_evento.resultado == ResultadoControlEntrada.NO_VALIDA.value
    assert "otro evento" in resp_otro_evento.mensaje.lower()


def test_panel_metricas_evento():
    repo = RepoEventosORM()
    ahora = timezone.now()
    evento = CrearEventoUseCase(repo).ejecutar(
        EventoCrearDTO(
            nombre="Congreso Telecom 2026",
            lugar="Centro de Convenciones",
            fecha_inicio=ahora,
            fecha_fin=ahora + timedelta(days=1),
        )
    )

    cat_id = evento.categorias[0].id
    zona_id = evento.zonas[0].id

    # 4 invitados
    invs = []
    for i in range(4):
        invs.append(
            CrearInvitadoUseCase(repo).ejecutar(
                InvitadoCrearDTO(
                    evento_id=evento.id,
                    nombre_completo=f"Invitado KPI {i+1}",
                    categoria_id=cat_id,
                    zona_id=zona_id,
                )
            )
        )

    # Emitir credenciales
    EmitirCredencialesEventoUseCase(repo).ejecutar(evento.id)

    # Registrar ingreso de 1 invitado
    ControlEntradaEventoUseCase(repo).ejecutar(
        CheckInRequestDTO(codigo_o_hash=invs[0].security_hash, evento_id=evento.id)
    )

    # Consultar panel
    panel = ObtenerPanelEventoUseCase(repo).ejecutar(evento.id)
    assert panel is not None
    assert panel.total_invitados == 4
    assert panel.credenciales_emitidas == 4
    assert panel.entraron == 1
    assert panel.faltan == 3
    assert panel.porcentaje_asistencia == 25.0


def test_generador_gafetes_pdf_anverso_y_reverso():
    repo = RepoEventosORM()
    ahora = timezone.now()
    evento = CrearEventoUseCase(repo).ejecutar(
        EventoCrearDTO(
            nombre="Feria Internacional de Tecnología",
            lugar="Pabellón Central",
            fecha_inicio=ahora,
            fecha_fin=ahora + timedelta(days=3),
        )
    )

    inv = CrearInvitadoUseCase(repo).ejecutar(
        InvitadoCrearDTO(
            evento_id=evento.id,
            nombre_completo="Dra. Gabriela Mistral",
            categoria_id=evento.categorias[0].id,
            zona_id=evento.zonas[0].id,
            documento_identidad="V-11223344",
            organizacion="Delegación Especial",
            mesa="Mesa Principal",
        )
    )

    ev_ent = repo.obtener_evento(evento.id)
    inv_ent = repo.obtener_invitado(inv.id)
    cat_ent = repo.obtener_categoria(evento.categorias[0].id)
    zona_ent = repo.obtener_zona(evento.zonas[0].id)

    pdf_bytes = generar_gafete_evento_pdf(
        invitado=inv_ent,
        evento=ev_ent,
        categoria=cat_ent,
        zona=zona_ent,
    )

    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF-1.")
    assert len(pdf_bytes) > 2000  # Contiene vectores, tipografía y códigos QR
