"""Plantillas de los documentos del ingreso de personal (F-4, F-5): definiciones en borrador para `sembrar_plantillas_documentos`.

Son el PRIMER DISEÑO que el área de Talento Humano revisa, ajusta y publica desde el diseñador:

- «Oferta de Servicios» (formulario propio): reproduce la estructura del formato original de CONATEL (escaneado).
- «Planilla HCM Seguros Miranda» (formato de terceros): el PDF de la aseguradora va de fondo y encima se estampan los datos
  del asegurado. Las coordenadas se midieron sobre el PDF oficial rasterizado a 100 ppp (cada página, ya girada).
- «Contrato de trabajo», «Declaración jurada de no incompatibilidad» y «Autorización de tratamiento de datos personales»:
  formularios propios con texto MODELO genérico. EL TEXTO LEGAL DEBE REVISARLO CONSULTORÍA JURÍDICA ANTES DE PUBLICAR.
Nada aquí son datos reales: ni números de RIF, ni representantes, ni montos.
"""
from apps.documentos.infrastructure.plantillas_ejemplo import _mm


# ───────────────────────── ayudas comunes ─────────────────────────

def _propio(clave, etiqueta, tipo='texto', obligatorio=False, ayuda='', **extra):
    return {'clave': clave, 'etiqueta': etiqueta, 'tipo': tipo, 'obligatorio': obligatorio, 'ayuda': ayuda, **extra}


def _celda(etiqueta, variable=None, ancho=1):
    return {'etiqueta': etiqueta, 'variable': variable, 'ancho': ancho}


def _fila(bid, celdas, alto=12):
    return {'id': bid, 'tipo': 'fila_campos', 'alto_mm': alto, 'celdas': [_celda(*c) for c in celdas]}


def _seccion(bid, titulo):
    return {'id': bid, 'tipo': 'seccion', 'titulo': titulo}


def _parrafo(bid, texto, alineacion='justificado'):
    return {'id': bid, 'tipo': 'parrafo', 'texto': texto, 'alineacion': alineacion}


def _casillas(bid, etiqueta, variable, opciones, columnas=4):
    return {'id': bid, 'tipo': 'casillas', 'etiqueta': etiqueta, 'variable': variable, 'columnas': columnas,
            'opciones': [{'valor': v, 'etiqueta': e} for v, e in opciones]}


def _tabla(bid, titulo, coleccion, columnas, filas_minimas=0):
    return {'id': bid, 'tipo': 'tabla', 'titulo': titulo, 'coleccion': coleccion, 'filas_minimas': filas_minimas,
            'columnas': [{'variable': v, 'etiqueta': e, 'ancho': a} for v, e, a in columnas]}


def _firmas(bid, *firmantes):
    return {'id': bid, 'tipo': 'firmas', 'firmantes': [{'etiqueta': e, 'detalle': d} for e, d in firmantes]}


_AVISO_MODELO = ('MODELO: revisar el texto legal con Consultoría Jurídica antes de publicar. '
                 'Este documento es un modelo genérico preparado para el diseño; no sustituye la redacción jurídica definitiva.')


# ───────────────────────── 1. Oferta de Servicios ─────────────────────────

