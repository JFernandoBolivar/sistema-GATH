"""Vistas DRF para Eventos, Invitados, Emisión y Control de Entrada con QR (O45-B)."""
import csv
import io
import json
from datetime import datetime

from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.domain.paginacion import Paginacion
from core.infrastructure.pdf.report_excel import generar_reporte_excel
from core.infrastructure.storage.validacion_archivo import MAX_BYTES_DOCUMENTO
from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasAnyPermission, HasPermission
from apps.carnetizacion.application.dtos.evento_dtos import (
    CheckInRequestDTO,
    EventoCrearDTO,
    InvitadoCrearDTO,
)
from apps.carnetizacion.application.use_cases.control_entrada_evento import (
    ControlEntradaEventoUseCase,
)
from apps.carnetizacion.application.use_cases.emitir_credencial_evento import (
    EmitirCredencialesEventoUseCase,
    EnviarCredencialesCorreoUseCase,
)
from apps.carnetizacion.application.use_cases.gestionar_eventos import (
    ActualizarEventoUseCase,
    CrearCategoriaEventoUseCase,
    CrearEventoUseCase,
    CrearZonaEventoUseCase,
    ListarEventosUseCase,
    ObtenerEventoDetalleUseCase,
)
from apps.carnetizacion.application.use_cases.gestionar_invitados import (
    ActualizarInvitadoUseCase,
    CrearInvitadoUseCase,
    ImportarInvitadosUseCase,
    ListarIdsInvitadosUseCase,
    ListarInvitadosPaginadoUseCase,
)
from apps.carnetizacion.application.use_cases.obtener_panel_evento import (
    ObtenerPanelEventoUseCase,
)
from apps.carnetizacion.infrastructure.pdf.evento_pdf import (
    generar_gafete_evento_pdf,
    generar_lote_gafetes_evento_pdf,
)
from apps.carnetizacion.infrastructure.repositories.repo_eventos_orm import (
    RepoEventosORM,
)
from apps.carnetizacion.presentation.serializers.evento_serializers import (
    CheckInRequestSerializer,
    CheckInResponseSerializer,
    EmitirCredencialesLoteSerializer,
    EnviarCredencialesCorreoSerializer,
    EventoActualizarSerializer,
    EventoCategoriaSerializer,
    EventoCrearSerializer,
    EventoInvitadoSerializer,
    EventoSerializer,
    EventoZonaSerializer,
    ImportarInvitadosRequestSerializer,
    InvitadoCrearSerializer,
    PanelEventoSerializer,
    ResumenImportacionSerializer,
)


class EventosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.eventos")]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Listar eventos configurados",
        parameters=[
            OpenApiParameter("estado", str, required=False),
            OpenApiParameter("busqueda", str, required=False),
        ],
        responses={200: EventoSerializer(many=True)},
    )
    def get(self, request):
        repo = RepoEventosORM()
        estado = request.query_params.get("estado")
        busqueda = request.query_params.get("busqueda")
        eventos = ListarEventosUseCase(repo).ejecutar(estado=estado, busqueda=busqueda)
        return ok(EventoSerializer(eventos, many=True).data)

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Crear nuevo evento con categorías y zonas",
        request=EventoCrearSerializer,
        responses={201: EventoSerializer},
    )
    def post(self, request):
        serializer = EventoCrearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        dto = EventoCrearDTO(
            nombre=datos["nombre"],
            lugar=datos["lugar"],
            fecha_inicio=datos["fecha_inicio"],
            fecha_fin=datos["fecha_fin"],
            descripcion=datos.get("descripcion", ""),
            plantilla_id=datos.get("plantilla_id"),
            categorias=datos.get("categorias", []),
            zonas=datos.get("zonas", []),
        )

        repo = RepoEventosORM()
        creado_por_id = getattr(request.user, "id", None)
        evento = CrearEventoUseCase(repo).ejecutar(dto, creado_por_id=creado_por_id)
        return ok(EventoSerializer(evento).data, status=201)


