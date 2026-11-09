"""
Acciones del trabajador dentro de la ventana habilitada (B3): borrador, soportes y envío.
Zero-IDOR: la solicitud debe pertenecer a la cédula de la sesión (se responde 404, no 403).
"""
import hashlib
import uuid
from datetime import datetime

from apps.autogestion.application.dtos.actualizacion_dtos import ItemCambioDTO
from apps.autogestion.application.use_cases.solicitud_ciclo import exigir_version, obtener_solicitud
from apps.autogestion.domain.entities.solicitud_actualizacion import (
    CambioPropuesto,
    SoporteDocumental,
    SolicitudActualizacion,
)
from apps.autogestion.domain.events import EventoAutogestion, PublicadorEventos, TipoEvento
from apps.autogestion.domain.ports.ficha_trabajador import LectorFicha
from apps.autogestion.domain.ports.repo_soporte_configuracion import RepoSoporteConfiguracion
from apps.autogestion.domain.ports.repo_solicitudes import (
    RepoCambiosPropuestos,
    RepoSecciones,
    RepoSoportes,
    RepoSolicitudes,
)
from apps.autogestion.domain.services.politica_condicion import PoliticaAutogestion
from apps.autogestion.domain.services.validacion_cambios import (
    campos_permitidos,
    mismo_valor,
    validar_estructura,
    validar_motivo_eliminar,
    validar_registro_nuevo,
    validar_valor,
    validar_vivienda_condicional,
)
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from apps.autogestion.domain.value_objects.secciones import (
    CAMPO_ELIMINAR,
    CAMPO_REGISTRO_NUEVO,
    CAMPOS_IDENTIDAD_CON_CEDULA,
    DOCUMENTOS_EXIGIDOS,
    MAX_CONTACTOS_EMERGENCIA,
    ORIGEN_ACTUALIZACION,
    ENTIDADES_DE_LISTA,
    VERBO_ACCION,
    Accion,
    Seccion,
    TipoSoporte,
    acciones_solicitadas,
    clave_accion,
    clave_campo,
)
from core.domain.exceptions import NotFoundError, ValidationError
from core.domain.ports import FileStorage

MAX_SOPORTES_POR_SECCION = 10
MAX_CAMBIOS = 60


def obtener_solicitud_propia(repo: RepoSolicitudes, solicitud_id: str, cedula: str, bloquear: bool = False) -> SolicitudActualizacion:
    solicitud = obtener_solicitud(repo, solicitud_id, bloquear=bloquear)
    if solicitud.cedula != cedula:
        raise NotFoundError("La solicitud de actualización no existe.")  # no revela que existe
    return solicitud


def _exigir_accion_habilitada(solicitud: SolicitudActualizacion, entidad: str, accion: Accion) -> None:
    """En entidades de lista solo se admiten las acciones (agregar, corregir, quitar) que el trabajador pidió."""
    if entidad in ENTIDADES_DE_LISTA and accion.value not in acciones_solicitadas(entidad, solicitud.campos_habilitados):
        raise ValidationError(
            f"En esta solicitud no pidió {VERBO_ACCION[accion.value]} en '{entidad}': esa acción no está habilitada.",
            campo='accion',
        )


def _usa_acciones(solicitud: SolicitudActualizacion, entidad: str) -> bool:
    return any(clave_accion(entidad, a) in solicitud.campos_habilitados for a in Accion)


def _exigir_campo_habilitado(solicitud: SolicitudActualizacion, entidad: str, campo: str) -> None:
    """Decisión G: solo se edita lo que el trabajador pidió y Bienestar habilitó, campo por campo."""
    if _usa_acciones(solicitud, entidad):
        return  # pedida por acciones: todos los campos de la entidad quedan editables
    if clave_campo(entidad, campo) not in solicitud.campos_habilitados:
        raise ValidationError(f"El campo '{campo}' de '{entidad}' no fue solicitado ni habilitado en esta solicitud.")