def campos_propios_oferta() -> list[dict]:
    p = _propio
    return [
        p('cargo_solicitado', 'Cargo solicitado', obligatorio=True),
        p('disponibilidad', 'Disponibilidad', ayuda='Por ejemplo: inmediata, o a partir de una fecha.'),
        p('sueldo_aspira', 'Sueldo que aspira'),
        p('hijos_numero', 'N.º de hijos'),
        p('conyuge_trabaja', 'Cónyuge trabaja', 'si_no'),
        p('naturalizado_fecha', 'Fecha de naturalización', ayuda='Solo si es naturalizado.'),
        p('naturalizado_gaceta', 'N.º de Gaceta Oficial (naturalización)', ayuda='Solo si es naturalizado.'),
        p('tipo_discapacidad', 'Tipo de discapacidad', 'opcion', opciones=[
            'Visual', 'Músculo esquelética', 'Mental psicosocial', 'Mental intelectual', 'Auditiva', 'Múltiple'],
          ayuda='Solo si posee alguna discapacidad.'),
        p('conduce', '¿Conduce?', 'si_no'),
        p('grado_licencia', 'Grado de la licencia'),
        p('lateralidad', 'Lateralidad', 'opcion', opciones=['Derecho', 'Zurdo', 'Ambidiestro']),
        p('otras_profesiones', 'Otras profesiones (especifique)'),
        p('estatura', 'Estatura', ayuda='En metros o centímetros.'),
        p('peso', 'Peso', ayuda='En kilogramos.'),
        p('talla_chaqueta', 'Talla de chaqueta'),
        p('observaciones', 'Observaciones', 'texto_largo'),
        p('sigue_estudios', '¿Sigue estudios actualmente?', 'si_no'),
        p('estudios_actuales', 'Estudios que cursa actualmente'),
        p('semestre_cursa', 'Semestre o año que cursa'),
        p('institucion_estudios', 'Nombre de la institución donde estudia'),
        p('fecha_ingreso_admin', 'Fecha de ingreso a la Administración Pública', 'fecha'),
        p('trabajo_conatel', '¿Trabajó antes en CONATEL?', 'si_no'),
        p('fecha_trabajo_conatel', 'Fecha en que trabajó en CONATEL'),
        p('familiar_organismo', '¿Posee algún familiar o conocido trabajando en la Comisión o en otro organismo público?', 'texto_largo',
          ayuda='Si lo tiene, indique nombre, parentesco y organismo.'),
        p('emp_direccion', 'Último empleo: dirección de la empresa'),
        p('emp_telefono', 'Último empleo: teléfono'),
        p('emp_jefe', 'Último empleo: nombre y cargo del jefe inmediato'),
        p('emp_sueldo_inicial', 'Último empleo: sueldo inicial'),
        p('emp_sueldo_final', 'Último empleo: sueldo final'),
        p('emp_funciones', 'Último empleo: breve descripción de las funciones realizadas', 'texto_largo'),
        p('referencias', 'Referencias personales', 'texto_largo',
          ayuda='Nombre y apellido, ocupación, dirección y teléfono de cada referencia.'),
    ]


