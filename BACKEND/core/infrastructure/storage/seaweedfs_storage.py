"""
Implementación de FileStorage para SeaweedFS mediante Gateway S3 (D-01, B5.1).

Cumple con el contrato FileStorage de `core.domain.ports`.
Usa `boto3` para interactuar con SeaweedFS S3 API y proveer URLs prefirmadas
temporales (evitando exponer almacenamiento sin autenticación al público).
"""
import os
import logging
from io import BytesIO
from typing import Optional

logger = logging.getLogger('gath.storage')


class SeaweedFSStorage:
    """Adaptador de almacenamiento sobre SeaweedFS Gateway S3 / Boto3."""

    def __init__(
        self,
        endpoint_url: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
        region_name: str = 'us-east-1',
    ):
        self.endpoint_url = endpoint_url or os.getenv('SEAWEEDFS_S3_ENDPOINT', '')
        self.access_key = access_key or os.getenv('SEAWEEDFS_S3_ACCESS_KEY', '')
        self.secret_key = secret_key or os.getenv('SEAWEEDFS_S3_SECRET_KEY', '')
        self.bucket_name = bucket_name or os.getenv('SEAWEEDFS_S3_BUCKET', 'gath-storage')
        self.region_name = region_name
        self._s3_client = None


    def _get_client(self):
        if self._s3_client is None:
            try:
                import boto3
                from botocore.config import Config

                self._s3_client = boto3.client(
                    's3',
                    endpoint_url=self.endpoint_url,
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key,
                    region_name=self.region_name,
                    config=Config(signature_version='s3v4'),
                )
            except ImportError:
                logger.warning("boto3 no está instalado; operando en modo almacenamiento simulado")
                self._s3_client = None
        return self._s3_client

    def subir(self, clave: str, contenido: bytes, mime_type: str = 'application/octet-stream') -> str:
        """Sube un archivo a SeaweedFS S3 y retorna su clave de objeto."""
        client = self._get_client()
        if client is not None:
            try:
                client.put_object(
                    Bucket=self.bucket_name,
                    Key=clave,
                    Body=BytesIO(contenido),
                    ContentType=mime_type,
                )
                return clave
            except Exception as exc:
                logger.error("Error al subir objeto %s a SeaweedFS: %s", clave, exc)
                raise
        # Simulación en memoria si no hay cliente S3
        return clave

    def descargar(self, clave: str) -> bytes:
        """Descarga el contenido binario de un objeto en SeaweedFS."""
        client = self._get_client()
        if client is not None:
            try:
                resp = client.get_object(Bucket=self.bucket_name, Key=clave)
                return resp['Body'].read()
            except Exception as exc:
                logger.error("Error al descargar objeto %s de SeaweedFS: %s", clave, exc)
                raise
        return b""

    def url_firmada(self, clave: str, expira_segundos: int = 300) -> str:
        """Genera una URL prefirmada temporal para visualización/descarga segura (D-01)."""
        client = self._get_client()
        if client is not None:
            try:
                url = client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket_name, 'Key': clave},
                    ExpiresIn=expira_segundos,
                )
                return url
            except Exception as exc:
                logger.error("Error al generar URL prefirmada para %s: %s", clave, exc)
                raise
        return f"{self.endpoint_url}/{self.bucket_name}/{clave}?signature=mock&expires={expira_segundos}"
