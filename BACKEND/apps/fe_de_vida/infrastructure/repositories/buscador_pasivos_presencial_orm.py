"""Adaptador ORM para búsqueda de pasivos en fe de vida presencial (D-09, B16)."""
from django.db.models import Exists, Q, Subquery

from apps.fe_de_vida.domain.entities.pasivo import PasivoPresencialCandidato
from apps.fe_de_vida.domain.ports.repos import BuscadorPasivosPresencial
from apps.fe_de_vida.infrastructure.repositories.pasivos_vigentes import (
    asignaciones_pasivas,
    excluir_egresados,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel


class BuscadorPasivosPresencialORM(BuscadorPasivosPresencial):
    def buscar(self, texto: str, limite: int, desplazamiento: int) -> tuple[list[PasivoPresencialCandidato], int]:
        texto = texto.strip()
        pasivas = asignaciones_pasivas()
        qs = excluir_egresados(
            EmployeeModel.objects.filter(Exists(pasivas)), pasivas,
        ).annotate(
            tipo_nomina=Subquery(pasivas.values('tiponominaid__nomina')[:1]),
        )

        nombre_q = EmployeeModel.objects.all()
        for palabra in texto.split():
            nombre_q = nombre_q.filter(Q(nombres__icontains=palabra) | Q(apellidos__icontains=palabra))
        qs = qs.filter(Q(cedulaidentidad__icontains=texto) | Q(pk__in=nombre_q.values('pk'))).order_by('apellidos', 'nombres')

        total = qs.count()
        empleados = list(qs.select_related('cuenta')[desplazamiento:desplazamiento + limite])

        candidatos = [
            PasivoPresencialCandidato(
                cedula=emp.cedulaidentidad,
                nombre_completo=f'{emp.nombres} {emp.apellidos}'.strip(),
                tipo_nomina=emp.tipo_nomina or '',
                correo=emp.correo or '',
                tiene_cuenta=hasattr(emp, 'cuenta'),
            )
            for emp in empleados
        ]
        return candidatos, total
