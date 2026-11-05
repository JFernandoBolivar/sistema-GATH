from typing import Protocol

CLAVES_CATALOGO = (
    'condiciones-vivienda', 'codigos-postales', 'niveles-academicos', 'carreras', 'menciones', 'instituciones',
    'capacitaciones', 'grupos-capacitacion', 'estados-civiles', 'grupos-sanguineos', 'alergias',
    'patologias', 'discapacidades', 'tallas-camisa', 'tallas-pantalon', 'tallas-zapatos',
    'tallas-chaqueta',
)


class RepoCatalogosLectura(Protocol):
    def listar(self, clave: str, padre_id: int | None) -> list[dict]:
        """Items `{id, nombre}` (+ `estado_id` en códigos postales) de un catálogo de referencia, solo lectura."""
        ...
