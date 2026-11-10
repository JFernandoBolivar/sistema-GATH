"""
Pruebas unitarias de QR, Privacidad por Dato y Bitácora de Acceso (O44 - E9).
"""
import pytest
from unittest.mock import MagicMock, patch
from django.utils import timezone
from core.domain.exceptions import ValidationError
from apps.carnetizacion.domain.entities.privacidad import (
    FichaQr,
    PRIVACIDAD_POR_DEFECTO,
    validar_preferencias_privacidad,
)
from apps.carnetizacion.infrastructure.repositories.repo_carnetizacion_orm import RepoCarnetizacionORM
from apps.carnetizacion.presentation.views.carnetizacion_views import _aplicar_cabeceras_anti_rastreo
from django.http import HttpResponse


def test_validacion_preferencias_vivienda_nunca_publica():
    """Regla crítica E9: la dirección de vivienda jamás puede configurarse como pública."""
    with pytest.raises(ValidationError) as exc:
        validar_preferencias_privacidad({'direccion_vivienda': 'PUBLICO'})
    assert "no puede ser configurada como pública" in str(exc.value)


def test_validacion_preferencias_niveles_permitidos():
    """Permite configurar PUBLICO, CON_SESION y SOLO_PERSONAL."""
    prefs = validar_preferencias_privacidad({
        'cedula': 'PUBLICO',
        'salud': 'CON_SESION',
        'direccion_vivienda': 'SOLO_PERSONAL',
    })
    assert prefs['cedula'] == 'PUBLICO'
    assert prefs['salud'] == 'CON_SESION'
    assert prefs['direccion_vivienda'] == 'SOLO_PERSONAL'

    with pytest.raises(ValidationError):
        validar_preferencias_privacidad({'salud': 'NIVEL_INVENTADO'})


def test_validacion_preferencias_ubicacion_siempre_publica():
    """La ubicación administrativa se muestra siempre y no es configurable por el titular."""
    prefs = validar_preferencias_privacidad({'ubicacion': 'SOLO_PERSONAL'})
    assert prefs['ubicacion'] == 'PUBLICO'
    assert PRIVACIDAD_POR_DEFECTO['ubicacion'] == 'PUBLICO'


def test_cabeceras_anti_rastreo():
    """El endpoint QR debe bloquear indexación de motores de búsqueda."""
    resp = HttpResponse()
    _aplicar_cabeceras_anti_rastreo(resp)
    assert resp['X-Robots-Tag'] == 'noindex, nofollow, noarchive'
    assert 'no-store' in resp['Cache-Control']