def definicion_oferta() -> dict:
    return {
        'pagina': {'tamano': 'carta', 'orientacion': 'vertical'},
        'encabezado': {'tipo': 'institucional', 'titulo': 'Oferta de servicios', 'subtitulo': '(Para ser completada en letra de molde)'},
        'bloques': [
            _fila('o_cargo', [('Cargo solicitado', 'propio.cargo_solicitado', 5), ('Disponibilidad', 'propio.disponibilidad', 4),
                              ('Sueldo que aspira', 'propio.sueldo_aspira', 3)]),
            _seccion('s_personales', 'Datos personales'),
            {'id': 'foto', 'tipo': 'foto', 'alineacion': 'derecha', 'ancho_mm': 25, 'alto_mm': 31},
            _fila('p_nombres', [('Apellidos', 'apellidos', 6), ('Nombres', 'nombres', 6)]),
            _fila('p_identidad', [('Cédula de identidad', 'cedula', 2.5), ('Sexo', 'sexo', 2), ('Fecha de nacimiento', 'fecha_nacimiento', 2.5),
                                  ('Edad', 'edad', 1), ('Lugar de nacimiento (país / estado / ciudad)', 'lugar_nacimiento', 5)]),
            _fila('p_civil', [('Nacionalidad', 'nacionalidad', 2), ('Si es naturalizado: fecha', 'propio.naturalizado_fecha', 2),
                              ('N.º de Gaceta Oficial', 'propio.naturalizado_gaceta', 2), ('Estado civil', 'estado_civil', 2),
                              ('N.º de hijos', 'propio.hijos_numero', 1.5), ('Cónyuge trabaja', 'propio.conyuge_trabaja', 1.5)]),
            _fila('p_contacto', [('Correo electrónico', 'correo', 6), ('Teléfono de habitación', 'telefono_principal', 3),
                                 ('Teléfono móvil', 'telefono_celular', 3)]),
            _fila('p_direccion', [('Dirección', 'direccion', 12)], alto=13),
            _fila('p_otra_direccion', [('Otra dirección', 'direccion_alterna', 12)], alto=11),
            _fila('p_salud', [('Grupo sanguíneo', 'grupo_sanguineo', 3), ('¿Posee algún tipo de discapacidad?', 'discapacidad', 3),
                              ('Tipo de discapacidad', 'propio.tipo_discapacidad', 6)]),
            _casillas('p_habita', 'Habita en', 'tipo_vivienda', [('CASA', 'Casa'), ('APARTAMENTO', 'Apartamento'), ('OTRA', 'Otros')], 4),
            _casillas('p_tenencia', 'Tipo de vivienda', 'tenencia_vivienda', [
                ('PROPIA O PAGADA', 'Propia'), ('PROPIA PAGANDO', 'Propia pagando'), ('ALQUILADA', 'Alquilada'), ('GRATUITA', 'Otros')], 4),
            _fila('p_conduce', [('¿Conduce?', 'propio.conduce', 1.5), ('Grado de licencia', 'propio.grado_licencia', 1.5),
                                ('R.I.F.', 'rif', 2.5), ('Lateralidad', 'propio.lateralidad', 2), ('Profesión', 'profesion', 4.5)]),
            _fila('p_otras_prof', [('Otras profesiones (especifique)', 'propio.otras_profesiones', 12)], alto=11),
            _fila('p_medidas', [('Estatura', 'propio.estatura', 2), ('Peso', 'propio.peso', 2), ('Talla de camisa', 'talla_camisa', 2),
                                ('Talla de pantalón', 'talla_pantalon', 2), ('Talla de zapatos', 'talla_calzado', 2),
                                ('Talla de chaqueta', 'propio.talla_chaqueta', 2)], alto=11),
            _fila('p_observaciones', [('Observaciones', 'propio.observaciones', 12)], alto=14),

            _seccion('s_academico', 'Nivel académico'),
            _tabla('t_estudios', '', 'estudios', [('nivel', 'Nivel o educación', 2), ('institucion', 'Instituto', 3),
                                                  ('titulo', 'Título obtenido', 3), ('fecha_grado', 'Fecha', 1.5)], filas_minimas=4),
            _fila('a_sigue', [('¿Sigue estudios actualmente? Indíquelo', 'propio.estudios_actuales', 4), ('Sigue estudios', 'propio.sigue_estudios', 1.5),
                              ('Semestre o año que cursa', 'propio.semestre_cursa', 2.5), ('Nombre de la institución', 'propio.institucion_estudios', 4)], alto=11),
            _fila('a_admin', [('Fecha de ingreso a la Administración Pública', 'propio.fecha_ingreso_admin', 5),
                              ('¿Trabajó antes en CONATEL?', 'propio.trabajo_conatel', 3.5), ('Indique fecha', 'propio.fecha_trabajo_conatel', 3.5)], alto=11),
            _fila('a_familiar', [('¿Posee algún familiar o conocido trabajando en la Comisión o en otro organismo público? Indique',
                                  'propio.familiar_organismo', 12)], alto=13),

            _seccion('s_cursos', 'Cursos realizados'),
            _tabla('t_cursos', '', 'cursos', [('nombre', 'Nombre del curso', 5), ('institucion', 'Institución', 4),
                                              ('fecha', 'Fecha', 2), ('horas', 'Horas', 1)], filas_minimas=5),
            _seccion('s_idiomas', 'Otros idiomas'),
            _tabla('t_idiomas', 'Idiomas que conoce además del castellano (bien, regular, poco)', 'idiomas', [
                ('idioma', 'Idioma', 3), ('habla', 'Habla', 2), ('lee', 'Lee', 2), ('escribe', 'Escribe', 2)], filas_minimas=2),

            {'id': 'salto_2', 'tipo': 'salto_pagina'},
            _seccion('s_familia', 'Grupo familiar (padres, cónyuge e hijos)'),
            _tabla('t_familia', '', 'familiares', [('nombre_completo', 'Apellidos y nombres', 5), ('fecha_nacimiento', 'Fecha de nacimiento', 2),
                                                   ('parentesco', 'Parentesco', 2)], filas_minimas=2),
            _seccion('s_experiencia', 'Experiencia laboral'),
            _tabla('t_antecedentes', 'Antecedentes de servicio, en la Administración Pública y fuera de ella (del más reciente al más antiguo)',
                   'antecedentes', [('institucion', 'Nombre de la empresa o institución', 4), ('cargo', 'Cargo desempeñado', 3),
                                    ('desde', 'Desde', 1.5), ('hasta', 'Hasta', 1.5), ('motivo_egreso', 'Motivo del retiro', 2.5)], filas_minimas=2),
            _fila('e_empresa', [('Último empleo: dirección de la empresa', 'propio.emp_direccion', 8), ('Teléfono', 'propio.emp_telefono', 4)], alto=11),
            _fila('e_jefe', [('Nombre y cargo del jefe inmediato', 'propio.emp_jefe', 6), ('Sueldo inicial', 'propio.emp_sueldo_inicial', 3),
                             ('Sueldo final', 'propio.emp_sueldo_final', 3)], alto=11),
            _fila('e_funciones', [('Breve descripción de las funciones realizadas', 'propio.emp_funciones', 12)], alto=13),
            _seccion('s_referencias', 'Referencias personales'),
            _fila('r_referencias', [('Nombre y apellido, ocupación, dirección y teléfono', 'propio.referencias', 12)], alto=13),
            _parrafo('declaracion',
                     'Declaro que la información y datos suministrados son verdaderos y exactos, y autorizo la verificación de los mismos. '
                     'En caso de comprobarse su falsedad u omisión, se considerará como causa justificada para la culminación de la relación laboral.'),
            _firmas('firmas', ('FIRMA', ''), ('HUELLA DACTILAR', '')),
            _seccion('s_rrhh', 'Solo para uso de Recursos Humanos'),
            _fila('h_cargo', [('Cargo asignado', 'cargo', 5), ('Gerencia', 'oficina', 4), ('División', 'division', 3)], alto=10),
            _fila('h_ingreso', [('Fecha de ingreso', 'fecha_ingreso', 2.5), ('Sueldo', None, 2.5), ('Otra asignación', None, 3), ('Sustituye a', None, 4)], alto=9),
            _fila('h_motivo', [('Motivo de ingreso: egreso, transferencia, promoción o cargo creado', None, 6),
                               ('Fuente de reclutamiento: voluntario, referido, aviso de prensa o página web', None, 6)], alto=11),
            _fila('h_obs', [('Observaciones', None, 8), ('Responsable', None, 4)], alto=9),
        ],
    }


