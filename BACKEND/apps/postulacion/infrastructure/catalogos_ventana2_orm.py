"""
Catálogos y comprobaciones de la Ventana 2 (G-2) contra las tablas de `personal`, `familiares` y `catalogos`.

Implementa el puerto `CatalogosVentana2`. Los formularios usan los MISMOS catálogos que el expediente del trabajador
(parentesco, sexo, condición de vivienda, grupo sanguíneo, alergias, patologías, discapacidades, tallas, estado/municipio/
parroquia) para que la promoción copie los ids sin traducir. Las tablas heredadas se leen sin FK desde las nuevas.
"""
from datetime import date

from apps.catalogos.infrastructure.models.catalogo_models import ParentescoModel, SexoModel
from apps.catalogos.infrastructure.models.geografia_models import EstadoModel, MunicipioModel, ParroquiaModel
from apps.familiares.application.use_cases.validaciones_familiar import (
    resolver_cedula_familiar,
    violaciones_reglas_familiar,
)
from apps.familiares.infrastructure.lector_validacion_familiar_orm import LectorValidacionFamiliarORM
from apps.organizacion.infrastructure.models.organizacion_models import OrganismoAdscritoModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CapacitacionModel,
    CarreraModel,
    CondicionViviendaModel,
    DiscapacidadModel,
    GrupoSanguineoModel,
    InstitucionModel,
    MencionModel,
    NivelAcademicoModel,
    PatologiaCronicaModel,
    TallaModel,
)
from apps.personal.infrastructure.models.idioma_models import IdiomaModel
from apps.postulacion.domain.services.datos_ventana2 import ids_de_catalogo

# Fragmentos del nombre del tipo de prenda (catálogo `TipoPrenda`) para cada talla del formulario.
PRENDAS = {
    'talla_camisa_id': ('camisa', ('camis',)),
    'talla_pantalon_id': ('pantalón', ('pantal',)),
    'talla_zapatos_id': ('calzado', ('zapat', 'calzad')),
    'talla_chaqueta_id': ('chaqueta', ('chaq',)),
}
_CLAVE_PRENDA = {'camisa': 'talla_camisa_id', 'pantalon': 'talla_pantalon_id', 'calzado': 'talla_zapatos_id', 'chaqueta': 'talla_chaqueta_id'}


def _opciones(qs, campo: str) -> list[dict]:
    return [{'id': pk, 'nombre': nombre} for pk, nombre in qs.values_list('pk', campo)]


def _prenda_coincide(clave: str, categoria: str) -> bool:
    return any(f in (categoria or '').lower() for f in PRENDAS[clave][1])


