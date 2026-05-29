from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager


class departaments(models.Model):
    id = models.AutoField(primary_key=True)
    nombre_departamento = models.CharField(max_length=100, unique=True)
    descripcion_departamento = models.TextField(null=True, blank=True)

    class Meta:
        managed = True
        app_label = 'USER'


class Rol(models.Model):
    id = models.AutoField(primary_key=True)
    nombre_rol = models.CharField(max_length=50, unique=True) 
    descripcion_rol = models.TextField(null=True, blank=True)

    class Meta:
        managed = True
        app_label = 'USER'


class CuentaManager(BaseUserManager):
    """
    Custom manager for the cuenta model.
    Handles user creation using cedula (employee FK) as the unique identifier.
    """

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


class cuenta(AbstractBaseUser):
    """
    Custom user model extending AbstractBaseUser.
    Uses the employee's cedula as the unique identifier for authentication.
    Inherits password hashing and last_login from AbstractBaseUser.
    """

    cedula = models.OneToOneField(
        "RAC.Employee", 
        on_delete=models.CASCADE, 
        to_field='cedulaidentidad', 
        db_column='cedula',
        unique=True,
    )

    departamento = models.ForeignKey(
        departaments, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        db_column='departamento_id',
    )
    rol = models.ForeignKey(
        Rol, 
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
        managed = True
        app_label = 'USER'

    def __str__(self):
        return str(self.cedula)