class EventoDetalleView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.eventos")]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Obtener detalle de un evento",
        responses={200: EventoSerializer},
    )
    def get(self, request, pk: str):
        repo = RepoEventosORM()
        evento = ObtenerEventoDetalleUseCase(repo).ejecutar(str(pk))
        if not evento:
            return fail("Evento no encontrado", status=404)
        return ok(EventoSerializer(evento).data)

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Actualizar información de un evento",
        request=EventoActualizarSerializer,
        responses={200: EventoSerializer},
    )
    def put(self, request, pk: str):
        serializer = EventoActualizarSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        repo = RepoEventosORM()
        evento = ActualizarEventoUseCase(repo).ejecutar(str(pk), serializer.validated_data)
        if not evento:
            return fail("Evento no encontrado", status=404)
        return ok(EventoSerializer(evento).data)

    def patch(self, request, pk: str):
        return self.put(request, pk)


class EventoCategoriasView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.eventos")]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Listar categorías de un evento",
        responses={200: EventoCategoriaSerializer(many=True)},
    )
    def get(self, request, evento_id: str):
        repo = RepoEventosORM()
        cats = repo.listar_categorias(str(evento_id))
        return ok(EventoCategoriaSerializer(cats, many=True).data)

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Crear categoría en un evento",
        request=EventoCategoriaSerializer,
        responses={201: EventoCategoriaSerializer},
    )
    def post(self, request, evento_id: str):
        repo = RepoEventosORM()
        nombre = request.data.get("nombre", "").strip()
        color_primario = request.data.get("color_primario", "#0B4A9E")
        color_acento = request.data.get("color_acento", "#F59E0B")
        orden = int(request.data.get("orden", 1))

        if not nombre:
            return fail("El nombre de categoría es obligatorio", status=400)

        cat = CrearCategoriaEventoUseCase(repo).ejecutar(
            str(evento_id), nombre, color_primario, color_acento, orden
        )
        return ok(EventoCategoriaSerializer(cat).data, status=201)


class EventoZonasView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.eventos")]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Listar zonas de un evento",
        responses={200: EventoZonaSerializer(many=True)},
    )
    def get(self, request, evento_id: str):
        repo = RepoEventosORM()
        zonas = repo.listar_zonas(str(evento_id))
        return ok(EventoZonaSerializer(zonas, many=True).data)

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Crear zona en un evento",
        request=EventoZonaSerializer,
        responses={201: EventoZonaSerializer},
    )
    def post(self, request, evento_id: str):
        repo = RepoEventosORM()
        nombre = request.data.get("nombre", "").strip()
        codigo = request.data.get("codigo", "").strip()
        orden = int(request.data.get("orden", 1))

        if not nombre:
            return fail("El nombre de zona es obligatorio", status=400)

        zona = CrearZonaEventoUseCase(repo).ejecutar(str(evento_id), nombre, codigo, orden)
        return ok(EventoZonaSerializer(zona).data, status=201)


class EventoInvitadosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.eventos")]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Listar invitados de un evento (paginado)",
        parameters=[
            OpenApiParameter("pagina", int, required=False),
            OpenApiParameter("page_size", int, required=False),
            OpenApiParameter("categoria_id", str, required=False),
            OpenApiParameter("zona_id", str, required=False),
            OpenApiParameter("estado", str, required=False),
            OpenApiParameter("busqueda", str, required=False),
        ],
    )
    def get(self, request, evento_id: str):
        """`?pagina=`, `?page_size=` (10 por defecto, tope 50) y los filtros; responde
        `{resultados, total, pagina, tamano, total_paginas}`."""
        paginacion = Paginacion.desde_parametros(request.query_params.dict())
        invitados, total = ListarInvitadosPaginadoUseCase(RepoEventosORM()).ejecutar(
            str(evento_id),
            paginacion.offset,
            paginacion.tamano,
            categoria_id=request.query_params.get("categoria_id"),
            zona_id=request.query_params.get("zona_id"),
            estado=request.query_params.get("estado"),
            busqueda=request.query_params.get("busqueda"),
        )
        return ok(paginacion.envolver(EventoInvitadoSerializer(invitados, many=True).data, total))

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Crear invitado individual en un evento",
        request=InvitadoCrearSerializer,
        responses={201: EventoInvitadoSerializer},
    )
    def post(self, request, evento_id: str):
        serializer = InvitadoCrearSerializer(data={**request.data, "evento_id": str(evento_id)})
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        dto = InvitadoCrearDTO(
            evento_id=str(evento_id),
            nombre_completo=datos["nombre_completo"],
            categoria_id=str(datos["categoria_id"]),
            zona_id=str(datos["zona_id"]),
            documento_identidad=datos.get("documento_identidad", ""),
            organizacion=datos.get("organizacion", ""),
            correo=datos.get("correo", ""),
            telefono=datos.get("telefono", ""),
            mesa=datos.get("mesa", ""),
            es_acompanante=datos.get("es_acompanante", False),
            trabajador_titular_id=datos.get("trabajador_titular_id"),
            observaciones=datos.get("observaciones", ""),
        )

        repo = RepoEventosORM()
        invitado = CrearInvitadoUseCase(repo).ejecutar(dto)
        return ok(EventoInvitadoSerializer(invitado).data, status=201)


class EventoInvitadosIdsView(APIView):
    """Ids de todos los invitados del filtro, sin paginar: alimenta la selección masiva."""

    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.eventos")]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Ids de los invitados de un evento que cumplen el filtro",
        parameters=[
            OpenApiParameter("categoria_id", str, required=False),
            OpenApiParameter("zona_id", str, required=False),
            OpenApiParameter("estado", str, required=False),
            OpenApiParameter("busqueda", str, required=False),
        ],
    )
    def get(self, request, evento_id: str):
        ids = ListarIdsInvitadosUseCase(RepoEventosORM()).ejecutar(
            str(evento_id),
            categoria_id=request.query_params.get("categoria_id"),
            zona_id=request.query_params.get("zona_id"),
            estado=request.query_params.get("estado"),
            busqueda=request.query_params.get("busqueda"),
        )
        return ok({"ids": ids, "total": len(ids)})


class EventoInvitadoDetalleView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.eventos")]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Actualizar un invitado",
        responses={200: EventoInvitadoSerializer},
    )
    def put(self, request, pk: str):
        repo = RepoEventosORM()
        invitado = ActualizarInvitadoUseCase(repo).ejecutar(str(pk), request.data)
        if not invitado:
            return fail("Invitado no encontrado", status=404)
        return ok(EventoInvitadoSerializer(invitado).data)

    def patch(self, request, pk: str):
        return self.put(request, pk)

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Eliminar un invitado",
        responses={200: None},
    )
    def delete(self, request, pk: str):
        repo = RepoEventosORM()
        ok_del = repo.eliminar_invitado(str(pk))
        if not ok_del:
            return fail("Invitado no encontrado o no se pudo eliminar", status=404)
        return ok({"eliminado": True})


