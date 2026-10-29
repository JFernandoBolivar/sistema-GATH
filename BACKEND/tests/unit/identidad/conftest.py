"""
Dobles en memoria compartidos de los tests unitarios de identidad (B3.14).

Implementan el puerto `apps.identidad.domain.ports.RepoPermisos` — no el
repositorio ORM (D-09/B21): toda la suite corre sin Django ni PostgreSQL.
"""
import pytest

from apps.identidad.domain.entities.permiso import Permiso
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.entities.rol import Rol
from apps.identidad.domain.entities.usuario_permisos import UsuarioPermisos
from apps.identidad.domain.value_objects.codigo_permiso import CodigoPermiso


class RepoPermisosMemoria:
    """Doble del puerto RepoPermisos: catálogo, matriz y cuentas en dicts."""

    def __init__(self, permisos=(), matriz=None, rol_por_cedula=None,
                 nombres_rol=None, overrides=None):
        self._permisos = tuple(permisos)
        self._matriz = {
            int(rol): frozenset(codigos) for rol, codigos in (matriz or {}).items()
        }
        self._rol_por_cedula = dict(rol_por_cedula or {})
        self._nombres_rol = dict(nombres_rol or {})
        self._overrides = dict(overrides or {})
        self._versions = {}

    def listar(self):
        return list(self._permisos)

    def obtener_por_codigo(self, codigo):
        return next(
            (p for p in self._permisos if p.codigo.valor == codigo), None
        )

    def existe_codigo(self, codigo):
        return any(p.codigo.valor == codigo for p in self._permisos)

    def permisos_del_rol(self, rol_id):
        codigos = self._matriz.get(int(rol_id), frozenset())
        return tuple(
            p for p in self._permisos if p.codigo.valor in codigos
        )

    def codigos_del_rol(self, rol_id):
        return frozenset(self._matriz.get(int(rol_id), frozenset()))

    def politica_del_rol(self, rol_id):
        return PoliticaAcceso(allow=self.codigos_del_rol(rol_id), deny=frozenset())

    def rol_de_cuenta(self, cedula):
        rol_id = self._rol_por_cedula.get(cedula)
        if rol_id is None:
            # Cuenta inexistente o sin rol: mismo resultado (fallo cerrado).
            return None
        nombre = self._nombres_rol.get(int(rol_id), f'ROL_{rol_id}')
        return Rol(
            identificador=int(rol_id),
            nombre=nombre,
            permisos=self.permisos_del_rol(rol_id),
        )

    def obtener_permisos_usuario(self, cedula):
        rol_id = self._rol_por_cedula.get(cedula)
        if rol_id is None and cedula not in self._overrides:
            return None
        nombre_rol = self._nombres_rol.get(int(rol_id), f'ROL_{rol_id}') if rol_id is not None else None
        politica_rol = self.politica_del_rol(rol_id) if rol_id is not None else PoliticaAcceso()
        custom = self._overrides.get(cedula, PoliticaAcceso())
        effective = PoliticaAcceso(
            allow=politica_rol.allow.union(custom.allow),
            deny=politica_rol.deny.union(custom.deny),
        )
        return UsuarioPermisos(
            cedula=cedula,
            rol_id=rol_id,
            nombre_rol=nombre_rol,
            permisos_custom=custom,
            politica_efectiva=effective,
            version=self._versions.get(cedula, 1),
        )

    def guardar_override_usuario(self, cedula, custom_allow, custom_deny):
        custom = PoliticaAcceso(
            allow=frozenset(custom_allow),
            deny=frozenset(custom_deny),
        )
        self._overrides[cedula] = custom
        self._versions[cedula] = self._versions.get(cedula, 1) + 1
        return self.obtener_permisos_usuario(cedula)


@pytest.fixture
def crear_permiso():
    """Constructor de entidades `Permiso` para los tests."""

    def _crear(codigo, nombre=None):
        return Permiso(
            codigo=CodigoPermiso(codigo),
            nombre=nombre or f'Permiso {codigo}',
        )

    return _crear


@pytest.fixture
def repo_con_matriz(crear_permiso):
    """
    Repositorio en memoria con un rol 7 que concede N=3 permisos, otro rol 8
    vacío y la cédula V-12345678 asociada al rol 7.
    """
    permisos = (
        crear_permiso('personal.crear'),
        crear_permiso('personal.ver_salud', 'Ver perfil de salud'),
        crear_permiso('identidad.listar_permisos'),
        crear_permiso('carnetizacion.emitir'),  # existe pero nadie lo tiene
    )
    return RepoPermisosMemoria(
        permisos=permisos,
        matriz={7: {'personal.crear', 'personal.ver_salud',
                    'identidad.listar_permisos'}, 8: set()},
        rol_por_cedula={'V-12345678': 7},
        nombres_rol={7: 'ADMINISTRADOR'},
    )


# ─────────────────────────────────────────────────────────────────────────
# Dobles en memoria de gestión de usuarios / roles / departamentos / tokens
# (tarea de cierre de brechas USER → apps.identidad: CRIT-04, CRIT-05,
# CRIT-12, R-11). Implementan los puertos `RepoCuentas`, `RepoRoles`,
# `RepoDepartamentos` y `RepoCuentaAuth` — no los repositorios ORM (D-09/B21).
# ─────────────────────────────────────────────────────────────────────────
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.entities.rol import Rol as RolEntidad


