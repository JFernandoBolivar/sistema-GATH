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
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CondicionViviendaModel,
    DiscapacidadModel,
    GrupoSanguineoModel,
    PatologiaCronicaModel,
    TallaModel,
)
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

        return {
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