class EventoInvitadosImportarView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.eventos")]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Importar o previsualizar lista de invitados desde archivo CSV/JSON",
        responses={200: ResumenImportacionSerializer},
    )
    def post(self, request, evento_id: str):
        repo = RepoEventosORM()
        filas_crudas = []
        confirmar = request.data.get("confirmar", False)
        if isinstance(confirmar, str):
            confirmar = confirmar.lower() in ("true", "1", "yes")

        archivo = request.FILES.get("archivo")
        if archivo:
            # Validación de entrada: el import se lee entero en memoria, así que
            # se acota el tamaño y se aceptan solo los formatos que se procesan.
            if archivo.size > MAX_BYTES_DOCUMENTO:
                return fail(
                    "El archivo excede el tamaño máximo de "
                    f"{MAX_BYTES_DOCUMENTO // (1024 * 1024)} MB.",
                    status=400,
                )
            nombre = archivo.name.lower()
            if not nombre.endswith((".xlsx", ".csv")):
                return fail("El archivo debe ser .xlsx o .csv.", status=400)
            if nombre.endswith(".xlsx"):
                try:
                    import openpyxl
                    wb = openpyxl.load_workbook(io.BytesIO(archivo.read()), read_only=True, data_only=True)
                    ws = wb.active
                    filas_iter = ws.iter_rows(values_only=True)
                    encabezados = next(filas_iter, None)
                    if not encabezados:
                        return fail("El archivo Excel está vacío", status=400)
                    claves = [str(col).strip().lower() if col is not None else "" for col in encabezados]
                    for fila_val in filas_iter:
                        if not any(fila_val):
                            continue
                        fila_dict = {}
                        for idx_c, val in enumerate(fila_val):
                            if idx_c < len(claves) and claves[idx_c]:
                                fila_dict[claves[idx_c]] = str(val if val is not None else "").strip()
                        filas_crudas.append(fila_dict)
                except Exception as e:
                    return fail(f"Error procesando archivo Excel: {str(e)}", status=400)
            else:
                try:
                    contenido = archivo.read().decode("utf-8-sig")
                    lector = csv.DictReader(io.StringIO(contenido))
                    for row in lector:
                        filas_crudas.append(row)
                except Exception as e:
                    return fail(f"Error procesando archivo CSV: {str(e)}", status=400)
        elif "filas" in request.data:
            filas_crudas = request.data.get("filas", [])
            if isinstance(filas_crudas, str):
                try:
                    filas_crudas = json.loads(filas_crudas)
                except Exception:
                    filas_crudas = []

        if not filas_crudas:
            return fail("No se proporcionaron filas ni archivo para importar", status=400)

        use_case = ImportarInvitadosUseCase(repo)
        resumen = use_case.ejecutar(str(evento_id), filas_crudas, aplicar=bool(confirmar))
        return ok(ResumenImportacionSerializer(resumen).data)


class EventoInvitadosPlantillaExcelView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.eventos")]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Descargar plantilla Excel para importación de invitados",
    )
    def get(self, request):
        columnas = [
            'nombre',
            'categoria',
            'zona',
            'documento',
            'organizacion',
            'correo',
            'telefono',
            'mesa',
        ]
        filas = [
            {
                'nombre': 'Carlos Rodríguez',
                'categoria': 'General',
                'zona': 'Zona A',
                'documento': '12345678',
                'organizacion': 'CONATEL',
                'correo': 'carlos.rodriguez@conatel.gob.ve',
                'telefono': '04121234567',
                'mesa': 'Mesa 1',
            },
            {
                'nombre': 'María Gómez',
                'categoria': 'VIP',
                'zona': 'Zona VIP',
                'documento': '87654321',
                'organizacion': 'Institución Invitada',
                'correo': 'maria.gomez@ejemplo.com',
                'telefono': '04141234567',
                'mesa': 'Mesa 2',
            },
        ]
        contenido = generar_reporte_excel(
            titulo='Plantilla Importación Invitados',
            columnas=columnas,
            filas=filas,
            filtros=[('Uso', 'Completar con los datos de los invitados a importar')],
        )
        resp = HttpResponse(
            contenido,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        resp['Content-Disposition'] = 'attachment; filename="plantilla-invitados-eventos.xlsx"'
        return resp


class EventoEmitirLoteView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.eventos")]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Emitir credenciales en lote para invitados de un evento",
        request=EmitirCredencialesLoteSerializer,
        responses={200: None},
    )
    def post(self, request, evento_id: str):
        serializer = EmitirCredencialesLoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitados_ids = serializer.validated_data.get("invitados_ids") or None

        repo = RepoEventosORM()
        resultado = EmitirCredencialesEventoUseCase(repo).ejecutar(str(evento_id), invitados_ids)
        return ok(resultado)


