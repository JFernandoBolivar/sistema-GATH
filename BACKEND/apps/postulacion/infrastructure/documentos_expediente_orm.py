"""
Integración de los documentos digitales (apps.documentos) con el expediente de postulación (F-4, F-5, F-6).

Dos piezas, ambas de `infrastructure` (la única capa que puede conocer a otra app, B16):

  * `ProveedorDatosExpedienteORM` — implementa el puerto `ProveedorDatosDocumento` de `documentos`: arma el diccionario de
    variables del catálogo con los datos REALES del expediente (postulante, Ventana 1 y 2 en su forma legible, propuesta de
    cargo y oficina, número, foto).
  * `DocumentosExpedienteORM` — implementa el puerto `DocumentosDelExpediente` de `postulacion`: orquesta los casos de uso
    de `documentos` para un expediente (listar, campos propios, vista previa, firma por clic, faltantes, contratación).

Los campos propios de cada documento viven en `documentos` (`ValoresDocumentoModel`, por expediente y plantilla): así el
esquema estricto de `datos_ventana2` no se toca y la promoción no copia datos que no son del trabajador.
"""
from datetime import date

from apps.documentos.application.use_cases import documentos_sujeto as uc
from apps.documentos.domain.services.variables_documento import formatear_fecha
from apps.documentos.infrastructure import almacen as almacen_mod
from apps.documentos.infrastructure.pdf.motor import MotorPdfDocumentos
from apps.documentos.infrastructure.repositories.repo_documentos_orm import RepoDocumentosORM, RepoPlantillasORM
from apps.postulacion.domain.entities.bandeja import PropuestaCatalogo
from apps.postulacion.domain.entities.reserva import ACTIVA, CONSUMIDA
from apps.postulacion.infrastructure.catalogos_ventana2_orm import CatalogosVentana2ORM
from apps.postulacion.infrastructure.models.presupuesto_models import ReservaPuestoModel
from apps.postulacion.infrastructure.repositories.puestos_vacantes_orm import PuestosVacantesORM
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import CatalogoPropuestaORM, RepoPostulacionORM
from core.domain.exceptions import NotFoundError
from core.domain.validacion_personas import formatear_telefono

SUJETO = uc.SUJETO_EXPEDIENTE
_NACIONALIDAD = {'V': 'VENEZOLANO', 'E': 'EXTRANJERO'}
_SEXO = {'M': 'MASCULINO', 'F': 'FEMENINO'}


def _mayus(valor) -> str:
    return str(valor or '').strip().upper()


def _edad(nacimiento: str | None, hoy: date) -> str:
    try:
        n = date.fromisoformat(nacimiento) if nacimiento else None
    except ValueError:
        n = None
    if n is None:
        return ''
    return str(hoy.year - n.year - ((hoy.month, hoy.day) < (n.month, n.day)))


def _nombre(ref) -> str:
    return _mayus((ref or {}).get('nombre'))