class CatalogosVentana2ORM:
    def catalogos(self, estado_id: int | None = None, municipio_id: int | None = None) -> dict:
        lector = LectorValidacionFamiliarORM()
        parentescos = []
        for p in ParentescoModel.objects.filter(aplica_familiar=True).order_by('descripcion_parentesco'):
            regla = lector.regla_de_parentesco(lector.parentesco(p.pk))
            parentescos.append({
                'id': p.pk, 'nombre': p.descripcion_parentesco, 'es_hijo': regla.es_hijo,
                'menor_a_cargo': regla.menor_a_cargo, 'sin_cedula_hasta_edad': regla.sin_cedula_hasta_edad,
                'permite_orden_hijo': regla.permite_cedula_sintetica,
            })
        tallas: dict[str, list[dict]] = {'camisa': [], 'pantalon': [], 'calzado': [], 'chaqueta': []}
        for t in TallaModel.objects.select_related('tipo_prenda', 'region').order_by('tipo_prenda__categoria', 'region__codigo', 'valor'):
            for clave, clave_talla in _CLAVE_PRENDA.items():
                if _prenda_coincide(clave_talla, t.tipo_prenda.categoria):
                    tallas[clave].append({'id': t.pk, 'valor': t.valor, 'region': t.region.codigo})
        datos = {
            'parentescos': parentescos,
            'sexos': _opciones(SexoModel.objects.order_by('sexo'), 'sexo'),
            'condiciones_vivienda': _opciones(CondicionViviendaModel.objects.order_by('condicion'), 'condicion'),
            'estados': _opciones(EstadoModel.objects.order_by('estado'), 'estado'),
            'municipios': [], 'parroquias': [],
            'grupos_sanguineos': _opciones(GrupoSanguineoModel.objects.order_by('GrupoSanguineo'), 'GrupoSanguineo'),
            'alergias': _opciones(AlergiaModel.objects.order_by('alergia'), 'alergia'),
            'patologias_cronicas': _opciones(PatologiaCronicaModel.objects.order_by('patologia'), 'patologia'),
            'discapacidades': _opciones(DiscapacidadModel.objects.order_by('discapacidad'), 'discapacidad'),
            'tallas': tallas,
            # F-8: los mismos catálogos que la ficha (educación, cursos, antecedentes) y el de idiomas.
            'niveles_academicos': _opciones(NivelAcademicoModel.objects.order_by('nivelacademico'), 'nivelacademico'),
            'carreras': [
                {'id': pk, 'nombre': nombre, 'nivel_academico_id': nivel}
                for pk, nombre, nivel in CarreraModel.objects.order_by('nombre_carrera').values_list('pk', 'nombre_carrera', 'nivel_academico_id')
            ],
            'menciones': [
                {'id': pk, 'nombre': nombre, 'carrera_id': carrera}
                for pk, nombre, carrera in MencionModel.objects.order_by('nombre_mencion').values_list('pk', 'nombre_mencion', 'carrera_id_id')
            ],
            'instituciones': _opciones(InstitucionModel.objects.order_by('nombre_institucion'), 'nombre_institucion'),
            'capacitaciones': _opciones(CapacitacionModel.objects.order_by('nombre_capacitacion'), 'nombre_capacitacion'),
            'organismos': _opciones(OrganismoAdscritoModel.objects.order_by('Organismoadscrito'), 'Organismoadscrito'),
            'idiomas': _opciones(IdiomaModel.objects.filter(activo=True).order_by('nombre'), 'nombre'),
            'niveles_idioma': ['BIEN', 'REGULAR', 'POCO'],
        }
        if estado_id is not None:
            datos['municipios'] = _opciones(MunicipioModel.objects.filter(estadoid_id=estado_id).order_by('municipio'), 'municipio')
        if municipio_id is not None:
            datos['parroquias'] = _opciones(ParroquiaModel.objects.filter(municipioid_id=municipio_id).order_by('parroquia'), 'parroquia')
        return datos

    # ------------------------------------------------------------------------------------------------ comprobaciones
    def errores(
        self, datos: dict, *, cedula_titular: str, fecha_nacimiento_titular: date | None, hoy: date, completo: bool,
    ) -> dict[str, str]:
        errores: dict[str, str] = {}
        self._errores_de_ids(datos, errores)
        self._errores_de_geografia(datos.get('vivienda') or {}, errores)
        self._errores_de_tallas(datos.get('tallas') or {}, errores)
        self._errores_de_formacion(datos, errores)
        self._errores_de_familiares(
            datos.get('familiares') or [], errores, cedula_titular, fecha_nacimiento_titular, hoy, completo,
        )
        return errores

    @staticmethod
    def _existentes(modelo, ids: list[int]) -> set[int]:
        return set(modelo.objects.filter(pk__in=set(ids)).values_list('pk', flat=True)) if ids else set()

    def _errores_de_ids(self, datos: dict, errores: dict) -> None:
        ids = ids_de_catalogo(datos)
        existen = {
            'parentesco': self._existentes(ParentescoModel, ids['parentesco']),
            'sexo': self._existentes(SexoModel, ids['sexo']),
            'condicion_vivienda': self._existentes(CondicionViviendaModel, ids['condicion_vivienda']),
            'grupo_sanguineo': self._existentes(GrupoSanguineoModel, ids['grupo_sanguineo']),
            'alergia': self._existentes(AlergiaModel, ids['alergia']),
            'patologia_cronica': self._existentes(PatologiaCronicaModel, ids['patologia_cronica']),
            'discapacidad': self._existentes(DiscapacidadModel, ids['discapacidad']),
        }
        for i, f in enumerate(datos.get('familiares') or []):
            if f.get('parentesco_id') and f['parentesco_id'] not in existen['parentesco']:
                errores[f'familiares.{i}.parentesco_id'] = "El parentesco indicado no existe."
            if f.get('sexo_id') and f['sexo_id'] not in existen['sexo']:
                errores[f'familiares.{i}.sexo_id'] = "El sexo indicado no existe."
        v, s = datos.get('vivienda') or {}, datos.get('salud') or {}
        if v.get('condicion_vivienda_id') and v['condicion_vivienda_id'] not in existen['condicion_vivienda']:
            errores['vivienda.condicion_vivienda_id'] = "El tipo y tenencia de vivienda indicado no existe."
        if s.get('grupo_sanguineo_id') and s['grupo_sanguineo_id'] not in existen['grupo_sanguineo']:
            errores['salud.grupo_sanguineo_id'] = "El grupo sanguíneo indicado no existe."
        for clave, tipo, etiqueta in (
            ('alergias', 'alergia', 'alergia'), ('patologias_cronicas', 'patologia_cronica', 'enfermedad crónica'),
            ('discapacidades', 'discapacidad', 'discapacidad'),
        ):
            faltan = sorted(set(s.get(clave) or []) - existen[tipo])
            if faltan:
                errores[f'salud.{clave}'] = f"Hay {etiqueta}s que no existen en el catálogo: {', '.join(map(str, faltan))}."

    def _errores_de_formacion(self, datos: dict, errores: dict) -> None:
        """Estudios, cursos, antecedentes e idiomas: los ids existen y la carrera y la mención encajan con su nivel y carrera."""
        ids = ids_de_catalogo(datos)
        niveles = self._existentes(NivelAcademicoModel, ids['nivel_academico'])
        carreras = {c.pk: c for c in CarreraModel.objects.filter(pk__in=set(ids['carrera']))} if ids['carrera'] else {}
        menciones = {m.pk: m for m in MencionModel.objects.filter(pk__in=set(ids['mencion']))} if ids['mencion'] else {}
        instituciones = self._existentes(InstitucionModel, ids['institucion'])
        for i, e in enumerate(datos.get('estudios') or []):
            base = f'estudios.{i}'
            nivel, carrera, mencion = e.get('nivel_academico_id'), e.get('carrera_id'), e.get('mencion_id')
            if nivel and nivel not in niveles:
                errores[f'{base}.nivel_academico_id'] = "El nivel académico indicado no existe."
            if carrera:
                fila = carreras.get(carrera)
                if fila is None:
                    errores[f'{base}.carrera_id'] = "La carrera indicada no existe."
                elif nivel and fila.nivel_academico_id_id and fila.nivel_academico_id_id != nivel:
                    errores[f'{base}.carrera_id'] = "La carrera no corresponde al nivel académico indicado."
            if mencion:
                fila = menciones.get(mencion)
                if fila is None:
                    errores[f'{base}.mencion_id'] = "La mención indicada no existe."
                elif not carrera or fila.carrera_id_id != carrera:
                    errores[f'{base}.mencion_id'] = "La mención no corresponde a la carrera indicada."
            if e.get('institucion_id') and e['institucion_id'] not in instituciones:
                errores[f'{base}.institucion_id'] = "La institución indicada no existe."
        capacitaciones = self._existentes(CapacitacionModel, ids['capacitacion'])
        for i, c in enumerate(datos.get('cursos') or []):
            if c.get('capacitacion_id') and c['capacitacion_id'] not in capacitaciones:
                errores[f'cursos.{i}.capacitacion_id'] = "El curso indicado no existe en el catálogo."
            if c.get('institucion_id') and c['institucion_id'] not in instituciones:
                errores[f'cursos.{i}.institucion_id'] = "La institución indicada no existe."
        organismos = self._existentes(OrganismoAdscritoModel, ids['organismo'])
        for i, a in enumerate(datos.get('antecedentes') or []):
            if a.get('organismo_id') and a['organismo_id'] not in organismos:
                errores[f'antecedentes.{i}.organismo_id'] = "El organismo indicado no existe."
        idiomas = set(IdiomaModel.objects.filter(pk__in=set(ids['idioma']), activo=True).values_list('pk', flat=True)) if ids['idioma'] else set()
        vistos: set = set()
        for i, idioma in enumerate(datos.get('idiomas') or []):
            clave = ('id', idioma['idioma_id']) if idioma.get('idioma_id') else ('otro', (idioma.get('otro_idioma') or '').casefold())
            if idioma.get('idioma_id') and idioma['idioma_id'] not in idiomas:
                errores[f'idiomas.{i}.idioma_id'] = "El idioma indicado no existe en el catálogo."
            elif clave[1] and clave in vistos:
                errores[f'idiomas.{i}.idioma_id' if clave[0] == 'id' else f'idiomas.{i}.otro_idioma'] = "Este idioma ya está registrado."
            vistos.add(clave)

    @staticmethod
    def _errores_de_geografia(v: dict, errores: dict) -> None:
        estado, municipio, parroquia = v.get('estado_id'), v.get('municipio_id'), v.get('parroquia_id')
        if estado and not EstadoModel.objects.filter(pk=estado).exists():
            errores['vivienda.estado_id'] = "El estado indicado no existe."
            return
        fila_municipio = MunicipioModel.objects.filter(pk=municipio).first() if municipio else None
        if municipio and fila_municipio is None:
            errores['vivienda.municipio_id'] = "El municipio indicado no existe."
        elif fila_municipio is not None and estado and fila_municipio.estadoid_id != estado:
            errores['vivienda.municipio_id'] = "El municipio no pertenece al estado indicado."
        fila_parroquia = ParroquiaModel.objects.filter(pk=parroquia).first() if parroquia else None
        if parroquia and fila_parroquia is None:
            errores['vivienda.parroquia_id'] = "La parroquia indicada no existe."
        elif fila_parroquia is not None and municipio and fila_parroquia.municipioid_id != municipio:
            errores['vivienda.parroquia_id'] = "La parroquia no pertenece al municipio indicado."

    @staticmethod
    def _errores_de_tallas(t: dict, errores: dict) -> None:
        ids = [v for v in t.values() if v]
        filas = {f.pk: f for f in TallaModel.objects.select_related('tipo_prenda').filter(pk__in=ids)} if ids else {}
        for clave, valor in t.items():
            if not valor:
                continue
            fila = filas.get(valor)
            if fila is None:
                errores[f'tallas.{clave}'] = "La talla indicada no existe."
            elif not _prenda_coincide(clave, fila.tipo_prenda.categoria):
                errores[f'tallas.{clave}'] = f"La talla indicada no es una talla de {PRENDAS[clave][0]}."

    @staticmethod
    def _errores_de_familiares(
        familiares: list, errores: dict, cedula_titular: str, nacimiento_titular: date | None, hoy: date, completo: bool,
    ) -> None:
        lector = LectorValidacionFamiliarORM()
        propias: set[str] = set()
        sexos = {pk: nombre for pk, nombre in SexoModel.objects.values_list('pk', 'sexo')}
        for i, f in enumerate(familiares):
            base = f'familiares.{i}'
            cedula = (f.get('cedula') or '').strip()
            if cedula and cedula == (cedula_titular or '').strip():
                errores[f'{base}.cedula'] = "La cédula del familiar no puede ser la misma del titular."
            elif cedula and cedula in propias:
                errores[f'{base}.cedula'] = "Esta cédula ya está registrada para otro familiar."
            if cedula:
                propias.add(cedula)
            if not f.get('parentesco_id'):
                continue
            parentesco = lector.parentesco(f['parentesco_id'])
            if parentesco is None:
                continue  # el id inexistente ya se reportó
            if not parentesco.aplica_familiar:
                errores[f'{base}.parentesco_id'] = "El parentesco seleccionado no está permitido para familiares."
                continue
            if not completo:
                continue
            regla = lector.regla_de_parentesco(parentesco)
            nacimiento = date.fromisoformat(f['fecha_nacimiento']) if f.get('fecha_nacimiento') else None
            problemas = violaciones_reglas_familiar(
                regla=regla, fecha_nacimiento=nacimiento, fecha_nacimiento_titular=nacimiento_titular,
                sexo=sexos.get(f.get('sexo_id')), hoy=hoy,
            )
            if problemas and nacimiento is not None:
                errores[f'{base}.fecha_nacimiento'] = problemas[0]
                continue
            try:
                resolver_cedula_familiar(
                    cedula_familiar=cedula or None, cedula_empleado=cedula_titular or '', fecha_nacimiento=nacimiento,
                    orden_hijo=f.get('orden_hijo'), regla=regla,
                )
            except ValueError as e:
                errores[f'{base}.orden_hijo' if not cedula and regla.permite_cedula_sintetica else f'{base}.cedula'] = str(e)

    # ------------------------------------------------------------------------------------------------ lectura legible
    def legible(self, datos: dict) -> dict:
        """Los datos con el nombre de cada catálogo junto al id (los ids que ya no existan quedan con nombre vacío)."""
        ids = ids_de_catalogo(datos)

        def nombres(modelo, campo, lista):
            return dict(modelo.objects.filter(pk__in=set(lista)).values_list('pk', campo)) if lista else {}

        parentescos = nombres(ParentescoModel, 'descripcion_parentesco', ids['parentesco'])
        sexos = nombres(SexoModel, 'sexo', ids['sexo'])
        v, s, t = datos.get('vivienda') or {}, datos.get('salud') or {}, datos.get('tallas') or {}
        condiciones = nombres(CondicionViviendaModel, 'condicion', ids['condicion_vivienda'])
        grupos = nombres(GrupoSanguineoModel, 'GrupoSanguineo', ids['grupo_sanguineo'])
        alergias = nombres(AlergiaModel, 'alergia', ids['alergia'])
        patologias = nombres(PatologiaCronicaModel, 'patologia', ids['patologia_cronica'])
        discapacidades = nombres(DiscapacidadModel, 'discapacidad', ids['discapacidad'])
        estado = EstadoModel.objects.filter(pk=v.get('estado_id')).values_list('estado', flat=True).first() if v.get('estado_id') else None
        municipio = MunicipioModel.objects.filter(pk=v.get('municipio_id')).values_list('municipio', flat=True).first() if v.get('municipio_id') else None
        parroquia = ParroquiaModel.objects.filter(pk=v.get('parroquia_id')).values_list('parroquia', flat=True).first() if v.get('parroquia_id') else None
        tallas_por_id = {
            f.pk: f for f in TallaModel.objects.select_related('region').filter(pk__in=ids['talla'])
        } if ids['talla'] else {}

        def talla(clave):
            fila = tallas_por_id.get(t.get(clave))
            return {'id': t.get(clave), 'valor': fila.valor if fila else None, 'region': fila.region.codigo if fila else None} if t.get(clave) else None

        def lista(valores, nombres_por_id):
            return [{'id': i, 'nombre': nombres_por_id.get(i, '')} for i in valores or []]

        estudios, cursos = datos.get('estudios') or [], datos.get('cursos') or []
        antecedentes, idiomas = datos.get('antecedentes') or [], datos.get('idiomas') or []
        niveles = nombres(NivelAcademicoModel, 'nivelacademico', ids['nivel_academico'])
        carreras = nombres(CarreraModel, 'nombre_carrera', ids['carrera'])
        menciones = nombres(MencionModel, 'nombre_mencion', ids['mencion'])
        instituciones = nombres(InstitucionModel, 'nombre_institucion', ids['institucion'])
        capacitaciones = nombres(CapacitacionModel, 'nombre_capacitacion', ids['capacitacion'])
        organismos = nombres(OrganismoAdscritoModel, 'Organismoadscrito', ids['organismo'])
        idiomas_cat = nombres(IdiomaModel, 'nombre', ids['idioma'])

        def ref(valor, por_id):
            return {'id': valor, 'nombre': por_id.get(valor, '')} if valor else None

        return {
            'estudios': [
                {
                    **e, 'nivel_academico': ref(e.get('nivel_academico_id'), niveles), 'carrera': ref(e.get('carrera_id'), carreras),
                    'mencion': ref(e.get('mencion_id'), menciones), 'institucion': ref(e.get('institucion_id'), instituciones),
                } for e in estudios
            ],
            'cursos': [
                {**c, 'capacitacion': ref(c.get('capacitacion_id'), capacitaciones), 'institucion': ref(c.get('institucion_id'), instituciones)}
                for c in cursos
            ],
            'sin_cursos': bool(datos.get('sin_cursos')),
            'trabajo_antes_en_conatel': datos.get('trabajo_antes_en_conatel'),
            'antecedentes': [{**a, 'organismo': ref(a.get('organismo_id'), organismos)} for a in antecedentes],
            'sin_antecedentes': bool(datos.get('sin_antecedentes')),
            'idiomas': [
                {**i, 'nombre': idiomas_cat.get(i.get('idioma_id'), '') if i.get('idioma_id') else i.get('otro_idioma', '')}
                for i in idiomas
            ],
            'sin_idiomas': bool(datos.get('sin_idiomas')),
            'rif': datos.get('rif') or '',
            'familiares': [
                {
                    **f, 'parentesco': {'id': f.get('parentesco_id'), 'nombre': parentescos.get(f.get('parentesco_id'), '')},
                    'sexo': {'id': f.get('sexo_id'), 'nombre': sexos.get(f.get('sexo_id'), '')},
                }
                for f in datos.get('familiares') or []
            ],
            'sin_familiares': bool(datos.get('sin_familiares')),
            'vivienda': {
                **v,
                'condicion_vivienda': {'id': v.get('condicion_vivienda_id'), 'nombre': condiciones.get(v.get('condicion_vivienda_id'), '')},
                'estado': {'id': v.get('estado_id'), 'nombre': estado or ''},
                'municipio': {'id': v.get('municipio_id'), 'nombre': municipio or ''},
                'parroquia': {'id': v.get('parroquia_id'), 'nombre': parroquia or ''},
            } if v else {},
            'salud': {
                'grupo_sanguineo': {'id': s.get('grupo_sanguineo_id'), 'nombre': grupos.get(s.get('grupo_sanguineo_id'), '')},
                'alergias': lista(s.get('alergias'), alergias),
                'patologias_cronicas': lista(s.get('patologias_cronicas'), patologias),
                'discapacidades': lista(s.get('discapacidades'), discapacidades),
            } if s else {},
            'tallas': {
                'camisa': talla('talla_camisa_id'), 'pantalon': talla('talla_pantalon_id'),
                'calzado': talla('talla_zapatos_id'), 'chaqueta': talla('talla_chaqueta_id'),
            } if t else {},
        }