def _preparar_cambio(item: ItemCambioDTO, solicitud: SolicitudActualizacion, lector: LectorFicha, ya_vistos: set) -> CambioPropuesto | None:
    if item.seccion == Seccion.FOTO.value:
        raise ValidationError("La foto se carga con el endpoint de soportes, no en el borrador.")
    if item.seccion not in solicitud.secciones_habilitadas:
        raise ValidationError(f"La sección '{item.seccion}' no está habilitada en esta ventana.")
    try:
        accion = Accion(item.accion)
    except ValueError:
        raise ValidationError(f"Acción inválida: '{item.accion}'.") from None
    entidad_id = str(item.entidad_id) if item.entidad_id not in (None, '') else None
    validar_estructura(item.seccion, item.entidad, accion, item.campo, entidad_id)
    _exigir_accion_habilitada(solicitud, item.entidad, accion)

    if accion is Accion.ELIMINAR:
        _exigir_entidad_habilitada(solicitud, item.seccion, item.entidad)
        if entidad_id is None or not lector.pertenece_al_trabajador(solicitud.cedula, item.entidad, entidad_id):
            raise NotFoundError(f"El registro {entidad_id} de '{item.entidad}' no pertenece al trabajador.")
        motivo = validar_motivo_eliminar(item.valor)
        clave = (item.entidad, entidad_id, CAMPO_ELIMINAR)
        if clave in ya_vistos:
            raise ValidationError(f"Ya propuso quitar el registro {entidad_id} de '{item.entidad}'.")
        ya_vistos.add(clave)
        return CambioPropuesto(
            id='', origen_tipo=ORIGEN_ACTUALIZACION, origen_id=solicitud.id, seccion=item.seccion,
            accion=accion.value, entidad_destino=item.entidad, entidad_id=entidad_id, campo=CAMPO_ELIMINAR,
            valor_anterior=lector.datos_registro(solicitud.cedula, item.entidad, entidad_id),
            valor_propuesto={'motivo': motivo},
        )

    if accion is Accion.CREAR:
        pais_id = None
        if item.entidad == 'datos_vivienda' and isinstance(item.valor, dict):
            pais_id = item.valor.get('pais_id')
        es_venezuela = getattr(lector, 'es_pais_venezuela', lambda _pais: True)(pais_id)
        valor = validar_registro_nuevo(
            item.seccion, item.entidad, item.valor, es_venezuela=es_venezuela,
        )
        for campo in valor:
            _exigir_campo_habilitado(solicitud, item.entidad, campo)
        lector.validar_referencias(valor)
        if item.entidad == 'familiar':
            lector.validar_familiar_alta(solicitud.cedula, valor)
        referencia = (item.referencia or '').strip() or None
        if referencia is not None and len(referencia) > 64:
            raise ValidationError("La referencia del registro nuevo es demasiado larga.")
        clave = (item.entidad, None, CAMPO_REGISTRO_NUEVO, referencia or str(sorted(valor.items())))
        anterior = None
    else:
        _exigir_campo_habilitado(solicitud, item.entidad, item.campo)
        if entidad_id is not None and not lector.pertenece_al_trabajador(solicitud.cedula, item.entidad, entidad_id):
            raise NotFoundError(f"El registro {entidad_id} de '{item.entidad}' no pertenece al trabajador.")
        if item.entidad == 'datos_vivienda' and not lector.existe_registro_unico(solicitud.cedula, item.entidad):
            raise ValidationError("No hay vivienda registrada: proponga el registro completo con acción CREAR.")
        valor = validar_valor(item.campo, item.valor)
        if item.campo == 'correo_alternativo' and valor:
            validador_alt = getattr(lector, 'validar_correo_alternativo', None)
            if callable(validador_alt):
                validador_alt(solicitud.cedula, valor)
        if item.entidad == 'familiar' and item.campo == 'cedula_familiar' and not valor:
            raise ValidationError('La cédula del familiar es obligatoria.', campo='cedula_familiar')
        lector.validar_referencias({item.campo: valor})
        anterior = lector.valor_actual(solicitud.cedula, item.entidad, entidad_id, item.campo)
        if mismo_valor(item.campo, valor, anterior):
            return None  # sin diferencia real: no se propone
        referencia = None
        clave = (item.entidad, entidad_id, item.campo)
    if clave in ya_vistos:
        raise ValidationError(f"Cambio repetido para '{item.entidad}.{item.campo}'.")
    ya_vistos.add(clave)
    return CambioPropuesto(
        id='', origen_tipo=ORIGEN_ACTUALIZACION, origen_id=solicitud.id, seccion=item.seccion,
        accion=accion.value, entidad_destino=item.entidad, entidad_id=entidad_id, campo=item.campo,
        valor_anterior=anterior, valor_propuesto=valor, referencia=referencia,
    )


