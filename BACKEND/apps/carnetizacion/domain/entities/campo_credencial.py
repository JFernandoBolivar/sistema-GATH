"""
Entidad de dominio: Campo de Credencial (O44 - E5).
Representa los datos autorizados del expediente y los campos personalizados
disponibles para incorporar en las plantillas de carnet.
"""
from dataclasses import dataclass
from typing import Literal

GrupoCampo = Literal[
    "identificacion",
    "laboral",
    "salud_emergencia",
    "emision",
    "personalizado",
]


# Origen del dato de un campo personalizado: lista CERRADA de datos reales del expediente.
# código -> etiqueta que ve el administrador al crear el campo.
ORIGENES_CAMPO_PERSONALIZADO: dict[str, str] = {
    "tipo_sangre": "Tipo de sangre",
    "telefono_movil": "Teléfono móvil",
    "correo_acceso": "Correo de acceso",
    "correo_alternativo": "Correo alternativo",
    "fecha_ingreso": "Fecha de ingreso",
    "nivel": "Nivel",
    "tipo_nomina": "Tipo de nómina",
    "sexo": "Sexo",
    "fecha_nacimiento": "Fecha de nacimiento",
    "nacionalidad": "Nacionalidad",
}


@dataclass(frozen=True)
class CampoCredencial:
    codigo: str
    etiqueta: str
    grupo: GrupoCampo
    tipo_credencial: str  # 'todos', 'trabajador', 'pasivo'
    sensible: bool
    es_personalizado: bool
    descripcion: str = ""
    valor_ejemplo: str = ""
    # Solo en campos personalizados: de dónde sale su valor al imprimir. Vacío = campo viejo sin origen.
    origen: str = ""


# Campos base autorizados del expediente institucional
CAMPOS_AUTORIZADOS_EXPEDIENTE: list[CampoCredencial] = [
    # Identificación
    CampoCredencial(
        codigo="nombre",
        etiqueta="Nombre y Apellido",
        grupo="identificacion",
        tipo_credencial="todos",
        sensible=False,
        es_personalizado=False,
        descripcion="Nombre completo del titular según expediente.",
        valor_ejemplo="Ana Sofía Pérez Luna",
    ),
    CampoCredencial(
        codigo="cedula",
        etiqueta="Cédula de Identidad",
        grupo="identificacion",
        tipo_credencial="todos",
        sensible=True,
        es_personalizado=False,
        descripcion="Documento de identidad nacional (V/E).",
        valor_ejemplo="V-16.778.340",
    ),
    CampoCredencial(
        codigo="nac",
        etiqueta="Fecha de Nacimiento",
        grupo="identificacion",
        tipo_credencial="todos",
        sensible=True,
        es_personalizado=False,
        descripcion="Fecha de nacimiento en formato dd/mm/aaaa.",
        valor_ejemplo="12/04/1985",
    ),
    CampoCredencial(
        codigo="correo",
        etiqueta="Correo Electrónico",
        grupo="identificacion",
        tipo_credencial="todos",
        sensible=True,
        es_personalizado=False,
        descripcion="Correo institucional o personal registrado.",
        valor_ejemplo="aperez@conatel.gob.ve",
    ),
    CampoCredencial(
        codigo="foto",
        etiqueta="Fotografía Oficial",
        grupo="identificacion",
        tipo_credencial="todos",
        sensible=False,
        es_personalizado=False,
        descripcion="Retrato oficial de frente fondo blanco.",
        valor_ejemplo="[Foto del titular]",
    ),
    # Datos Laborales
    CampoCredencial(
        codigo="cargo",
        etiqueta="Denominación del Cargo",
        grupo="laboral",
        tipo_credencial="trabajador",
        sensible=False,
        es_personalizado=False,
        descripcion="Cargo titular desempeñado por el empleado.",
        valor_ejemplo="Especialista en Telecomunicaciones",
    ),
    CampoCredencial(
        codigo="codigo",
        etiqueta="Código del Cargo / Empleado",
        grupo="laboral",
        tipo_credencial="trabajador",
        sensible=False,
        es_personalizado=False,
        descripcion="Identificador alfanumérico del cargo.",
        valor_ejemplo="A-0845",
    ),
    CampoCredencial(
        codigo="oficina",
        etiqueta="Oficina o Dependencia",
        grupo="laboral",
        tipo_credencial="todos",
        sensible=False,
        es_personalizado=False,
        descripcion="Unidad administrativa de adscripción.",
        valor_ejemplo="Oficina de Gestión Humana",
    ),
    CampoCredencial(
        codigo="nivel",
        etiqueta="Nivel Organizativo",
        grupo="laboral",
        tipo_credencial="todos",
        sensible=False,
        es_personalizado=False,
        descripcion="Nivel jerárquico dentro de la estructura institucional.",
        valor_ejemplo="Nivel de Apoyo",
    ),
    CampoCredencial(
        codigo="nomina",
        etiqueta="Tipo de Nómina / Situación",
        grupo="laboral",
        tipo_credencial="todos",
        sensible=False,
        es_personalizado=False,
        descripcion="Condición laboral: Fijo, Contratado, Jubilado o Pensionado.",
        valor_ejemplo="Empleado Fijo",
    ),
    CampoCredencial(
        codigo="ingreso",
        etiqueta="Fecha de Ingreso",
        grupo="laboral",
        tipo_credencial="trabajador",
        sensible=False,
        es_personalizado=False,
        descripcion="Fecha de ingreso a la administración pública.",
        valor_ejemplo="15/03/2018",
    ),
    # Salud y Emergencia (Sensibles)
    CampoCredencial(
        codigo="sangre",
        etiqueta="Tipo de Sangre",
        grupo="salud_emergencia",
        tipo_credencial="todos",
        sensible=True,
        es_personalizado=False,
        descripcion="Grupo sanguíneo y factor Rh del titular.",
        valor_ejemplo="O Rh+",
    ),
    CampoCredencial(
        codigo="alerg",
        etiqueta="Alergias y Condiciones",
        grupo="salud_emergencia",
        tipo_credencial="todos",
        sensible=True,
        es_personalizado=False,
        descripcion="Alergias severas o condiciones médicas relevantes para primeros auxilios.",
        valor_ejemplo="Alergia a Penicilina",
    ),
    CampoCredencial(
        codigo="emer",
        etiqueta="Contacto de Emergencia",
        grupo="salud_emergencia",
        tipo_credencial="todos",
        sensible=True,
        es_personalizado=False,
        descripcion="Nombre y número telefónico de contacto en caso de siniestro.",
        valor_ejemplo="Luis Pérez · 0414-555-0142",
    ),
    # Emisión
    CampoCredencial(
        codigo="emision",
        etiqueta="Fecha de Emisión",
        grupo="emision",
        tipo_credencial="todos",
        sensible=False,
        es_personalizado=False,
        descripcion="Fecha en que se imprime o expide el carnet.",
        valor_ejemplo="07/11/2026",
    ),
    CampoCredencial(
        codigo="vence",
        etiqueta="Fecha de Vencimiento",
        grupo="emision",
        tipo_credencial="todos",
        sensible=False,
        es_personalizado=False,
        descripcion="Fecha límite de vigencia de la credencial.",
        valor_ejemplo="07/11/2028",
    ),
]