# ───────────────────────── 3. Contrato de trabajo ─────────────────────────

def campos_propios_contrato() -> list[dict]:
    p = _propio
    return [
        p('representante_nombre', 'Representante de CONATEL: nombre y apellido', obligatorio=True),
        p('representante_cargo', 'Representante de CONATEL: cargo y designación', obligatorio=True,
          ayuda='Cargo y acto de designación que acreditan su representación.'),
        p('funciones', 'Funciones principales del cargo', 'texto_largo', obligatorio=True),
        p('fecha_fin', 'Fecha de terminación del contrato', 'fecha', obligatorio=True),
        p('sueldo', 'Remuneración mensual (monto y moneda)', obligatorio=True),
        p('horario', 'Jornada y horario de trabajo', obligatorio=True, ayuda='Por ejemplo: lunes a viernes, de 8:00 a. m. a 4:00 p. m.'),
        p('lugar_firma', 'Ciudad donde se suscribe', obligatorio=True),
    ]


def definicion_contrato() -> dict:
    return {
        'pagina': {'tamano': 'carta', 'orientacion': 'vertical'},
        'encabezado': {'tipo': 'institucional', 'titulo': 'Contrato de trabajo', 'subtitulo': 'Personal contratado'},
        'bloques': [
            _seccion('s_modelo', 'Modelo en revisión'),
            _parrafo('aviso', _AVISO_MODELO),
            _seccion('s_datos', 'Datos del contratado'),
            _fila('d_identidad', [('Apellidos y nombres', 'nombre_completo', 7), ('Cédula de identidad', 'cedula', 3), ('RIF', 'rif', 2)], alto=11),
            _fila('d_cargo', [('Cargo', 'cargo', 5), ('Unidad de adscripción', 'oficina', 4), ('Nómina', 'nomina', 3)], alto=11),
            _fila('d_fechas', [('Fecha de ingreso', 'fecha_ingreso', 3), ('Fecha de terminación', 'propio.fecha_fin', 3),
                               ('Remuneración mensual', 'propio.sueldo', 3), ('N.º de expediente', 'numero_expediente', 3)], alto=11),
            _seccion('s_texto', 'Cláusulas'),
            _parrafo('partes',
                     'Entre la COMISIÓN NACIONAL DE TELECOMUNICACIONES (CONATEL), en lo adelante «EL ORGANISMO», representada en este acto por '
                     '{propio.representante_nombre}, en su carácter de {propio.representante_cargo}, por una parte; y por la otra, '
                     '{nombre_completo}, de nacionalidad {nacionalidad}, titular de la cédula de identidad {cedula}, de estado civil {estado_civil} '
                     'y domiciliado en {direccion}, en lo adelante «EL CONTRATADO», se ha convenido en celebrar el presente contrato de trabajo '
                     'por tiempo determinado, que se regirá por las siguientes cláusulas:'),
            _parrafo('c1',
                     'PRIMERA (objeto). EL CONTRATADO se obliga a prestar sus servicios personales a EL ORGANISMO en el cargo de {cargo}, '
                     'adscrito a {oficina}, bajo la modalidad de personal {nomina}, y a cumplir las funciones propias del cargo, entre ellas: '
                     '{propio.funciones}.'),
            _parrafo('c2',
                     'SEGUNDA (duración). El presente contrato tiene vigencia desde el {fecha_ingreso} hasta el {propio.fecha_fin}, fecha en la que '
                     'terminará de pleno derecho, salvo prórroga expresa y por escrito acordada por las partes antes de su vencimiento.'),
            _parrafo('c3',
                     'TERCERA (remuneración). EL ORGANISMO pagará a EL CONTRATADO una remuneración mensual de {propio.sueldo}, con las retenciones '
                     'y deducciones de ley, en las oportunidades y por los medios establecidos por EL ORGANISMO para el pago de su personal.'),
            _parrafo('c4',
                     'CUARTA (jornada). La jornada y el horario de trabajo son los siguientes: {propio.horario}. Los cambios de horario que '
                     'exijan las necesidades del servicio se notificarán por escrito a EL CONTRATADO.'),
            _parrafo('c5',
                     'QUINTA (obligaciones). EL CONTRATADO se obliga a desempeñar sus funciones con diligencia y probidad, a acatar las normas y '
                     'directrices internas de EL ORGANISMO, a cuidar los bienes y equipos que se le asignen y a guardar reserva sobre la información '
                     'a la que tenga acceso con ocasión de su trabajo, aun después de terminada la relación.'),
            _parrafo('c6',
                     'SEXTA (declaraciones). EL CONTRATADO declara que los datos suministrados para su ingreso son verdaderos y que no se encuentra '
                     'incurso en causal alguna de incompatibilidad o impedimento para ejercer el cargo. Su falsedad u omisión será causa justificada '
                     'de terminación del contrato.'),
            _parrafo('c7',
                     'SÉPTIMA (terminación). El contrato terminará por el vencimiento de su plazo, por mutuo acuerdo, o por las demás causas '
                     'previstas en la legislación laboral aplicable. Terminado el contrato, EL CONTRATADO devolverá los bienes y documentos de EL ORGANISMO '
                     'que tuviere en su poder.'),
            _parrafo('c8',
                     'OCTAVA (naturaleza). Las partes reconocen que este contrato es por tiempo determinado y que su vencimiento no genera, por sí '
                     'solo, derecho a continuar en el cargo ni a ingresar a la carrera administrativa.'),
            _parrafo('c9',
                     'NOVENA (normativa y domicilio). En todo lo no previsto en este contrato se aplicará la legislación laboral y administrativa '
                     'vigente. Para los efectos del contrato, las partes eligen como domicilio la ciudad de {propio.lugar_firma}, a cuyos tribunales '
                     'se someten.'),
            _parrafo('cierre',
                     'Se firman dos ejemplares de un mismo tenor y a un solo efecto, en {propio.lugar_firma}, el {fecha_larga}.'),
            _firmas('firmas', ('POR EL ORGANISMO', 'Representante de CONATEL'), ('EL CONTRATADO', 'Firma y cédula de identidad')),
        ],
    }


