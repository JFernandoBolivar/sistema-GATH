"""
Mixins de serializer transversales (R-02, B2.2).

`CleanZerosMixin` vivía duplicado/importado de facto desde
`RAC/utils/data_formatters.py` y era consumido por serializers de `RAC` y
`USER` (7 serializers en 2 apps). Se traslada aquí porque lo comparten
múltiples módulos (regla B16: lo transversal vive en `core/`), sin cambiar
una sola línea de su comportamiento.

El legado `RAC`/`USER` fue retirado (Fase 8), así que el re-export de
compatibilidad hacia atrás ya no existe; esta es la única fuente del mixin.
"""


class CleanZerosMixin:
    """
    Normaliza a `None` los valores "vacíos" (`0`, `"0"`, `"None"`, `None`,
    `"undefined"`, `"null"`, `""`) de un payload de escritura antes de que
    DRF lo valide, de forma recursiva sobre dicts y listas.
    """

    def to_internal_value(self, data):
        def limpiar_recursivo(item):
            if isinstance(item, dict):
                nuevo_dict = {}
                for k, v in item.items():
                    if v in [0, "0", "None", None, "undefined", "null", ""]:
                        nuevo_dict[k] = None
                    else:
                        nuevo_dict[k] = limpiar_recursivo(v)
                return nuevo_dict

            elif isinstance(item, list):
                return [limpiar_recursivo(i) for i in item if i]

            return item

        data_limpia = limpiar_recursivo(data)
        return super().to_internal_value(data_limpia)
