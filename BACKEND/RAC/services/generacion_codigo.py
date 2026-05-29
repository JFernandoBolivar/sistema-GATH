from ..models.personal_models import AsigTrabajo

STOP_WORDS = {'DE', 'LA', 'EL', 'Y', 'LOS', 'LAS', 'EN', 'PARA'}


def generar_prefijo_nomina(tipo_nomina):
    nombre = tipo_nomina.nomina.upper()
    palabras = [w for w in nombre.split() if w not in STOP_WORDS]
    if not palabras:
        raise ValueError("No se pudo generar un prefijo desde el nombre de la nómina.")
    return "".join([w[0] for w in palabras]) + "_"


def generador_codigos(prefix):
    prefijo = len(prefix)
    
    ultima_asignacion = AsigTrabajo.objects.filter(
        codigo__startswith = prefix
    ).order_by('-codigo').first()
    
    if not ultima_asignacion:
        siguiente_numero = 1
    else:
        ultimo_codigo = ultima_asignacion.codigo
        try:
            ultimo_numero_base = int(ultimo_codigo[prefijo:])
            siguiente_numero = ultimo_numero_base + 1
        except (ValueError, IndexError):
            siguiente_numero = 1
    
    numero_formateado = str(siguiente_numero).zfill(4)
    
    return f"{prefix}{numero_formateado}"