# ───────────────────────── 4. Declaración jurada de no incompatibilidad ─────────────────────────

def definicion_declaracion_jurada() -> dict:
    return {
        'pagina': {'tamano': 'carta', 'orientacion': 'vertical'},
        'encabezado': {'tipo': 'institucional', 'titulo': 'Declaración jurada de no incompatibilidad', 'subtitulo': ''},
        'bloques': [
            _seccion('s_modelo', 'Modelo en revisión'),
            _parrafo('aviso', _AVISO_MODELO),
            _seccion('s_declarante', 'Datos del declarante'),
            _fila('d_identidad', [('Apellidos y nombres', 'nombre_completo', 7), ('Cédula de identidad', 'cedula', 3), ('RIF', 'rif', 2)], alto=11),
            _fila('d_cargo', [('Cargo al que ingresa', 'cargo', 6), ('Unidad de adscripción', 'oficina', 6)], alto=11),
            _seccion('s_texto', 'Declaración'),
            _parrafo('intro',
                     'Yo, {nombre_completo}, titular de la cédula de identidad {cedula}, de nacionalidad {nacionalidad}, en mi condición de '
                     'aspirante al cargo de {cargo} en la Comisión Nacional de Telecomunicaciones (CONATEL), DECLARO BAJO FE DE JURAMENTO:'),
            _parrafo('d1',
                     '1. Que no desempeño otro cargo o empleo remunerado, público o privado, que resulte incompatible con el cargo al que ingreso, '
                     'ni percibo otra remuneración que la ley prohíba acumular, salvo las excepciones expresamente permitidas por la normativa aplicable.'),
            _parrafo('d2',
                     '2. Que no me encuentro inhabilitado para el ejercicio de funciones públicas ni he sido destituido de un cargo público por '
                     'causas que me impidan ingresar al servicio de la Administración Pública.'),
            _parrafo('d3',
                     '3. Que no tengo conflicto de intereses con las funciones que voy a desempeñar y me comprometo a informar de inmediato a la '
                     'Gerencia de Talento Humano si en el futuro se presenta alguna situación de incompatibilidad.'),
            _parrafo('d4',
                     '4. Que los datos y documentos que he suministrado para mi ingreso son verdaderos, y autorizo su verificación. Entiendo que '
                     'la falsedad u omisión de esta declaración es causa justificada para la culminación de la relación laboral, sin perjuicio de las '
                     'responsabilidades que establezca la ley.'),
            _parrafo('fecha', 'Declaración hecha el {fecha_larga}.', 'izquierda'),
            _firmas('firmas', ('FIRMA DEL DECLARANTE', 'Firma y cédula de identidad'), ('HUELLA DACTILAR', '')),
        ],
    }