@pytest.mark.django_db
class TestFichaQrYPrivacidad:
    def _crear_empleado_y_carnet(self, activo=True):
        from apps.personal.infrastructure.models.personal_models import EmployeeModel
        from apps.carnetizacion.infrastructure.models.carnetizacion_models import (
            CarnetEmitidoModel,
            MotivosEmisionModel,
        )
        from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
        import secrets

        sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'MASCULINO'})
        nac, _ = NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'Venezolano'})
        motivo, _ = MotivosEmisionModel.objects.get_or_create(id=1, defaults={'nombre': 'Primera Emisión'})

        emp = EmployeeModel.objects.create(
            cedulaidentidad=f"V{secrets.randbelow(89999999) + 10000000}",
            nombres="Ana Sofía",
            apellidos="Pérez Luna",
            sexoid=sexo,
            nacionalidad=nac,
        )

        sec_hash = secrets.token_hex(32)
        carnet = CarnetEmitidoModel.objects.create(
            employee=emp,
            motivo=motivo,
            security_hash=sec_hash,
            activo=activo,
        )
        return emp, carnet

    def test_hash_aleatorio_no_revela_cedula(self):
        emp, carnet = self._crear_empleado_y_carnet()
        assert len(carnet.security_hash) == 64
        assert str(emp.cedulaidentidad) not in carnet.security_hash

    def test_ficha_publica_oculta_cedula_y_vivienda(self):
        emp, carnet = self._crear_empleado_y_carnet()
        repo = RepoCarnetizacionORM()

        # Consulta pública sin sesión
        ficha = repo.consultar_ficha_qr(
            security_hash=carnet.security_hash,
            usuario_sesion=None,
            ip="192.168.1.100",
            user_agent="Mobile Safari",
            accion="ESCANEO",
        )

        assert ficha.es_valido is True
        assert ficha.estado == "VIGENTE"
        assert ficha.nivel_acceso == "PUBLICO"
        assert ficha.datos is not None
        assert ficha.datos["nombre"] == "Ana Sofía Pérez Luna"
        # Cédula oculta por defecto en vista pública
        assert ficha.datos.get("cedula") is None
        # Dirección de vivienda jamás expuesta
        assert "direccion_vivienda" not in ficha.datos
        # Salud disponible pero oculta tras botón explícito
        assert ficha.salud_disponible is True
        assert ficha.datos.get("salud") is None

        # Verificar bitácora de escaneo público
        from apps.carnetizacion.infrastructure.models.carnetizacion_models import BitacoraAccesoQrModel
        bit = BitacoraAccesoQrModel.objects.filter(security_hash=carnet.security_hash).first()
        assert bit is not None
        assert bit.accion == "ESCANEO_PUBLICO"
        assert bit.ip == "192.168.1.100"

    def test_apertura_medica_publica_registra_bitacora(self):
        emp, carnet = self._crear_empleado_y_carnet()
        repo = RepoCarnetizacionORM()

        # Acción explícita de apertura médica
        ficha = repo.consultar_ficha_qr(
            security_hash=carnet.security_hash,
            usuario_sesion=None,
            ip="192.168.1.105",
            user_agent="Mobile Chrome",
            accion="APERTURA_MEDICA",
        )

        assert ficha.es_valido is True
        assert ficha.datos["salud"] is not None
        assert "alergias" in ficha.datos["salud"]

        from apps.carnetizacion.infrastructure.models.carnetizacion_models import BitacoraAccesoQrModel
        bit = BitacoraAccesoQrModel.objects.filter(
            security_hash=carnet.security_hash, accion="APERTURA_MEDICA"
        ).first()
        assert bit is not None

    def test_ficha_con_sesion_revela_cedula(self):
        emp, carnet = self._crear_empleado_y_carnet()
        repo = RepoCarnetizacionORM()

        mock_user = MagicMock()
        mock_user.id = 42
        mock_user.is_authenticated = True
        mock_user.is_superuser = False
        mock_user.is_staff = False
        mock_user.rol_id = "ANALISTA"
        mock_user.has_perm.return_value = False
        mock_user.tiene_permiso.return_value = False

        ficha = repo.consultar_ficha_qr(
            security_hash=carnet.security_hash,
            usuario_sesion=mock_user,
            ip="10.0.0.5",
            user_agent="Firefox Desktop",
            accion="ESCANEO",
        )

        assert ficha.nivel_acceso == "CON_SESION"
        # Usuario con sesión ve la cédula
        assert ficha.datos["cedula"] == emp.cedulaidentidad
        assert "direccion_vivienda" not in ficha.datos

    def test_ficha_administrador_ve_todo_con_bitacora(self):
        emp, carnet = self._crear_empleado_y_carnet()
        repo = RepoCarnetizacionORM()

        mock_admin = MagicMock()
        mock_admin.id = 1
        mock_admin.is_authenticated = True
        mock_admin.is_superuser = True
        mock_admin.rol_id = "ADMINISTRADOR"

        ficha = repo.consultar_ficha_qr(
            security_hash=carnet.security_hash,
            usuario_sesion=mock_admin,
            ip="10.0.0.1",
            user_agent="Internal Audit Tool",
            accion="ESCANEO",
        )

        assert ficha.nivel_acceso == "ADMINISTRADOR"
        assert ficha.datos["expediente_completo_autorizado"] is True
        assert "direccion_vivienda" in ficha.datos

        from apps.carnetizacion.infrastructure.models.carnetizacion_models import BitacoraAccesoQrModel
        bit = BitacoraAccesoQrModel.objects.filter(
            security_hash=carnet.security_hash, accion="CONSULTA_ADMIN"
        ).first()
        assert bit is not None
        assert bit.usuario_id == 1

    def test_carnet_anulado_no_muestra_datos(self):
        emp, carnet = self._crear_empleado_y_carnet(activo=False)
        repo = RepoCarnetizacionORM()

        ficha = repo.consultar_ficha_qr(
            security_hash=carnet.security_hash,
            usuario_sesion=None,
        )

        assert ficha.es_valido is False
        assert ficha.estado == "ANULADO"
        assert "Este carnet fue anulado" in ficha.mensaje
        assert ficha.datos is None

        from apps.carnetizacion.infrastructure.models.carnetizacion_models import BitacoraAccesoQrModel
        bit = BitacoraAccesoQrModel.objects.filter(
            security_hash=carnet.security_hash, accion="ESCANEO_ANULADO"
        ).first()
        assert bit is not None

    def test_anular_carnet_por_egreso(self):
        emp, carnet = self._crear_empleado_y_carnet(activo=True)
        repo = RepoCarnetizacionORM()

        anulados = repo.anular_carnet_por_egreso(emp.id, motivo="Jubilación")
        assert anulados == 1

        carnet.refresh_from_db()
        assert carnet.activo is False
        assert "Jubilación" in carnet.observaciones
