"""
Lector del puerto `LectorConfiguracion` (D9): valor vigente de la tabla o, si la
fila aún no existe, el valor por defecto de la definición del parámetro.
"""
from apps.configuracion.domain.parametros import (
    DEFINICIONES_POR_CLAVE,
    definicion_de,
)
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel
from core.domain.configuracion import como_booleano, como_entero


class LectorConfiguracionORM:
    def _valor(self, clave: str) -> str:
        fila = ParametroSistemaModel.objects.filter(clave=clave).values_list('valor', flat=True).first()
        if fila is not None:
            return fila
        definicion = DEFINICIONES_POR_CLAVE.get(clave)
        return definicion.defecto if definicion is not None else ''

    def obtener_texto(self, clave: str) -> str:
        return self._valor(clave)

    def obtener_booleano(self, clave: str) -> bool:
        definicion = definicion_de(clave)
        return como_booleano(self._valor(clave), como_booleano(definicion.defecto, False))

    def obtener_entero(self, clave: str) -> int:
        definicion = definicion_de(clave)
        return como_entero(self._valor(clave), como_entero(definicion.defecto, 0))