# ───────────────────────── 5. Autorización de tratamiento de datos personales ─────────────────────────

def definicion_autorizacion_datos() -> dict:
    return {
        'pagina': {'tamano': 'carta', 'orientacion': 'vertical'},
        'encabezado': {'tipo': 'institucional', 'titulo': 'Autorización de tratamiento de datos personales', 'subtitulo': ''},
        'bloques': [
            _seccion('s_modelo', 'Modelo en revisión'),
            _parrafo('aviso', _AVISO_MODELO),
            _seccion('s_titular', 'Datos del titular'),
            _fila('t_identidad', [('Apellidos y nombres', 'nombre_completo', 7), ('Cédula de identidad', 'cedula', 3), ('N.º de expediente', 'numero_expediente', 2)], alto=11),
            _seccion('s_texto', 'Autorización'),
            _parrafo('intro',
                     'Yo, {nombre_completo}, titular de la cédula de identidad {cedula}, en mi condición de aspirante a ingresar a la Comisión '
                     'Nacional de Telecomunicaciones (CONATEL), AUTORIZO de manera libre, expresa e informada el tratamiento de mis datos personales '
                     'y de los de mi grupo familiar que he suministrado, en los términos siguientes:'),
            _parrafo('a1',
                     '1. Datos. Mis datos de identificación, contacto, dirección, formación académica, experiencia laboral, fotografía y huellas, '
                     'estado de salud y condiciones médicas relevantes, tallas, y los datos de mis familiares dependientes y beneficiarios.'),
            _parrafo('a2',
                     '2. Finalidades. Evaluar mi ingreso, integrar y mantener mi expediente de personal, gestionar mi nómina, mis prestaciones y '
                     'beneficios, la seguridad social, los seguros de salud, la caja de ahorro y la carnetización, y cumplir las obligaciones legales '
                     'de CONATEL como empleador.'),
            _parrafo('a3',
                     '3. Comunicación a terceros. Autorizo que se comuniquen únicamente los datos necesarios a los organismos, aseguradoras y '
                     'entidades con las que CONATEL deba gestionar las finalidades anteriores o a las que esté obligada por ley, y no para fines distintos.'),
            _parrafo('a4',
                     '4. Seguridad y reserva. CONATEL adoptará medidas razonables para resguardar la confidencialidad de mis datos y limitará '
                     'su acceso al personal que los requiera para sus funciones.'),
            _parrafo('a5',
                     '5. Derechos. Puedo conocer los datos que CONATEL conserva sobre mí, solicitar su actualización o rectificación, y solicitar '
                     'su supresión cuando ya no sean necesarios, mediante solicitud dirigida a la Gerencia de Talento Humano. Los datos podrán '
                     'conservarse el tiempo que exija la normativa aplicable al expediente de personal.'),
            _parrafo('a6',
                     '6. Veracidad. Declaro que los datos de terceros que suministro (mi grupo familiar) los entrego con su conocimiento y que me '
                     'comprometo a mantenerlos actualizados.'),
            _parrafo('fecha', 'Autorización otorgada el {fecha_larga}.', 'izquierda'),
            _firmas('firmas', ('FIRMA DEL TITULAR', 'Firma y cédula de identidad'), ('HUELLA DACTILAR', '')),
        ],
    }


