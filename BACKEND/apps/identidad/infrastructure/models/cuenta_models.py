"""
Modelos ORM de Autenticación, Cuentas y Roles en apps.identidad (Regla B26).
"""
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager


class DepartamentoModel(models.Model):
    id = models.AutoField(primary_key=True)
    nombre_departamento = models.CharField(max_length=100, unique=True)
    descripcion_departamento = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'USER_departaments'
        verbose_name = 'departamento'
        verbose_name_plural = 'departamentos'

    def __str__(self) -> str:
        return self.nombre_departamento


class RolModel(models.Model):
    id = models.AutoField(primary_key=True)
    nombre_rol = models.CharField(max_length=50, unique=True)
    descripcion_rol = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'USER_rol'
        verbose_name = 'rol'
        verbose_name_plural = 'roles'

    def __str__(self) -> str:
        return self.nombre_rol


class CuentaManager(BaseUserManager):
    """Gestor de cuentas de usuario basado en cédula de identidad."""

    def create_user(self, cedula, password=None, **extra_fields):
        if not cedula:
            raise ValueError('La cédula del empleado es requerida')
        extra_fields.setdefault('is_active', True)
        user = self.model(cedula=cedula, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, cedula, password=None, **extra_fields):
        extra_fields.setdefault('is_active', True)
        return self.create_user(cedula, password, **extra_fields)


class CuentaModel(AbstractBaseUser):
    """
    Modelo de usuario canónico para autenticación en GATH.
    Extiende AbstractBaseUser y se vincula a la tabla física 'USER_cuenta'.
    """

    cedula = models.OneToOneField(
        'personal.EmployeeModel',
        on_delete=models.PROTECT,
        related_name='cuenta',
        to_field='cedulaidentidad',
        db_column='cedula',
        unique=True,
    )
    departamento = models.ForeignKey(
        DepartamentoModel,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        db_column='departamento_id',
    )
    rol = models.ForeignKey(
        RolModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='rol_id',
    )
    is_active = models.BooleanField(default=True)

    objects = CuentaManager()

    USERNAME_FIELD = 'cedula'
    REQUIRED_FIELDS = []

    class Meta:
        managed = False
        db_table = 'USER_cuenta'
        verbose_name = 'cuenta'
        verbose_name_plural = 'cuentas'

    def __str__(self) -> str:
        return str(self.cedula)
