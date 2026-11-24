"""Definiciones de las plantillas de ejemplo (borrador) que siembra `sembrar_plantillas_documentos` (F-1).

Son DATOS DE EJEMPLO para mostrar el diseñador funcionando; el área usuaria las ajusta o las reemplaza.
Las coordenadas de «Afiliación Caja de Ahorro» se midieron sobre el PDF oficial rasterizado a 100 ppp.
"""

PX_A_MM = 0.254  # 100 ppp


def _mm(px: float) -> float:
    return round(px * PX_A_MM, 2)


def _campo_texto(cid, texto, x, y, w, h=18, tamano=8, alineacion='izquierda'):
    return {'id': cid, 'tipo': 'texto', 'texto': texto, 'x': _mm(x), 'y': _mm(y), 'w': _mm(w), 'h': _mm(h),
            'tamano': tamano, 'alineacion': alineacion, 'negrita': False}


def _casilla(cid, variable, valor, x, y):
    return {'id': cid, 'tipo': 'casilla', 'x': _mm(x), 'y': _mm(y), 'w': _mm(14), 'h': _mm(14),
            'condicion': {'variable': variable, 'operador': 'igual', 'valor': valor}}


def definicion_caja_ahorro() -> dict:
    c = [
        _campo_texto('fecha', '{fecha_hoy}', 630, 42, 78, 20, alineacion='centro'),
        _campo_texto('apellidos', '{apellidos}', 45, 168, 265),
        _campo_texto('nombres', '{nombres}', 320, 168, 235),
        _campo_texto('cedula', '{cedula}', 565, 168, 140),
        _casilla('nac_ven', 'nacionalidad', 'VENEZOLANO', 146, 210),
        _casilla('nac_ext', 'nacionalidad', 'EXTRANJERO', 146, 232),
        _campo_texto('lugar_nac', '{lugar_nacimiento}', 410, 212, 295),
        _campo_texto('fecha_nac', '{fecha_nacimiento}', 45, 272, 135),
        _campo_texto('edad', '{edad}', 190, 272, 50),
        _casilla('sexo_m', 'sexo', 'MASCULINO', 341, 265),
        _casilla('sexo_f', 'sexo', 'FEMENINO', 341, 284),
        _casilla('ec_soltero', 'estado_civil', 'SOLTERO', 428, 281),
        _casilla('ec_casado', 'estado_civil', 'CASADO', 508, 281),
        _casilla('ec_divorciado', 'estado_civil', 'DIVORCIADO', 609, 281),
        _casilla('ec_unido', 'estado_civil', 'UNIDO', 681, 281),
        _campo_texto('direccion', '{direccion}', 45, 340, 360, 26),
        _campo_texto('telefono', '{telefono_principal}', 415, 352, 138),
        _campo_texto('celular', '{telefono_celular}', 563, 352, 142),
        _campo_texto('direccion_alterna', '{direccion_alterna}', 45, 406, 505, 28),
        _campo_texto('profesion', '{profesion}', 45, 486, 245),
        _campo_texto('colegio', '{numero_colegio}', 298, 486, 92),
        _casilla('te_fijo', 'tipo_empleado', 'FIJO', 428, 483),
        _casilla('te_contratado', 'tipo_empleado', 'CONTRATADO', 529, 480),
        _casilla('te_obrero', 'tipo_empleado', 'OBRERO', 607, 483),
        _casilla('te_jubilado', 'tipo_empleado', 'JUBILADO', 687, 481),
        _campo_texto('cargo', '{cargo}', 48, 520, 340),
        _campo_texto('gerencia', '{oficina}', 400, 519, 305),
        _campo_texto('division', '{division}', 48, 549, 340),
        _campo_texto('coordinacion', '{coordinacion}', 400, 549, 305),
        _campo_texto('ubicacion', '{ubicacion_fisica}', 48, 580, 657),
        _casilla('tv_casa', 'tipo_vivienda', 'CASA', 82, 638),
        _casilla('tv_quinta', 'tipo_vivienda', 'QUINTA', 154, 638),
        _casilla('tv_apto', 'tipo_vivienda', 'APARTAMENTO', 260, 638),
        _casilla('tv_hotel', 'tipo_vivienda', 'HOTEL/PENSION', 378, 638),
        _casilla('tv_habitacion', 'tipo_vivienda', 'HABITACION', 486, 638),
        _casilla('tv_rustica', 'tipo_vivienda', 'VIVIENDA RUSTICA', 610, 638),
        _casilla('tv_otra', 'tipo_vivienda', 'OTRA', 683, 638),
        _casilla('tn_propia', 'tenencia_vivienda', 'PROPIA O PAGADA', 136, 674),
        _casilla('tn_pagando', 'tenencia_vivienda', 'PROPIA PAGANDO', 265, 674),
        _casilla('tn_alquilada', 'tenencia_vivienda', 'ALQUILADA', 360, 674),
        _casilla('tn_gratuita', 'tenencia_vivienda', 'GRATUITA', 451, 674),
        _campo_texto('monto_vivienda', '{monto_vivienda}', 640, 666, 65),
        {
            'id': 'dependientes', 'tipo': 'tabla', 'coleccion': 'familiares', 'x': _mm(47), 'y': _mm(739),
            'w': _mm(660), 'h': _mm(95), 'interlineado': _mm(31), 'filas_max': 3, 'tamano': 8,
            'columnas': [
                {'variable': 'nombre_completo', 'dx': 0, 'ancho': _mm(255), 'alineacion': 'izquierda'},
                {'variable': 'sexo', 'dx': _mm(258), 'ancho': _mm(50), 'alineacion': 'centro'},
                {'variable': 'parentesco', 'dx': _mm(311), 'ancho': _mm(90), 'alineacion': 'centro'},
                {'variable': 'cedula', 'dx': _mm(403), 'ancho': _mm(100), 'alineacion': 'centro'},
                {'variable': 'fecha_nacimiento', 'dx': _mm(511), 'ancho': _mm(150), 'alineacion': 'centro'},
            ],
        },
    ]
    return {'paginas': [{'origen': 1, 'campos': c}]}