# ───────────────────────── 2. Planilla HCM Seguros Miranda (formato de terceros) ─────────────────────────

def campos_propios_hcm() -> list[dict]:
    p = _propio
    return [
        p('estatura_cm', 'Estatura (cm)', obligatorio=True),
        p('peso_kg', 'Peso (kg)', obligatorio=True),
        p('lateralidad', 'Derecho o zurdo', 'opcion', obligatorio=True, opciones=['Derecho', 'Zurdo']),
        p('deporte', 'Deporte que practica', ayuda='Déjelo vacío si no practica ninguno.'),
        p('salud_sin_antecedentes', 'Declaro que ni yo ni las personas a asegurar padecemos ni hemos padecido ninguna de las condiciones '
                                    'del cuestionario de salud (preguntas 1 a 19)', 'si_no',
          ayuda='Si responde SÍ, se marca «No» en todas las preguntas. Si responde NO, el cuestionario se completa a mano.'),
        p('salud_riesgos_no', 'Declaro «No» en las preguntas 1 a 11 de la segunda parte del cuestionario (drogas, alcohol, deportes de riesgo, '
                              'vuelos, seguros previos, etc.)', 'si_no',
          ayuda='Si responde SÍ, se marca «No» en todas esas preguntas. Si responde NO, se completan a mano.'),
        p('familia_sin_antecedentes', 'Declaro que ningún familiar cercano ha padecido diabetes, cáncer, hipertensión, enfermedad cardíaca, renal o mental', 'si_no'),
    ]


def _cx(cx, cy, lado=14):
    """Caja de `lado` px centrada en (cx, cy), en mm: para marcar los círculos del formulario."""
    return {'x': _mm(cx - lado / 2), 'y': _mm(cy - lado / 2), 'w': _mm(lado), 'h': _mm(lado)}


def _marca(cid, cx, cy):
    """«X» fija centrada en un círculo."""
    return {'id': cid, 'tipo': 'texto', 'texto': 'X', **_cx(cx, cy), 'tamano': 10, 'alineacion': 'centro', 'negrita': True}


def _circulo(cid, variable, valor, cx, cy):
    """«X» en un círculo cuando `variable` vale `valor`."""
    return {'id': cid, 'tipo': 'casilla', **_cx(cx, cy), 'condicion': {'variable': variable, 'operador': 'igual', 'valor': valor}}


def _t(cid, texto, x, y, w, h=14, tamano=8, alineacion='izquierda'):
    return {'id': cid, 'tipo': 'texto', 'texto': texto, 'x': _mm(x), 'y': _mm(y), 'w': _mm(w), 'h': _mm(h),
            'tamano': tamano, 'alineacion': alineacion, 'negrita': False}


# Centros (px a 100 ppp) de los círculos «No» de las preguntas del cuestionario de salud.
_NO_SALUD_P4 = [(692, 149), (601, 186), (638, 222), (321, 256), (700, 277), (471, 299), (676, 333), (578, 353),
                (702, 385), (662, 407), (294, 439), (437, 475), (434, 496), (153, 537), (499, 565), (244, 647),
                (738, 670), (396, 704)]
_NO_RIESGOS_P5 = [(721, 132), (320, 188), (611, 224), (213, 299), (390, 339), (561, 386), (623, 448), (567, 489),
                  (619, 532), (573, 572), (114, 633)]