def _exigir_entidad_habilitada(solicitud: SolicitudActualizacion, seccion: str, entidad: str) -> None:
    """Para QUITAR basta con que se haya habilitado al menos un campo de la entidad."""
    permitidos = campos_permitidos(seccion, entidad)
    if not _usa_acciones(solicitud, entidad) and not any(
        clave_campo(entidad, c) in solicitud.campos_habilitados for c in permitidos
    ):
        raise ValidationError(
            f"Ningún campo de '{entidad}' fue solicitado ni habilitado en esta solicitud."
        )


def guardar_borrador(
    repo: RepoSolicitudes, repo_cambios: RepoCambiosPropuestos, lector: LectorFicha,
    *, solicitud_id: str, cedula: str, items: list[ItemCambioDTO], version: int | None, ahora: datetime,
    politica: PoliticaAutogestion | None = None,
) -> SolicitudActualizacion:
    """Reemplaza el borrador (salvo la foto, que se gestiona por soportes). Repetible mientras dure la ventana."""
    solicitud = obtener_solicitud_propia(repo, solicitud_id, cedula, bloquear=True)
    solicitud.exigir_ventana_vigente(ahora)
    exigir_version(solicitud, version)
    if politica is not None:
        # La ventana ya existe: no se re-evalúa el interruptor general, solo que las
        # secciones tocadas sigan permitidas para la condición (O12).
        politica.exigir_secciones({item.seccion for item in items if item.seccion})
    if len(items) > MAX_CAMBIOS:
        raise ValidationError(f"Máximo {MAX_CAMBIOS} cambios por solicitud.")
    vistos: set = set()
    cambios = [c for c in (_preparar_cambio(i, solicitud, lector, vistos) for i in items) if c is not None]
    _validar_familiares_agrupados(solicitud.cedula, cambios, lector)
    _validar_limite_contactos(solicitud.cedula, cambios, lector)
    _validar_vivienda_del_borrador(solicitud.cedula, cambios, lector)
    repo_cambios.reemplazar(ORIGEN_ACTUALIZACION, solicitud.id, cambios, conservar_secciones=(Seccion.FOTO.value,))
    return repo.guardar(solicitud, solicitud.version)  # sube la versión: el borrador cambió


_CAMPOS_FAMILIAR_DEPENDIENTES = frozenset({
    'parentesco_id', 'fecha_nacimiento', 'sexo_id', 'cedula_familiar',
})


def _validar_familiares_agrupados(
    cedula: str, cambios: list[CambioPropuesto], lector: LectorFicha,
) -> None:
    """FIX-FAM2: valida el estado final de cada familiar con todos sus cambios juntos.

    Validar cada campo aislado contra el dato guardado rechaza combinaciones válidas
    (p. ej. cambiar a MADRE y corregir su fecha de nacimiento en el mismo guardado).
    """
    validador = getattr(lector, 'validar_familiar_cambio', None)
    if not callable(validador):
        return
    grupos: dict[str, dict] = {}
    for cambio in cambios:
        if (
            cambio.accion != Accion.MODIFICAR.value
            or cambio.entidad_destino != 'familiar'
            or cambio.entidad_id in (None, '')
            or cambio.campo not in _CAMPOS_FAMILIAR_DEPENDIENTES
        ):
            continue
        grupos.setdefault(str(cambio.entidad_id), {})[cambio.campo] = cambio.valor_propuesto
    for entidad_id, valores in grupos.items():
        validador(cedula, entidad_id, valores)


_CAMPOS_VIVIENDA = (
    'pais_id', 'ciudad_region', 'estado_id', 'municipio_id', 'parroquia_id',
    'direccion_exacta', 'condicion_vivienda_id', 'codigo_postal_id',
)