class ProveedorDatosExpedienteORM:
    """`datos_de('expediente_postulacion', <id>)`: las variables del catálogo con los datos reales del expediente."""

    def __init__(self, almacen=None):
        self._almacen = almacen

    def datos_de(self, sujeto_tipo: str, sujeto_id: str, con_foto: bool = True) -> dict:
        if sujeto_tipo != SUJETO:
            raise NotFoundError('El sujeto del documento no existe.')
        repo = RepoPostulacionORM()
        exp = repo.obtener_expediente(sujeto_id)
        postulante = repo.obtener_postulante(exp.postulante_id) if exp else None
        if exp is None or postulante is None:
            raise NotFoundError('El expediente no existe.')
        hoy = date.today()
        v1, v2 = exp.datos_ventana1 or {}, exp.datos_ventana2 or {}
        leg = CatalogosVentana2ORM().legible(v2) if v2 else {}
        viv, salud, tallas = leg.get('vivienda') or {}, leg.get('salud') or {}, leg.get('tallas') or {}
        emergencia = v1.get('contacto_emergencia') or {}
        nacionalidad = v1.get('nacionalidad') or 'V'
        estudios = leg.get('estudios') or []
        mayor = estudios[0] if estudios else {}
        nombres, apellidos = _mayus(postulante.nombres), _mayus(postulante.apellidos)
        nombres_prop = CatalogoPropuestaORM().nombres_de_propuesta(PropuestaCatalogo(
            cargo_propuesto_id=exp.cargo_propuesto_id, cargo_especifico_propuesto_id=exp.cargo_especifico_propuesto_id,
            tipo_nomina_propuesto_id=exp.tipo_nomina_propuesto_id, direccion_general_id=exp.direccion_general_id,
            direccion_linea_id=exp.direccion_linea_id, coordinacion_id=exp.coordinacion_id, dependencia_id=exp.dependencia_id,
        ))
        # El puesto de la reserva vigente o, ya contratado, de la consumida: así el dato no cambia al contratar (la huella de
        # lo firmado debe seguir valiendo).
        reserva = ReservaPuestoModel.objects.filter(
            expediente_id=exp.id, estado__in=(ACTIVA, CONSUMIDA)).order_by('-reservado_el').first()
        puesto = PuestosVacantesORM().obtener_puesto(reserva.puesto_id) if reserva else None
        alergias = ', '.join(a['nombre'] for a in salud.get('alergias') or [] if a.get('nombre'))
        patologias = ', '.join(a['nombre'] for a in salud.get('patologias_cronicas') or [] if a.get('nombre'))

        def talla(clave):
            t = tallas.get(clave) or {}
            return _mayus(t.get('valor'))

        datos = {
            'nombres': nombres, 'apellidos': apellidos, 'nombre_completo': f'{apellidos} {nombres}'.strip(),
            'cedula': f'{nacionalidad}-{postulante.cedula}', 'cedula_numero': postulante.cedula,
            'nacionalidad': _NACIONALIDAD.get(nacionalidad, ''), 'sexo': _SEXO.get(v1.get('sexo'), ''),
            'estado_civil': _mayus(v1.get('estado_civil')),
            'fecha_nacimiento': formatear_fecha(v1.get('fecha_nacimiento')), 'lugar_nacimiento': '',
            'edad': _edad(v1.get('fecha_nacimiento'), hoy), 'rif': _mayus(v2.get('rif')),
            'profesion': _nombre(mayor.get('carrera')) or _nombre(mayor.get('nivel_academico')), 'numero_colegio': '',
            'telefono_principal': formatear_telefono(v1.get('telefono_alterno')),
            'telefono_celular': formatear_telefono(postulante.telefono_movil), 'correo': postulante.correo or '',
            'contacto_emergencia': ' - '.join(p for p in (_mayus(emergencia.get('nombre')), formatear_telefono(emergencia.get('telefono'))) if p),
            'estado_residencia': _nombre(viv.get('estado')), 'municipio': _nombre(viv.get('municipio')),
            'parroquia': _nombre(viv.get('parroquia')),
            'direccion': _mayus(viv.get('direccion_exacta') or v1.get('direccion_habitacion')),
            'direccion_alterna': '', 'tipo_vivienda': '',
            # La Ventana 2 guarda UNA condición de vivienda («propia», «alquilada»...): es la tenencia.
            'tenencia_vivienda': _nombre(viv.get('condicion_vivienda')), 'monto_vivienda': '',
            'cargo': _mayus(exp.cargo_propuesto_texto or nombres_prop.get('cargo_especifico') or nombres_prop.get('cargo')),
            'codigo_cargo': puesto.codigo if puesto else '',
            'oficina': _mayus(exp.oficina_propuesta_texto or nombres_prop.get('direccion_general')),
            'division': _mayus(nombres_prop.get('direccion_linea')), 'coordinacion': _mayus(nombres_prop.get('coordinacion')),
            'ubicacion_fisica': '', 'nomina': _mayus(nombres_prop.get('tipo_nomina')), 'tipo_empleado': '',
            'fecha_ingreso': '', 'codigo_empleado': '',
            'numero_expediente': exp.numero,
            'grupo_sanguineo': _nombre(salud.get('grupo_sanguineo')),
            'alergias': _mayus(alergias) or ('NINGUNA' if salud else ''),
            'condiciones_salud': _mayus(patologias) or ('NINGUNA' if salud else ''),
            'discapacidad': ('SI' if salud.get('discapacidades') else 'NO') if salud else '',
            'talla_camisa': talla('camisa'), 'talla_pantalon': talla('pantalon'), 'talla_calzado': talla('calzado'),
            'familiares': [
                {
                    'nombre_completo': _mayus(' '.join(p for p in (
                        f.get('primer_apellido'), f.get('segundo_apellido'), f.get('primer_nombre'), f.get('segundo_nombre')) if p)),
                    'parentesco': _nombre(f.get('parentesco')), 'sexo': _nombre(f.get('sexo'))[:1],
                    'cedula': f.get('cedula') or '', 'fecha_nacimiento': formatear_fecha(f.get('fecha_nacimiento')),
                    'edad': _edad(f.get('fecha_nacimiento'), hoy), 'ocupacion': '',
                } for f in leg.get('familiares') or []
            ],
            'estudios': [
                {
                    'nivel': _nombre(e.get('nivel_academico')),
                    'titulo': ' - '.join(p for p in (_nombre(e.get('carrera')), _nombre(e.get('mencion'))) if p),
                    'institucion': _nombre(e.get('institucion')), 'fecha_grado': '',
                } for e in estudios
            ],
            'cursos': [
                {
                    'nombre': _nombre(c.get('capacitacion')), 'institucion': _nombre(c.get('institucion')),
                    'horas': str(c.get('horas') or ''), 'fecha': formatear_fecha(c.get('fecha_fin')),
                } for c in leg.get('cursos') or []
            ],
            'antecedentes': [
                {
                    'institucion': _nombre(a.get('organismo')), 'cargo': '', 'desde': formatear_fecha(a.get('fecha_ingreso')),
                    'hasta': formatear_fecha(a.get('fecha_egreso')), 'motivo_egreso': '',
                } for a in leg.get('antecedentes') or []
            ],
            'idiomas': [
                {'idioma': _mayus(i.get('nombre')), 'habla': i.get('nivel') or '', 'lee': i.get('nivel') or '',
                 'escribe': i.get('nivel') or ''} for i in leg.get('idiomas') or []
            ],
            # Huella de la foto sin descargarla: un cambio de foto invalida lo firmado.
            '_foto_sha256': exp.foto_sha256 or '',
        }
        if con_foto and exp.tiene_foto:
            almacen = self._almacen or almacen_mod.obtener_almacen()
            datos['foto'] = almacen.descargar(exp.foto_clave)
        return datos