def definicion_hcm() -> dict:
    pag1 = [
        # Ramo a asegurar y tomador (CONATEL, constante).
        _marca('ramo_hcm', 280, 220),
        _t('tomador_nombre', 'COMISIÓN NACIONAL DE TELECOMUNICACIONES (CONATEL)', 305, 283, 305, 16),
        _marca('tomador_juridica', 756, 301),
        # Asegurado propuesto.
        _t('nombre', '{nombre_completo}', 315, 565, 300),
        _marca('persona_natural', 671, 581),
        _t('rif', '{rif}', 538, 590, 80),
        _t('cedula', '{cedula}', 622, 604, 148, 12),
        _circulo('sexo_f', 'sexo', 'FEMENINO', 93, 634),
        _circulo('sexo_m', 'sexo', 'MASCULINO', 131, 634),
        _circulo('ec_soltero', 'estado_civil', 'SOLTERO', 178, 634),
        _circulo('ec_casado', 'estado_civil', 'CASADO', 216, 634),
        _circulo('ec_viudo', 'estado_civil', 'VIUDO', 254, 634),
        _circulo('ec_divorciado', 'estado_civil', 'DIVORCIADO', 274, 634),
        _t('fecha_nac', '{fecha_nacimiento}', 301, 632, 128, 12),
        _t('pais_nac', '{lugar_nacimiento}', 438, 632, 175, 12),
        _t('estatura', '{propio.estatura_cm}', 74, 658, 66, 12),
        _t('peso', '{propio.peso_kg}', 146, 658, 60, 12),
        _t('deporte', '{propio.deporte}', 216, 658, 380, 12),
        _circulo('derecho', 'propio.lateralidad', 'Derecho', 704, 652),
        _circulo('zurdo', 'propio.lateralidad', 'Zurdo', 761, 652),
        _t('actividad', 'ADMINISTRACIÓN PÚBLICA', 76, 680, 285, 12),
        _t('profesion', '{profesion}', 375, 680, 235, 12),
        _t('ocupacion', '{nomina}', 76, 709, 190, 11),
        _t('cargo', '{cargo}', 276, 709, 295, 11),
        # Dirección de habitación.
        _t('hab_pais', 'VENEZUELA', 76, 759, 160, 15),
        _t('hab_estado', '{estado_residencia}', 244, 759, 175, 15),
        _t('hab_municipio', '{municipio}', 608, 759, 160, 15),
        _t('hab_urbanizacion', '{parroquia}', 76, 792, 218, 11),
        _t('hab_avenida', '{direccion}', 302, 792, 246, 11),
        _t('hab_telefono', '{telefono_celular}', 414, 818, 142, 14),
        _t('hab_correo', '{correo}', 564, 818, 204, 14),
    ]
    pag3 = [{
        'id': 'personas_a_asegurar', 'tipo': 'tabla', 'coleccion': 'familiares', 'x': _mm(146), 'y': _mm(243),
        'w': _mm(650), 'h': _mm(99), 'interlineado': _mm(19.8), 'filas_max': 5, 'tamano': 8,
        'columnas': [
            {'variable': 'nombre_completo', 'dx': 0, 'ancho': _mm(140), 'alineacion': 'izquierda'},
            {'variable': 'cedula', 'dx': _mm(144), 'ancho': _mm(90), 'alineacion': 'centro'},
            {'variable': 'fecha_nacimiento', 'dx': _mm(239), 'ancho': _mm(84), 'alineacion': 'centro'},
            {'variable': 'parentesco', 'dx': _mm(503), 'ancho': _mm(145), 'alineacion': 'centro'},
        ],
    }]
    pag4 = [_circulo(f's{i + 1}', 'propio.salud_sin_antecedentes', 'SI', x, y) for i, (x, y) in enumerate(_NO_SALUD_P4)]
    pag5 = [_circulo(f'r{i + 1}', 'propio.salud_riesgos_no', 'SI', x, y) for i, (x, y) in enumerate(_NO_RIESGOS_P5)]
    pag5.append(_circulo('familia_no', 'propio.familia_sin_antecedentes', 'SI', 367, 836))
    pag6 = [
        _t('fecha_solicitud', '{fecha_hoy}', 66, 541, 150, 12),
        _t('firma_asegurado', '{nombre_completo}  C.I. {cedula}', 312, 893, 205, 11, 7, 'centro'),
    ]
    return {'paginas': [
        {'origen': 1, 'campos': pag1}, {'origen': 2, 'campos': []}, {'origen': 3, 'campos': pag3},
        {'origen': 4, 'campos': pag4}, {'origen': 5, 'campos': pag5}, {'origen': 6, 'campos': pag6},
    ]}