def _celda(etiqueta, variable=None, ancho=1):
    return {'etiqueta': etiqueta, 'variable': variable, 'ancho': ancho}


_TRANSPORTES = ['Vehículo propio', 'Moto', 'Metro', 'Camionetas', 'Ferrocarril', 'Taxis', 'Otro']


def _casillas_transporte(bid, etiqueta, variable):
    return {'id': bid, 'tipo': 'casillas', 'etiqueta': etiqueta, 'variable': variable, 'columnas': 4,
            'opciones': [{'valor': t, 'etiqueta': t} for t in _TRANSPORTES]}


def campos_propios_itinerancia() -> list[dict]:
    def c(clave, etiqueta, tipo='texto_largo', **kw):
        return {'clave': clave, 'etiqueta': etiqueta, 'tipo': tipo, 'obligatorio': True, 'ayuda': '', **kw}
    return [
        c('transporte_ida', 'Medio de transporte (vivienda al trabajo)', 'opcion', opciones=_TRANSPORTES),
        c('ruta_ida', 'Ruta de acceso (vivienda al trabajo)'),
        c('ruta_alterna_ida', 'Ruta alterna (vivienda al trabajo)'),
        c('hora_salida_ida', 'Hora de salida regular de la vivienda', 'texto'),
        c('transporte_vuelta', 'Medio de transporte (trabajo a la vivienda)', 'opcion', opciones=_TRANSPORTES),
        c('ruta_vuelta', 'Ruta de acceso (trabajo a la vivienda)'),
        c('ruta_alterna_vuelta', 'Ruta alterna (trabajo a la vivienda)'),
        c('hora_salida_vuelta', 'Hora de salida regular del trabajo', 'texto'),
        {**c('actividad_personal', 'Actividad personal al salir del trabajo (actividad, lugar y horas)'), 'obligatorio': False},
    ]