class DocumentosExpedienteORM:
    """Implementa `DocumentosDelExpediente` (puerto de postulación) sobre los casos de uso de `documentos`."""

    def __init__(self):
        self._plantillas = RepoPlantillasORM()
        self._documentos = RepoDocumentosORM()
        self._proveedor = ProveedorDatosExpedienteORM()

    def _comunes(self) -> tuple:
        return self._plantillas, self._documentos, self._proveedor

    def listar(self, expediente_id: str, *, con_contratacion: bool = False) -> list[dict]:
        procesos = ('ingreso_ventana2', 'ingreso_contratacion') if con_contratacion else ('ingreso_ventana2',)
        return uc.listar_documentos(*self._comunes(), sujeto_tipo=SUJETO, sujeto_id=expediente_id, procesos=procesos)

    def guardar_campos(self, expediente_id: str, codigo: str, valores: dict) -> dict:
        return uc.guardar_campos_propios(*self._comunes(), sujeto_tipo=SUJETO, sujeto_id=expediente_id, codigo=codigo, valores=valores)

    def vista_previa(self, expediente_id: str, codigo: str) -> bytes:
        return uc.vista_previa(*self._comunes(), MotorPdfDocumentos(), almacen_mod.obtener_almacen(),
                               sujeto_tipo=SUJETO, sujeto_id=expediente_id, codigo=codigo)

    def firmar(self, expediente_id: str, codigo: str, *, cedula: str, ip: str, user_agent: str, acepta: bool) -> dict:
        return uc.firmar_por_clic(
            *self._comunes(), MotorPdfDocumentos(), almacen_mod.obtener_almacen(), sujeto_tipo=SUJETO,
            sujeto_id=expediente_id, codigo=codigo, firmante_id=cedula, ip=ip, user_agent=user_agent, acepta=acepta,
        )

    def clave_firmado(self, expediente_id: str, codigo: str) -> tuple[str, str] | None:
        return uc.clave_pdf_firmado(*self._comunes(), sujeto_tipo=SUJETO, sujeto_id=expediente_id, codigo=codigo)

    def faltantes(self, expediente_id: str) -> list[dict]:
        return uc.faltantes_de_documentos(*self._comunes(), sujeto_tipo=SUJETO, sujeto_id=expediente_id)

    def generar_de_contratacion(self, expediente_id: str, cedula: str, usuario_id: int | None) -> int:
        return uc.generar_de_contratacion(
            *self._comunes(), MotorPdfDocumentos(), almacen_mod.obtener_almacen(), sujeto_tipo=SUJETO,
            sujeto_id=expediente_id, trabajador_cedula=cedula, actor_id=usuario_id,
        )

    def vincular_trabajador(self, expediente_id: str, cedula: str) -> int:
        return uc.vincular_trabajador(self._documentos, sujeto_tipo=SUJETO, sujeto_id=expediente_id, trabajador_cedula=cedula)