def _validar_vivienda_del_borrador(
    cedula: str, cambios: list[CambioPropuesto], lector: LectorFicha,
) -> None:
    """O40: valida el estado final de la vivienda, no cada campo por separado.

    El trabajador puede cambiar el país y vaciar la ubicación venezolana en
    cambios distintos del mismo borrador; la regla solo tiene sentido sobre el
    registro resultante.
    """
    de_vivienda = [c for c in cambios if c.entidad_destino == 'datos_vivienda']
    if not de_vivienda:
        return
    if lector.existe_registro_unico(cedula, 'datos_vivienda'):
        valores = {
            campo: lector.valor_actual(cedula, 'datos_vivienda', None, campo)
            for campo in _CAMPOS_VIVIENDA
        }
    else:
        valores = {}
    for cambio in de_vivienda:
        if cambio.accion in (Accion.CREAR.value, Accion.MODIFICAR.value):
            if isinstance(cambio.valor_propuesto, dict):
                valores.update(cambio.valor_propuesto)
    limpios = {k: v for k, v in valores.items() if v not in (None, '')}
    es_venezuela = getattr(lector, 'es_pais_venezuela', lambda _pais: True)(
        limpios.get('pais_id'),
    )
    validar_vivienda_condicional(limpios, es_venezuela)


def _validar_limite_contactos(cedula: str, cambios: list[CambioPropuesto], lector: LectorFicha) -> None:
    """El trabajador no puede quedar con más de `MAX_CONTACTOS_EMERGENCIA` contactos."""
    del_contacto = [
        c for c in cambios if c.entidad_destino == 'contacto_emergencia' and c.accion == Accion.ELIMINAR.value
    ]
    nuevos = [
        c for c in cambios if c.entidad_destino == 'contacto_emergencia' and c.accion == Accion.CREAR.value
    ]
    if not del_contacto and not nuevos:
        return
    vigentes = lector.contar_registros(cedula, 'contacto_emergencia')
    if vigentes - len(del_contacto) + len(nuevos) > MAX_CONTACTOS_EMERGENCIA:
        raise ValidationError(
            f"Puede registrar como máximo {MAX_CONTACTOS_EMERGENCIA} contactos de emergencia."
        )


def adjuntar_soporte(
    repo: RepoSolicitudes, repo_soportes: RepoSoportes, repo_cambios: RepoCambiosPropuestos,
    lector: LectorFicha, almacen: FileStorage, repo_soporte_config: RepoSoporteConfiguracion,
    *, solicitud_id: str, cedula: str, seccion: str, tipo: str, contenido: bytes, mime: str,
    extension: str, nombre_original: str, ahora: datetime,
    entidad_id: str | None = None, referencia: str | None = None,
) -> SoporteDocumental:
    """Sube el soporte (o la foto) a SeaweedFS y lo vincula a la sección. La foto crea el cambio `profile`."""
    solicitud = obtener_solicitud_propia(repo, solicitud_id, cedula, bloquear=True)
    solicitud.exigir_ventana_vigente(ahora)
    if seccion not in solicitud.secciones_habilitadas:
        raise ValidationError(f"La sección '{seccion}' no está habilitada en esta ventana.")
    permitidos = [fila for fila in repo_soporte_config.checklist_de_seccion(seccion) if fila.permitido]
    tipo_permitido = next((fila for fila in permitidos if fila.codigo == tipo), None)
    if tipo_permitido is None:
        if permitidos:
            validos = ', '.join(sorted(fila.codigo for fila in permitidos))
            raise ValidationError(f"Tipo de soporte no permitido para '{seccion}'. Use: {validos}.")
        raise ValidationError(f"La sección '{seccion}' no admite soportes documentales.")
    existentes = [s for s in repo_soportes.listar(ORIGEN_ACTUALIZACION, solicitud.id) if s.seccion == seccion]
    es_foto = seccion == Seccion.FOTO.value
    if es_foto:
        for previo in existentes:  # una sola foto vigente: reemplaza la anterior
            repo_soportes.eliminar(previo.id)
            almacen.eliminar(previo.clave_s3)
        repo_cambios.eliminar_de_seccion(ORIGEN_ACTUALIZACION, solicitud.id, seccion)
    elif len(existentes) >= MAX_SOPORTES_POR_SECCION:
        raise ValidationError(f"Máximo {MAX_SOPORTES_POR_SECCION} soportes por sección.")

    clave = f"autogestion/soportes/{cedula}/{solicitud.id}/{uuid.uuid4().hex}{extension}"
    almacen.subir(clave, contenido, mime)
    soporte = repo_soportes.agregar(SoporteDocumental(
        id='', origen_tipo=ORIGEN_ACTUALIZACION, origen_id=solicitud.id, seccion=seccion, tipo=tipo_permitido.codigo,
        clave_s3=clave, mime_real=mime, tamano_bytes=len(contenido), sha256=hashlib.sha256(contenido).hexdigest(),
        nombre_original=(nombre_original or '')[:200], subido_por=cedula,
        entidad_id=(entidad_id or None), referencia=(referencia or None),
    ))
    if es_foto:
        repo_cambios.guardar(CambioPropuesto(
            id='', origen_tipo=ORIGEN_ACTUALIZACION, origen_id=solicitud.id, seccion=seccion,
            accion=Accion.MODIFICAR.value, entidad_destino='employee', campo='profile',
            valor_anterior=lector.valor_actual(cedula, 'employee', None, 'profile'),
            valor_propuesto={'soporte_id': soporte.id},
        ))
    return soporte


