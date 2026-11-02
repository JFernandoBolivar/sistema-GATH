"""Repositorio ORM de parámetros del sistema y su historial de auditoría."""
from dataclasses import replace

from django.utils import timezone

from apps.configuracion.domain.entities.parametro import CambioParametro, ParametroSistema
from apps.configuracion.domain.parametros import (
    ACCION_PARAMETRO_ACTUALIZADO,
    DEFINICIONES,
    MODULO_AUDITORIA,
    RECURSO_AUDITORIA,
)
from apps.configuracion.infrastructure.mappers.mapper_parametros import parametro_a_entidad
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel
from core.infrastructure.models.auditoria import AuditoriaLog


class RepoParametrosORM:
    def listar(self) -> list[ParametroSistema]:
        """Solo lectura: las filas se siembran en la migración `configuracion.0003`.

        Si falta una fila (base antigua o clave nueva), se devuelve el valor por
        defecto de la definición **sin escribir**; el GET nunca crea filas.
        """
        existentes = {m.clave: m for m in ParametroSistemaModel.objects.all()}
        resultado: list[ParametroSistema] = []
        for definicion in DEFINICIONES:
            modelo = existentes.get(definicion.clave)
            if modelo is not None:
                resultado.append(replace(parametro_a_entidad(modelo), defecto=definicion.defecto))
                continue
            resultado.append(ParametroSistema(
                clave=definicion.clave,
                etiqueta=definicion.etiqueta,
                descripcion=definicion.descripcion,
                grupo=definicion.grupo,
                tipo=definicion.tipo,
                valor=definicion.defecto,
                defecto=definicion.defecto,
                minimo=definicion.minimo,
                maximo=definicion.maximo,
            ))
        return resultado

    def obtener(self, clave: str) -> ParametroSistema | None:
        modelo = ParametroSistemaModel.objects.filter(clave=clave).first()
        return parametro_a_entidad(modelo) if modelo is not None else None

    def guardar(self, parametro: ParametroSistema, actor_id: int | None) -> ParametroSistema:
        modelo, _ = ParametroSistemaModel.objects.update_or_create(
            clave=parametro.clave,
            defaults={
                'etiqueta': parametro.etiqueta,
                'descripcion': parametro.descripcion,
                'grupo': parametro.grupo,
                'tipo': parametro.tipo,
                'valor': parametro.valor,
                'valor_min': parametro.minimo,
                'valor_max': parametro.maximo,
                'actualizado_por_id': actor_id,
            },
        )
        return parametro_a_entidad(modelo)

    def historial(
        self, clave: str, limite: int, offset: int = 0
    ) -> tuple[list[CambioParametro], int]:
        qs = AuditoriaLog.objects.filter(
            modulo=MODULO_AUDITORIA,
            accion=ACCION_PARAMETRO_ACTUALIZADO,
            recurso_tipo=RECURSO_AUDITORIA,
            recurso_id=clave,
        ).order_by('-fecha_hora', '-id')
        total = qs.count()
        filas = qs[offset:offset + limite] if limite > 0 else qs[offset:]
        cambios = [
            CambioParametro(
                fecha=timezone.localtime(fila.fecha_hora).isoformat(),
                actor_cedula=fila.actor_cedula,
                valor_previo=str((fila.estado_previo or {}).get('valor', '')),
                valor_nuevo=str((fila.estado_nuevo or {}).get('valor', '')),
                resultado=fila.resultado,
            )
            for fila in filas
        ]
        return cambios, total