def definicion_itinerancia() -> dict:
    caja = lambda bid, etiqueta, variable: {  # noqa: E731
        'id': bid, 'tipo': 'fila_campos', 'alto_mm': 22, 'celdas': [_celda(etiqueta, variable, 12)]}
    return {
        'pagina': {'tamano': 'carta', 'orientacion': 'vertical'},
        'encabezado': {'tipo': 'institucional', 'titulo': 'Notificación itinere', 'subtitulo': ''},
        'bloques': [
            {'id': 'fecha', 'tipo': 'fila_campos', 'celdas': [_celda('Fecha', 'fecha_hoy')], 'alto_mm': 11},
            {'id': 's_empleado', 'tipo': 'seccion', 'titulo': 'Datos del empleado'},
            {'id': 'f_identidad', 'tipo': 'fila_campos', 'alto_mm': 12,
             'celdas': [_celda('Apellidos y nombres', 'nombre_completo', 7), _celda('Cédula de identidad', 'cedula', 3)]},
            {'id': 'f_cargo', 'tipo': 'fila_campos', 'alto_mm': 12,
             'celdas': [_celda('Departamento o gerencia', 'oficina', 5), _celda('Cargo', 'cargo', 4),
                        _celda('Código de empleado', 'codigo_empleado', 3)]},
            {'id': 's_ida', 'tipo': 'seccion', 'titulo': 'Trayecto de la vivienda al lugar de trabajo'},
            _casillas_transporte('c_ida', 'Medio de transporte que utiliza regularmente para trasladarse desde su vivienda hacia su lugar de trabajo', 'propio.transporte_ida'),
            caja('r_ida', 'Describa detalladamente la ruta de acceso desde su vivienda hasta su lugar de trabajo', 'propio.ruta_ida'),
            caja('r_alt_ida', 'Describa detalladamente la ruta alterna desde su vivienda hasta su lugar de trabajo', 'propio.ruta_alterna_ida'),
            {'id': 'h_ida', 'tipo': 'fila_campos', 'alto_mm': 11, 'celdas': [_celda('Hora de salida regular desde su vivienda hacia su lugar de trabajo', 'propio.hora_salida_ida')]},
            {'id': 's_vuelta', 'tipo': 'seccion', 'titulo': 'Trayecto del lugar de trabajo a la vivienda'},
            _casillas_transporte('c_vuelta', 'Medio de transporte que utiliza regularmente para trasladarse desde su lugar de trabajo hacia su vivienda', 'propio.transporte_vuelta'),
            caja('r_vuelta', 'Describa detalladamente la ruta de acceso desde su lugar de trabajo hasta su vivienda', 'propio.ruta_vuelta'),
            caja('r_alt_vuelta', 'Describa detalladamente la ruta alterna desde su lugar de trabajo hasta su vivienda', 'propio.ruta_alterna_vuelta'),
            {'id': 'h_vuelta', 'tipo': 'fila_campos', 'alto_mm': 11, 'celdas': [_celda('Hora de salida regular desde su trabajo hacia su vivienda', 'propio.hora_salida_vuelta')]},
            caja('actividad', 'Indique si realiza alguna actividad personal regularmente al salir de su trabajo: actividad, lugar y hora de entrada y salida', 'propio.actividad_personal'),
            {'id': 'declaracion', 'tipo': 'parrafo', 'alineacion': 'justificado',
             'texto': 'Yo, {nombre_completo}, C.I. {cedula}, declaro que todos los datos suministrados a la presente declaración de ruta habitual son ciertos, y me comprometo a notificar por escrito cualquier cambio en los datos aquí proporcionados, a más tardar el día hábil siguiente de ocurrido el cambio.'},
            {'id': 'firmas', 'tipo': 'firmas', 'firmantes': [
                {'etiqueta': 'PULGAR IZQUIERDO', 'detalle': ''}, {'etiqueta': 'FIRMA DEL TRABAJADOR', 'detalle': ''},
                {'etiqueta': 'PULGAR DERECHO', 'detalle': ''}]},
        ],
    }