def eliminar_soporte(
    repo: RepoSolicitudes, repo_soportes: RepoSoportes, repo_cambios: RepoCambiosPropuestos, almacen: FileStorage,
    *, solicitud_id: str, soporte_id: str, cedula: str, ahora: datetime,
) -> None:
    """Quita el soporte del borrador y borra su objeto del almacén (sin dejar huérfanos)."""
    solicitud = obtener_solicitud_propia(repo, solicitud_id, cedula, bloquear=True)
    solicitud.exigir_ventana_vigente(ahora)
    soporte = repo_soportes.obtener(soporte_id)
    if soporte is None or soporte.origen_id != solicitud.id:
        raise NotFoundError("El soporte no existe.")
    repo_soportes.eliminar(soporte_id)
    if soporte.seccion == Seccion.FOTO.value:
        repo_cambios.eliminar_de_seccion(ORIGEN_ACTUALIZACION, solicitud.id, soporte.seccion)
    almacen.eliminar(soporte.clave_s3)  # al final: si el almacén falla (503) se revierte toda la operación


def enviar_solicitud(
    repo: RepoSolicitudes, repo_cambios: RepoCambiosPropuestos, repo_soportes: RepoSoportes,
    repo_secciones: RepoSecciones, publicador: PublicadorEventos, lector: LectorFicha,
    *, solicitud_id: str, cedula: str, version: int | None, ahora: datetime,
    politica: PoliticaAutogestion | None = None,
) -> SolicitudActualizacion:
    """Cierra la ventana: valida que haya cambios y los soportes obligatorios de cada sección con cambios."""
    solicitud = obtener_solicitud_propia(repo, solicitud_id, cedula, bloquear=True)
    exigir_version(solicitud, version)
    enviada = solicitud.enviar(ahora)  # valida estado y que la ventana siga vigente
    cambios = repo_cambios.listar(ORIGEN_ACTUALIZACION, solicitud.id)
    if not cambios:
        raise ValidationError("No hay cambios que enviar. Guarde al menos un cambio en el borrador.")
    if politica is not None:
        politica.exigir_secciones({c.seccion for c in cambios})
    for c in cambios:
        _exigir_accion_habilitada(solicitud, c.entidad_destino, Accion(c.accion))
        if c.campo == 'correo_alternativo' and c.valor_propuesto:
            validador_alt = getattr(lector, 'validar_correo_alternativo', None)
            if callable(validador_alt):
                validador_alt(cedula, str(c.valor_propuesto))
    soportes = repo_soportes.listar(ORIGEN_ACTUALIZACION, solicitud.id)
    con_soporte = {s.seccion for s in soportes}
    exigen = {s.codigo for s in repo_secciones.listar(solo_activas=False) if s.requiere_soporte}
    # QUITAR no exige documento: solo cuentan las secciones con altas o correcciones.
    con_cambio_documentado = {c.seccion for c in cambios if c.accion != Accion.ELIMINAR.value}
    faltan = sorted(con_cambio_documentado & exigen - con_soporte)
    if faltan:
        raise ValidationError(f"Falta el soporte obligatorio en: {', '.join(faltan)}.")
    _validar_documentos_por_registro(cambios, soportes, lector)
    guardada = repo.guardar(enviada, solicitud.version)
    reenvio = solicitud.estado is EstadoSolicitud.DEVUELTA
    publicador.publicar(EventoAutogestion(
        TipoEvento.CORRECCION_REENVIADA if reenvio else TipoEvento.SOLICITUD_ENVIADA,
        solicitud.id, solicitud.cedula, cedula,
        {'secciones': sorted({c.seccion for c in cambios}), 'cambios': len(cambios), 'fecha': ahora.isoformat()},
    ))
    return guardada