class RepoCuentasMemoria:
    """Doble del puerto `RepoCuentas`."""

    def __init__(self, cuentas=(), passwords=None, cedulas_validas=None):
        self._cuentas = {c.id: c for c in cuentas}
        self._passwords = dict(passwords or {})
        self._siguiente_id = (max(self._cuentas) + 1) if self._cuentas else 1
        # Cédulas que "existen como empleado" para el alta (None => todas válidas)
        self._cedulas_validas = cedulas_validas

    def obtener_por_id(self, id):
        return self._cuentas.get(id)

    def existe_cuenta_para_cedula(self, cedula):
        return any(c.cedula == cedula for c in self._cuentas.values())

    def listar(self, filtros):
        resultado = list(self._cuentas.values())
        if filtros.get('departamento_id') not in (None, ''):
            resultado = [c for c in resultado if c.departamento_id == filtros['departamento_id']]
        if filtros.get('rol_id') not in (None, ''):
            resultado = [c for c in resultado if c.rol_id == filtros['rol_id']]
        if filtros.get('is_active') is not None:
            resultado = [c for c in resultado if c.is_active == filtros['is_active']]
        if filtros.get('cedula'):
            resultado = [c for c in resultado if filtros['cedula'] in c.cedula]
        return resultado

    def crear(self, cedula, password, departamento_id, rol_id):
        from core.domain.exceptions import NotFoundError

        if self._cedulas_validas is not None and cedula not in self._cedulas_validas:
            raise NotFoundError(f"La cédula '{cedula}' no pertenece a ningún empleado registrado.")

        nueva = Cuenta(
            id=self._siguiente_id, cedula=cedula,
            departamento_id=departamento_id, rol_id=rol_id, is_active=True,
        )
        self._cuentas[nueva.id] = nueva
        self._passwords[nueva.id] = password
        self._siguiente_id += 1
        return nueva

    def guardar(self, cuenta):
        self._cuentas[cuenta.id] = cuenta
        return cuenta

    def verificar_password(self, id, password_plano):
        return self._passwords.get(id) == password_plano

    def establecer_password(self, id, password_nuevo):
        self._passwords[id] = password_nuevo


class RepoRolesMemoria:
    """Doble del puerto `RepoRoles`."""

    def __init__(self, roles=(), cuentas_por_rol=None):
        self._roles = {r.identificador: r for r in roles}
        self._cuentas_por_rol = dict(cuentas_por_rol or {})
        self._siguiente_id = (max(self._roles) + 1) if self._roles else 1

    def listar(self):
        return sorted(self._roles.values(), key=lambda r: r.nombre)

    def obtener_por_id(self, id):
        return self._roles.get(id)

    def existe_nombre(self, nombre, excluir_id=None):
        return any(
            r.nombre.upper() == nombre.upper()
            for rid, r in self._roles.items()
            if rid != excluir_id
        )

    def crear(self, nombre, descripcion):
        rol = RolEntidad(identificador=self._siguiente_id, nombre=nombre, descripcion=descripcion)
        self._roles[rol.identificador] = rol
        self._siguiente_id += 1
        return rol

    def actualizar(self, id, nombre, descripcion):
        actual = self._roles[id]
        self._roles[id] = RolEntidad(
            identificador=id,
            nombre=nombre if nombre is not None else actual.nombre,
            descripcion=descripcion if descripcion is not None else actual.descripcion,
        )
        return self._roles[id]

    def eliminar(self, id):
        self._roles.pop(id, None)

    def contar_cuentas_con_rol(self, id):
        return self._cuentas_por_rol.get(id, 0)


class RepoDepartamentosMemoria:
    """Doble del puerto `RepoDepartamentos`."""

    def __init__(self, departamentos=()):
        self._departamentos = list(departamentos)

    def listar(self):
        return list(self._departamentos)


class RepoCuentaAuthMemoria:
    """
    Doble del puerto `RepoCuentaAuth`.

    `obtener_objeto_autenticable` devuelve un centinela (no una instancia real
    de `CuentaModel`): en los tests que ejercitan `rotar_tokens_sesion` se
    mockea también `emitir_tokens_sesion`, así que ese objeto nunca llega a
    tocar `simplejwt`/el ORM real (ver docstring de
    `application/use_cases/emitir_tokens_sesion.py`).
    """

    def __init__(self, titulares=()):
        self._titulares = {t.id: t for t in titulares}

    def obtener_titular_por_id(self, id):
        return self._titulares.get(id)

    def obtener_objeto_autenticable(self, id):
        return self._titulares.get(id)


@pytest.fixture
def cuenta_activa():
    return Cuenta(id=1, cedula='V-11111111', nombres='Ana', apellidos='Pérez',
                  departamento_id=2, rol_id=7, is_active=True)


@pytest.fixture
def repo_cuentas(cuenta_activa):
    return RepoCuentasMemoria(
        cuentas=[cuenta_activa],
        passwords={1: 'clave-actual'},
        cedulas_validas={'V-11111111', 'V-22222222'},
    )