class EventoEnviarCorreoView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.eventos")]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Enviar credenciales por correo electrónico a invitados",
        request=EnviarCredencialesCorreoSerializer,
        responses={200: None},
    )
    def post(self, request, evento_id: str):
        serializer = EnviarCredencialesCorreoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitados_ids = serializer.validated_data.get("invitados_ids") or None

        repo = RepoEventosORM()
        resultado = EnviarCredencialesCorreoUseCase(repo).ejecutar(str(evento_id), invitados_ids)
        return ok(resultado)


class EventoCredencialPdfView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasAnyPermission("carnetizacion.eventos", "carnetizacion.control_eventos"),
    ]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Descargar gafete PDF de un invitado o lote del evento",
        parameters=[
            OpenApiParameter("invitado_id", str, required=False),
        ],
    )
    def get(self, request, evento_id: str):
        repo = RepoEventosORM()
        evento = repo.obtener_evento(str(evento_id))
        if not evento:
            return fail("Evento no encontrado", status=404)

        invitado_id = request.query_params.get("invitado_id")
        host_base = request.build_absolute_uri("/")[:-1]

        if invitado_id:
            invitado = repo.obtener_invitado(str(invitado_id))
            if not invitado or str(invitado.evento_id) != str(evento.id):
                return fail("Invitado no encontrado en este evento", status=404)
            cat = repo.obtener_categoria(str(invitado.categoria_id))
            pdf_bytes = generar_gafete_evento_pdf(invitado, evento, cat, host_base=host_base)
            nombre_archivo = f"Gafete_{invitado.codigo_credencial or invitado.id}.pdf"
        else:
            invitados = repo.listar_invitados(str(evento_id))
            if not invitados:
                return fail("No hay invitados registrados para este evento", status=400)
            cats_map = {str(c.id): c for c in repo.listar_categorias(str(evento_id))}
            pdf_bytes = generar_lote_gafetes_evento_pdf(
                invitados, evento, cats_map, host_base=host_base
            )
            nombre_archivo = f"Gafetes_Evento_{evento.nombre[:20]}.pdf"

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{nombre_archivo}"'
        return response


class EventoPanelView(APIView):
    permission_classes = [
        IsAuthenticated,
        HasAnyPermission("carnetizacion.eventos", "carnetizacion.control_eventos"),
    ]

    @extend_schema(
        tags=["Carnetización - Eventos"],
        summary="Obtener métricas y resumen en vivo del evento (panel de control)",
        responses={200: PanelEventoSerializer},
    )
    def get(self, request, evento_id: str):
        repo = RepoEventosORM()
        panel = ObtenerPanelEventoUseCase(repo).ejecutar(str(evento_id))
        if not panel:
            return fail("Evento no encontrado", status=404)
        return ok(PanelEventoSerializer(panel).data)


class EventoControlEntradaCheckInView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("carnetizacion.control_eventos")]

    @extend_schema(
        tags=["Carnetización - Control Entrada"],
        summary="Validar y registrar acceso a evento mediante código QR o hash",
        request=CheckInRequestSerializer,
        responses={200: CheckInResponseSerializer},
    )
    def post(self, request):
        serializer = CheckInRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        dto = CheckInRequestDTO(
            codigo_o_hash=datos["codigo_o_hash"],
            evento_id=datos.get("evento_id"),
            zona_id=datos.get("zona_id"),
        )

        repo = RepoEventosORM()
        registrado_por_id = getattr(request.user, "id", None)
        resultado = ControlEntradaEventoUseCase(repo).ejecutar(
            dto, registrado_por_id=registrado_por_id
        )

        return ok(CheckInResponseSerializer(resultado).data)