def _soportes_del_cambio(cambio: CambioPropuesto, soportes: list[SoporteDocumental]) -> list[SoporteDocumental]:
    """Soportes asociados al registro concreto (por id o por la referencia temporal del nuevo)."""
    propios = [
        s for s in soportes
        if s.seccion == cambio.seccion and (
            (cambio.entidad_id and s.entidad_id == cambio.entidad_id)
            or (cambio.referencia and s.referencia == cambio.referencia)
        )
    ]
    if propios:
        return propios
    # Registros únicos (sin id): su documento es el soporte de sección (p. ej. la copia de cédula).
    if cambio.entidad_id is None and cambio.referencia is None:
        return [s for s in soportes if s.seccion == cambio.seccion and not s.entidad_id and not s.referencia]
    # Compatibilidad: un soporte de sección sin registro solo respalda altas (CREAR).
    if cambio.accion == Accion.CREAR.value:
        return [s for s in soportes if s.seccion == cambio.seccion and not s.entidad_id and not s.referencia]
    return []


def _documentos_exigidos(cambio: CambioPropuesto, lector: LectorFicha) -> list[frozenset[TipoSoporte]]:
    """Tipos de documento que respaldan este cambio (cada elemento exige al menos un soporte)."""
    if cambio.accion == Accion.ELIMINAR.value:
        return []
    if cambio.seccion == Seccion.IDENTIDAD.value and cambio.campo in CAMPOS_IDENTIDAD_CON_CEDULA:
        return [frozenset({TipoSoporte.CEDULA})]
    if cambio.entidad_destino == 'familiar':
        valores = cambio.valor_propuesto if isinstance(cambio.valor_propuesto, dict) else {}
        exigidos: list[frozenset[TipoSoporte]] = []
        es_hijo = lector.es_parentesco_hijo(valores.get('parentesco_id')) if cambio.accion == Accion.CREAR.value \
            else (cambio.campo == 'parentesco_id' and lector.es_parentesco_hijo(valores))
        if cambio.accion == Accion.CREAR.value:
            if es_hijo:
                exigidos.append(frozenset({TipoSoporte.ACTA_NACIMIENTO}))
            if valores.get('cedula_familiar'):
                exigidos.append(frozenset({TipoSoporte.CEDULA}))
            if not exigidos:
                exigidos.append(frozenset({TipoSoporte.ACTA_NACIMIENTO, TipoSoporte.CONSTANCIA}))
        elif cambio.campo == 'cedula_familiar':
            exigidos.append(frozenset({TipoSoporte.CEDULA}))
        elif cambio.campo == 'parentesco_id':
            exigidos.append(frozenset(
                {TipoSoporte.ACTA_NACIMIENTO} if es_hijo
                else {TipoSoporte.CONSTANCIA, TipoSoporte.OTRO}
            ))
        return exigidos
    tipos = DOCUMENTOS_EXIGIDOS.get((cambio.entidad_destino, cambio.accion))
    return [tipos] if tipos else []


def _validar_documentos_por_registro(
    cambios: list[CambioPropuesto], soportes: list[SoporteDocumental], lector: LectorFicha,
) -> None:
    """Cada cambio que lo exige debe tener su documento (por registro, con respaldo por sección)."""
    faltantes: list[str] = []
    for cambio in cambios:
        for tipos in _documentos_exigidos(cambio, lector):
            propios = _soportes_del_cambio(cambio, soportes)
            if not any(s.tipo in tipos for s in propios):
                nombres = ', '.join(sorted(t.value for t in tipos))
                registro = cambio.entidad_id or cambio.referencia or 'nuevo'
                faltantes.append(f"{cambio.entidad_destino} ({registro}): {nombres}")
    if faltantes:
        raise ValidationError(
            "Falta el documento que respalde: " + '; '.join(sorted(set(faltantes))) + '.'
        )
