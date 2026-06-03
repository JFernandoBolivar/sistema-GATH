# API: Códigos Postales por Estado

## Endpoint

```
GET /api/direccion/codigos_postales/<int:estadoid>/
```

## Parámetros

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `estadoid` | `int` (path) | ID del estado |

## Respuesta exitosa (200)

```json
{
    "status": "Ok",
    "message": "Códigos postales del estado DISTRITO CAPITAL",
    "data": [
        {
            "id": 1,
            "codigo": "1010",
            "estado_id": 10
        },
        {
            "id": 2,
            "codigo": "1020",
            "estado_id": 10
        }
    ]
}
```

## Error — Estado no encontrado (404)

```json
{
    "status": "Error",
    "message": "Estado no encontrado"
}
```

## Campos de `data`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `int` | ID del código postal |
| `codigo` | `string` | Código postal (4 dígitos) |
| `estado_id` | `int` | ID del estado al que pertenece |
