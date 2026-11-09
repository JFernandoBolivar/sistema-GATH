"""Análisis de la plantilla de carga masiva (O28-F2, FIX-CARGA1)."""
from datetime import date
from io import BytesIO

from core.domain.validacion_personas import normalizar_ciudad_region
from openpyxl import load_workbook

from apps.carga_masiva.domain.condicion import (
    CAMPOS_REQUERIDOS_POR_DIRECCION,
    DireccionCambio,
    direccion_cambio,
)
from apps.carga_masiva.domain.registro_campos import (
    POBLACION_ACTIVOS,
    POBLACION_PASIVOS,
    TIPOS_POR_CLAVE,
    TipoCarga,
)
from apps.carga_masiva.infrastructure.models import CargaMasivaFilaModel, CargaMasivaModel
from apps.carga_masiva.infrastructure.plantilla_excel import _catalogo
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
    TipoNominaModel,
)
from apps.catalogos.infrastructure.repositories.motivos_por_categoria import (
    listar_motivos_de_operacion,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.identidad.domain.value_objects.condicion_trabajador import CondicionTrabajador
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.domain.categorias_motivo import Operacion
from django.utils import timezone


def _valor(celda) -> str:
    if celda is None:
        return ''
    return str(celda).strip()


def _fecha(valor: str) -> date | None:
    try:
        return date.fromisoformat(valor)
    except ValueError:
        return None


def _id_por_nombre(catalogo: str, valor: str):
    if catalogo == 'sexo':
        return SexoModel.objects.filter(sexo__iexact=valor).values_list('id', flat=True).first()
    if catalogo == 'nacionalidad':
        return NacionalidadModel.objects.filter(nombre__iexact=valor).values_list('id', flat=True).first()
    if catalogo == 'estado_civil':
        return EstadoCivilModel.objects.filter(estadoCivil__iexact=valor).values_list('id', flat=True).first()
    if catalogo == 'parentesco':
        return ParentescoModel.objects.filter(descripcion_parentesco__iexact=valor).values_list('id', flat=True).first()
    if catalogo == 'parentesco_familiar':
        return ParentescoModel.objects.filter(descripcion_parentesco__iexact=valor, aplica_familiar=True).values_list('id', flat=True).first()
    return None


def _validar_catalogo(campo, valor: str) -> bool:
    if not valor:
        return True
    val_limpio = valor.strip()
    if campo.catalogo in ('sexo', 'nacionalidad', 'estado_civil', 'parentesco', 'parentesco_familiar'):
        return _id_por_nombre(campo.catalogo, val_limpio) is not None
    if campo.catalogo == 'organismo':
        from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
        return OrganismoAdscritoModel.objects.filter(Organismoadscrito__iexact=val_limpio).exists()
    if campo.catalogo == 'pais':
        from apps.catalogos.infrastructure.models.catalogo_models import PaisModel
        return PaisModel.objects.filter(nombre__iexact=val_limpio).exists()
    if campo.catalogo == 'carrera':
        from apps.personal.infrastructure.models.catalogos_soporte_models import CarreraModel
        return CarreraModel.objects.filter(nombre_carrera__iexact=val_limpio).exists()
    if campo.catalogo == 'institucion':
        from apps.personal.infrastructure.models.catalogos_soporte_models import InstitucionModel
        return InstitucionModel.objects.filter(nombre_institucion__iexact=val_limpio).exists()
    if campo.catalogo == 'codigo_postal':
        from apps.personal.infrastructure.models.catalogos_soporte_models import CodigoPostalModel
        return CodigoPostalModel.objects.filter(codigo__iexact=val_limpio).exists()
    if campo.catalogo == 'municipio':
        base = val_limpio.split('(')[0].strip()
        from apps.catalogos.infrastructure.models.geografia_models import MunicipioModel
        return MunicipioModel.objects.filter(municipio__iexact=base).exists()
    if campo.catalogo == 'parroquia':
        base = val_limpio.split('(')[0].strip()
        from apps.catalogos.infrastructure.models.geografia_models import ParroquiaModel
        return ParroquiaModel.objects.filter(parroquia__iexact=base).exists()
    valores = _catalogo(campo.catalogo)
    if valor in set(valores):
        return True
    return any(v.strip().upper() == val_limpio.upper() for v in valores)


def _empleado(cedula: str):
    return EmployeeModel.objects.filter(cedulaidentidad=cedula).first()


def _posible_duplicado(datos: dict, cedula: str):
    """FIX-CARGA3: persona de otra cédula con los mismos nombres, apellidos y nacimiento.

    La cédula es inmutable tras el registro, así que un error de tipeo en un
    alta crearía un duplicado imposible de corregir. La fila no es un error:
    queda como «Posible duplicado» y solo se aplica con confirmación explícita.
    """
    nombres = (datos.get('nombres') or '').strip()
    apellidos = (datos.get('apellidos') or '').strip()
    nacimiento = _fecha(datos.get('fecha_nacimiento') or '')
    if not (nombres and apellidos and nacimiento):
        return None
    return (
        EmployeeModel.objects
        .filter(nombres__iexact=nombres, apellidos__iexact=apellidos, fecha_nacimiento=nacimiento)
        .exclude(cedulaidentidad=cedula)
        .first()
    )


def _motivo(nombre: str, operacion: Operacion) -> dict | None:
    if not nombre:
        return None
    buscado = nombre.strip().upper()
    for motivo in listar_motivos_de_operacion(operacion):
        if str(motivo['nombre']).strip().upper() == buscado:
            return motivo
    return None


def _tipo_nomina(nombre: str, es_activo: bool) -> TipoNominaModel | None:
    if not nombre:
        return None
    return TipoNominaModel.objects.filter(
        nomina__iexact=nombre.strip(), es_activo=es_activo,
    ).first()


def _cargo(codigo: str):
    from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel

    if not codigo:
        return None
    return AsigTrabajoModel.objects.filter(codigo=codigo.strip()).first()


def _movimiento_activo_a_pasivo(datos: dict) -> dict:
    motivo = _motivo(datos.get('motivo_id', ''), Operacion.PASE_A_PASIVO)
    nomina = _tipo_nomina(datos.get('tipo_nomina_id', ''), es_activo=False)
    faltantes = [
        clave for clave in CAMPOS_REQUERIDOS_POR_DIRECCION[DireccionCambio.ACTIVO_A_PASIVO.value]
        if not {
            'fecha_egreso': datos.get('fecha_egreso', ''),
            'motivo_id': motivo['id'] if motivo else None,
            'tipo_nomina_id': nomina.pk if nomina else None,
        }.get(clave)
    ]
    fecha = datos.get('fecha_egreso', '')
    motivo_nombre = motivo['nombre'] if motivo else ''
    nomina_nombre = nomina.nomina if nomina else ''
    return {
        'tipo': DireccionCambio.ACTIVO_A_PASIVO.value,
        'condicion_actual': CondicionTrabajador.ACTIVO.value,
        'condicion_nueva': CondicionTrabajador.PASIVO.value,
        'fecha': fecha,
        'motivo': motivo_nombre,
        'motivo_id': motivo['id'] if motivo else None,
        'tipo_nomina': nomina_nombre,
        'tipo_nomina_id': nomina.pk if nomina else None,
        'cargo_codigo': '',
        'cargo_id': None,
        'descripcion': (
            f'Pase a pasivo con fecha {fecha or "sin fecha"} por «{motivo_nombre or "sin motivo"}» '
            f'en la nómina {nomina_nombre or "sin nómina"}.'
        ),
        'faltantes': faltantes,
        'completo': not faltantes,
    }


def _movimiento_pasivo_a_activo(datos: dict) -> dict:
    motivo = _motivo(datos.get('motivo_id', ''), Operacion.ASIGNAR_CARGO)
    cargo = _cargo(datos.get('codigo_cargo', ''))
    faltantes = [
        clave for clave in CAMPOS_REQUERIDOS_POR_DIRECCION[DireccionCambio.PASIVO_A_ACTIVO.value]
        if not {
            'fecha_ingreso': datos.get('fecha_ingreso', ''),
            'motivo_id': motivo['id'] if motivo else None,
        }.get(clave)
    ]
    if cargo is None:
        faltantes.append('codigo_cargo')
    fecha = datos.get('fecha_ingreso', '')
    motivo_nombre = motivo['nombre'] if motivo else ''
    codigo = datos.get('codigo_cargo', '')
    return {
        'tipo': DireccionCambio.PASIVO_A_ACTIVO.value,
        'condicion_actual': CondicionTrabajador.PASIVO.value,
        'condicion_nueva': CondicionTrabajador.ACTIVO.value,
        'fecha': fecha,
        'motivo': motivo_nombre,
        'motivo_id': motivo['id'] if motivo else None,
        'tipo_nomina': '',
        'tipo_nomina_id': None,
        'cargo_codigo': codigo,
        'cargo_id': cargo.pk if cargo else None,
        'descripcion': (
            f'Reingreso como activo con fecha {fecha or "sin fecha"} al cargo {codigo or "sin código"} '
            f'por «{motivo_nombre or "sin motivo"}».'
        ),
        'faltantes': faltantes,
        'completo': not faltantes,
    }


def _movimiento_propuesto(direccion: DireccionCambio, datos: dict) -> dict:
    if direccion is DireccionCambio.ACTIVO_A_PASIVO:
        return _movimiento_activo_a_pasivo(datos)
    return _movimiento_pasivo_a_activo(datos)


def _cedula_de(datos: dict) -> str:
    return str(datos.get('cedula') or datos.get('cedula_titular') or '').strip()


def _analizar_fila(
    tipo: TipoCarga, datos: dict, fila: int, poblacion: str,
) -> tuple[str, str, dict]:
    """Devuelve (estado, detalle, anteriores)."""
    detalle: list[str] = []
    for campo in tipo.campos_para(poblacion):
        valor = datos.get(campo.clave, '')
        if campo.es_obligatorio(poblacion) and not valor:
            detalle.append(f'{campo.etiqueta}: obligatorio')
            continue
        if not valor:
            continue
        if campo.tipo == 'fecha' and _fecha(valor) is None:
            detalle.append(f'{campo.etiqueta}: fecha inválida (use AAAA-MM-DD)')
        if campo.tipo == 'entero':
            try:
                int(valor)
            except ValueError:
                detalle.append(f'{campo.etiqueta}: debe ser un número entero')
        if campo.tipo == 'catalogo' and not _validar_catalogo(campo, valor):
            detalle.append(f'{campo.etiqueta}: valor fuera del catálogo')
        if campo.max_length and len(valor) > campo.max_length:
            detalle.append(f'{campo.etiqueta}: supera {campo.max_length} caracteres')
    if detalle:
        return CargaMasivaFilaModel.Estado.ERROR, '; '.join(detalle), {}

    cedula = _cedula_de(datos)
    empleado = _empleado(cedula)
    if not empleado and tipo.clave != 'datos_personales':
        return CargaMasivaFilaModel.Estado.ERROR, 'El trabajador no existe en el sistema.', {}
    if not empleado:
        if poblacion == POBLACION_PASIVOS:
            return (
                CargaMasivaFilaModel.Estado.ERROR,
                'El trabajador no existe en el sistema; el alta de pasivos se hace desde Pasivos → Agregar Pasivo.',
                {},
            )
        if tipo.clave == 'datos_personales':
            duplicado = _posible_duplicado(datos, cedula)
            if duplicado is not None:
                return (
                    CargaMasivaFilaModel.Estado.POSIBLE_DUPLICADO,
                    (
                        f'Posible duplicado (cédula {duplicado.cedulaidentidad}): coinciden '
                        'nombres, apellidos y fecha de nacimiento. Confirme para registrar '
                        'de todos modos o corrija la cédula.'
                    ),
                    {
                        'duplicado_cedula': str(duplicado.cedulaidentidad),
                        'duplicado_nombre': f'{duplicado.nombres} {duplicado.apellidos}'.strip(),
                    },
                )
        return CargaMasivaFilaModel.Estado.NUEVO, 'Registro nuevo (alta de trabajador).', {}
    if tipo.clave == 'cargo_asignacion':
        asignacion = _cargo(datos.get('codigo_cargo', ''))
        if asignacion is None:
            return CargaMasivaFilaModel.Estado.ERROR, 'El código de cargo no existe.', {}
        if asignacion.employee_id is not None and str(asignacion.employee_id) != str(cedula):
            return CargaMasivaFilaModel.Estado.ERROR, 'El código de cargo ya está ocupado por otro trabajador.', {}

    if tipo.clave == 'datos_personales':
        anteriores = {
            'nombres': empleado.nombres,
            'apellidos': empleado.apellidos,
            'correo': empleado.correo or '',
            'telefono_movil': empleado.telefono_movil or '',
            'telefono_habitacion': empleado.telefono_habitacion or '',
        }
        cambios = [
            campo.etiqueta for campo in tipo.campos_para(poblacion)
            if campo.clave in anteriores and datos.get(campo.clave, '') not in ('', anteriores[campo.clave])
        ]
        return (
            (CargaMasivaFilaModel.Estado.ACTUALIZAR, 'Cambian: ' + ', '.join(cambios), anteriores)
            if cambios else (CargaMasivaFilaModel.Estado.SIN_CAMBIOS, 'Sin cambios.', anteriores)
        )

    if tipo.clave == 'familiares':
        familiar = EmployeefamilyModel.objects.filter(
            employeecedula_id=cedula, cedulaFamiliar=datos.get('cedula_familiar') or None,
        ).first()
        if familiar is None:
            return CargaMasivaFilaModel.Estado.NUEVO, 'Familiar nuevo.', {}
        return CargaMasivaFilaModel.Estado.ACTUALIZAR, 'Familiar existente.', {'id': familiar.pk}

    if tipo.clave == 'antecedentes_laborales':
        f_ing = _fecha(datos.get('fecha_ingreso', ''))
        f_egr = _fecha(datos.get('fecha_egreso', ''))
        if f_ing and f_egr and f_egr < f_ing:
            return CargaMasivaFilaModel.Estado.ERROR, 'Fecha de egreso debe ser mayor o igual a la fecha de ingreso.', {}

    if tipo.clave == 'formacion_academica':
        if not datos.get('nivel_academico_id'):
            return CargaMasivaFilaModel.Estado.ERROR, 'El nivel académico es obligatorio.', {}
        if datos.get('titulo') and not datos.get('institucion'):
            return CargaMasivaFilaModel.Estado.ERROR, 'Debe indicar la institución correspondiente al título/carrera.', {}

    if tipo.clave == 'formacion_complementaria':
        f_ini = _fecha(datos.get('fecha_inicio', ''))
        f_fin = _fecha(datos.get('fecha_fin', ''))
        if f_ini and not f_fin:
            return CargaMasivaFilaModel.Estado.ERROR, 'Debe indicar la fecha de fin si indica fecha de inicio.', {}
        if f_fin and not f_ini:
            return CargaMasivaFilaModel.Estado.ERROR, 'Debe indicar la fecha de inicio si indica fecha de fin.', {}
        if f_ini and f_fin and f_fin < f_ini:
            return CargaMasivaFilaModel.Estado.ERROR, 'Fecha de fin debe ser mayor o igual a la fecha de inicio.', {}

    if tipo.clave == 'vivienda':
        from apps.catalogos.infrastructure.models.geografia_models import EstadoModel, MunicipioModel, ParroquiaModel
        from apps.catalogos.infrastructure.models.catalogo_models import PaisModel
        from apps.personal.infrastructure.models.catalogos_soporte_models import (
            CodigoPostalModel,
            CondicionViviendaModel,
        )

        es_venezuela = True
        if poblacion == POBLACION_PASIVOS:
            pais_raw = (datos.get('pais_id') or '').strip()
            if not pais_raw:
                return CargaMasivaFilaModel.Estado.ERROR, 'El país es obligatorio para pasivos.', {}
            pais_obj = PaisModel.objects.filter(nombre__iexact=pais_raw).first()
            if not pais_obj:
                return CargaMasivaFilaModel.Estado.ERROR, f'El país «{pais_raw}» no existe en el catálogo.', {}
            es_venezuela = bool(pais_obj.es_venezuela)

        if es_venezuela:
            edo_raw = (datos.get('estado_id') or '').strip()
            mun_raw = (datos.get('municipio_id') or '').strip()
            par_raw = (datos.get('parroquia_id') or '').strip()
            if not edo_raw:
                return CargaMasivaFilaModel.Estado.ERROR, 'El estado es obligatorio para residencia en Venezuela.', {}
            if not mun_raw:
                return CargaMasivaFilaModel.Estado.ERROR, 'El municipio es obligatorio para residencia en Venezuela.', {}
            if not par_raw:
                return CargaMasivaFilaModel.Estado.ERROR, 'La parroquia es obligatoria para residencia en Venezuela.', {}

            edo_obj = EstadoModel.objects.filter(estado__iexact=edo_raw).first()
            if not edo_obj:
                return CargaMasivaFilaModel.Estado.ERROR, f'El estado «{edo_raw}» no existe en el catálogo.', {}

            mun_base = mun_raw.split('(')[0].strip()
            mun_obj = MunicipioModel.objects.filter(estadoid=edo_obj, municipio__iexact=mun_base).first()
            if not mun_obj:
                if MunicipioModel.objects.filter(municipio__iexact=mun_base).exists():
                    return CargaMasivaFilaModel.Estado.ERROR, f'El municipio «{mun_raw}» no corresponde al estado «{edo_obj.estado}».', {}
                return CargaMasivaFilaModel.Estado.ERROR, f'El municipio «{mun_raw}» no existe en el catálogo.', {}

            par_base = par_raw.split('(')[0].strip()
            par_obj = ParroquiaModel.objects.filter(municipioid=mun_obj, parroquia__iexact=par_base).first()
            if not par_obj:
                if ParroquiaModel.objects.filter(parroquia__iexact=par_base).exists():
                    return CargaMasivaFilaModel.Estado.ERROR, f'La parroquia «{par_raw}» no corresponde al municipio «{mun_obj.municipio}».', {}
                return CargaMasivaFilaModel.Estado.ERROR, f'La parroquia «{par_raw}» no existe en el catálogo.', {}

            cp_raw = (datos.get('codigo_postal') or '').strip()
            if not cp_raw:
                return CargaMasivaFilaModel.Estado.ERROR, 'El código postal es obligatorio para residencia en Venezuela.', {}
            cp_obj = CodigoPostalModel.objects.filter(codigo__iexact=cp_raw).first()
            if cp_obj is None:
                return CargaMasivaFilaModel.Estado.ERROR, f'El código postal «{cp_raw}» no existe en el catálogo.', {}
            if cp_obj.estado_id_id != edo_obj.pk:
                return CargaMasivaFilaModel.Estado.ERROR, f'El código postal «{cp_raw}» no corresponde al estado «{edo_obj.estado}».', {}

            if datos.get('ciudad_region'):
                datos['ciudad_region'] = ''
        else:
            raw_ciudad = (datos.get('ciudad_region') or '').strip()
            ciudad = normalizar_ciudad_region(raw_ciudad)
            datos['ciudad_region'] = ciudad
            if not ciudad:
                return CargaMasivaFilaModel.Estado.ERROR, 'Indique la ciudad o región para residencia en el exterior.', {}
            if len(raw_ciudad) > 120:
                return CargaMasivaFilaModel.Estado.ERROR, 'La ciudad o región no puede superar 120 caracteres.', {}
            if datos.get('estado_id') or datos.get('municipio_id') or datos.get('parroquia_id'):
                return CargaMasivaFilaModel.Estado.ERROR, 'Para residencia en el exterior, Estado, Municipio y Parroquia deben quedar vacíos.', {}
            if (datos.get('codigo_postal') or '').strip():
                return CargaMasivaFilaModel.Estado.ERROR, 'Para residencia en el exterior, el código postal debe quedar vacío.', {}

        cond_raw = (datos.get('condicion_vivienda_id') or '').strip()
        if not cond_raw:
            return CargaMasivaFilaModel.Estado.ERROR, 'La condición de la vivienda es obligatoria.', {}
        if not CondicionViviendaModel.objects.filter(condicion__iexact=cond_raw).exists():
            return CargaMasivaFilaModel.Estado.ERROR, f'La condición «{cond_raw}» no existe en el catálogo.', {}

        dir_raw = (datos.get('direccion_exacta') or '').strip()
        if not dir_raw:
            return CargaMasivaFilaModel.Estado.ERROR, 'La dirección exacta es obligatoria.', {}
        if len(dir_raw) < 10:
            return CargaMasivaFilaModel.Estado.ERROR, 'La dirección exacta debe tener al menos 10 caracteres.', {}

    return CargaMasivaFilaModel.Estado.ACTUALIZAR, 'Registro existente; se actualizará en la aplicación.', {}


def _detalle_cambio(movimiento: dict) -> str:
    if not movimiento.get('completo'):
        faltantes = ', '.join(movimiento.get('faltantes') or ())
        return (
            f'Cambio de condición {movimiento.get("condicion_actual")} → '
            f'{movimiento.get("condicion_nueva")}. Faltan datos del movimiento: {faltantes}.'
        )
    return (
        f'Cambio de condición {movimiento.get("condicion_actual")} → '
        f'{movimiento.get("condicion_nueva")}. {movimiento.get("descripcion", "")} '
        'Requiere confirmación antes de aplicar.'
    )


def _marcar_cambios_condicion(carga: CargaMasivaModel) -> int:
    """Segunda pasada: marca filas de condición distinta y adjunta el movimiento.

    La fila que trae los datos del movimiento (datos personales en PASIVOS,
    cargo y asignación en ACTIVOS) es el origen; las demás filas de la misma
    cédula reciben el mismo resumen para que el aprobador las vea resaltadas.
    """
    poblacion = carga.poblacion
    repo_condicion = RepoCondicionTrabajadorORM()
    condiciones: dict[str, str] = {}
    movimientos: dict[str, dict] = {}
    filas = list(carga.filas.all())
    origen_por_cedula: dict[str, CargaMasivaFilaModel] = {}

    for fila in filas:
        if fila.estado == CargaMasivaFilaModel.Estado.ERROR:
            continue
        cedula = _cedula_de(fila.datos)
        if not cedula:
            continue
        if cedula not in condiciones:
            condiciones[cedula] = repo_condicion.condicion_por_cedula(cedula).value
        direccion = direccion_cambio(condiciones[cedula], poblacion)
        if direccion is None:
            continue
        es_origen = (
            (poblacion == POBLACION_PASIVOS and fila.tipo == 'datos_personales')
            or (poblacion == POBLACION_ACTIVOS and fila.tipo == 'cargo_asignacion')
        )
        if es_origen and cedula not in movimientos:
            movimiento = _movimiento_propuesto(direccion, fila.datos)
            movimiento['origen'] = {'tipo': fila.tipo, 'numero_fila': fila.numero_fila}
            movimientos[cedula] = movimiento
            origen_por_cedula[cedula] = fila

    for fila in filas:
        if fila.estado in (
            CargaMasivaFilaModel.Estado.ERROR,
            CargaMasivaFilaModel.Estado.POSIBLE_DUPLICADO,
        ):
            continue
        cedula = _cedula_de(fila.datos)
        if not cedula or cedula not in condiciones:
            continue
        direccion = direccion_cambio(condiciones[cedula], poblacion)
        if direccion is None:
            continue
        movimiento = movimientos.get(cedula)
        if movimiento is None:
            movimiento = {
                'tipo': direccion.value,
                'condicion_actual': condiciones[cedula],
                'condicion_nueva': poblacion,
                'completo': False,
                'faltantes': list(CAMPOS_REQUERIDOS_POR_DIRECCION[direccion.value]),
                'origen': None,
            }
        fila.estado = CargaMasivaFilaModel.Estado.REQUIERE_CONFIRMACION
        fila.movimiento = dict(movimiento)
        fila.detalle = _detalle_cambio(movimiento)
        fila.save(update_fields=['estado', 'movimiento', 'detalle'])

    return sum(
        1 for fila in filas
        if fila.estado in (
            CargaMasivaFilaModel.Estado.REQUIERE_CONFIRMACION,
            CargaMasivaFilaModel.Estado.POSIBLE_DUPLICADO,
        )
    )


def analizar_archivo(carga: CargaMasivaModel, contenido: bytes, tipos: list[str]) -> CargaMasivaModel:
    libro = load_workbook(BytesIO(contenido), data_only=True)
    claves_vistas: dict[str, set[str]] = {}
    total = validas = errores = 0
    poblacion = carga.poblacion
    for clave in tipos:
        tipo = TIPOS_POR_CLAVE.get(clave)
        if tipo is None or not tipo.aplica_a(poblacion) or tipo.hoja not in libro.sheetnames:
            continue
        campos = tipo.campos_para(poblacion)
        hoja = libro[tipo.hoja]
        for numero in range(5, hoja.max_row + 1):
            datos = {
                campo.clave: _valor(hoja.cell(row=numero, column=indice).value)
                for indice, campo in enumerate(campos, start=1)
            }
            if not any(datos.values()):
                continue
            total += 1
            clave_fila = '|'.join(datos.get(k, '') for k in tipo.clave_negocio)
            vistas_tipo = claves_vistas.setdefault(tipo.clave, set())
            if clave_fila in vistas_tipo:
                estado, detalle, anteriores = (
                    CargaMasivaFilaModel.Estado.ERROR, 'Duplicado dentro del archivo.', {},
                )
            else:
                vistas_tipo.add(clave_fila)
                estado, detalle, anteriores = _analizar_fila(tipo, datos, numero, poblacion)
            if estado == CargaMasivaFilaModel.Estado.ERROR:
                errores += 1
            else:
                validas += 1
            CargaMasivaFilaModel.objects.create(
                carga=carga, hoja=tipo.hoja, tipo=tipo.clave, numero_fila=numero,
                estado=estado, detalle=detalle, datos=datos, anteriores=anteriores,
            )
    carga.filas_total = total
    carga.filas_validas = validas
    carga.filas_error = errores
    carga.filas_confirmacion = _marcar_cambios_condicion(carga)
    carga.filas_confirmadas = 0
    carga.estado = CargaMasivaModel.Estado.ANALIZADA
    carga.analizada_en = timezone.now()
    carga.save(update_fields=[
        'filas_total', 'filas_validas', 'filas_error', 'filas_confirmacion',
        'filas_confirmadas', 'estado', 'analizada_en',
    ])
    return carga
