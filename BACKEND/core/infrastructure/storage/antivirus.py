"""Adaptador opcional ClamAV (E2). Apagado por defecto."""
import socket
import struct

from django.conf import settings

from core.domain.exceptions import ValidationError


def escanear_contenido(contenido: bytes) -> None:
    """Envía el archivo por INSTREAM; falla cerrado si ClamAV no responde."""
    host = getattr(settings, 'CLAMAV_HOST', '')
    puerto = int(getattr(settings, 'CLAMAV_PORT', 3310) or 3310)
    if not host:
        return
    try:
        with socket.create_connection((host, puerto), timeout=5) as conexion:
            conexion.sendall(b'zINSTREAM\0')
            for inicio in range(0, len(contenido), 8192):
                bloque = contenido[inicio:inicio + 8192]
                conexion.sendall(struct.pack('!I', len(bloque)) + bloque)
            conexion.sendall(struct.pack('!I', 0))
            respuesta = conexion.recv(1024).decode('utf-8', errors='replace')
    except OSError as exc:
        raise ValidationError('El antivirus no está disponible; intente más tarde.') from exc
    if 'FOUND' in respuesta:
        raise ValidationError('El archivo fue rechazado por el antivirus.')
