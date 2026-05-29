
import logging

from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

logger = logging.getLogger(__name__)


class TokenService:
    """Manages JWT token lifecycle: creation, storage (cookies), and revocation."""

    @staticmethod
    def generate_tokens_for_user(user):
        """
        Generate access and refresh tokens for the given cuenta user.
        
        Embeds custom claims (cedula, rol) in the token payload
        for use by the backend without extra DB lookups.
        """
        refresh = RefreshToken.for_user(user)
        
        # Add custom claims for downstream use
        refresh['cedula'] = str(user.cedula.cedulaidentidad) if user.cedula else None
        refresh['rol'] = user.rol.nombre_rol if user.rol else None

        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }

    @staticmethod
    def set_token_cookies(response, tokens):
        """
        Set access and refresh tokens as HttpOnly cookies on the response.
        
        Access token cookie: sent on all /api/ paths.
        Refresh token cookie: restricted to /api/accounts/ path for security.
        """
        jwt_config = settings.SIMPLE_JWT

        # Access token cookie
        response.set_cookie(
            key=jwt_config.get('AUTH_COOKIE', 'access_token'),
            value=tokens['access'],
            httponly=jwt_config.get('AUTH_COOKIE_HTTP_ONLY', True),
            secure=jwt_config.get('AUTH_COOKIE_SECURE', True),
            samesite=jwt_config.get('AUTH_COOKIE_SAMESITE', 'Lax'),
            max_age=int(jwt_config['ACCESS_TOKEN_LIFETIME'].total_seconds()),
            path=jwt_config.get('AUTH_COOKIE_PATH', '/'),
        )

        # Refresh token cookie — restricted path for security
        response.set_cookie(
            key=jwt_config.get('AUTH_COOKIE_REFRESH', 'refresh_token'),
            value=tokens['refresh'],
            httponly=True,
            secure=jwt_config.get('AUTH_COOKIE_SECURE', True),
            samesite=jwt_config.get('AUTH_COOKIE_SAMESITE', 'Lax'),
            max_age=int(jwt_config['REFRESH_TOKEN_LIFETIME'].total_seconds()),
            path='/api/accounts/',
        )

        return response

    @staticmethod
    def clear_token_cookies(response):
        """Remove authentication cookies by expiring them immediately."""
        jwt_config = settings.SIMPLE_JWT

        response.delete_cookie(
            key=jwt_config.get('AUTH_COOKIE', 'access_token'),
            path=jwt_config.get('AUTH_COOKIE_PATH', '/'),
        )
        response.delete_cookie(
            key=jwt_config.get('AUTH_COOKIE_REFRESH', 'refresh_token'),
            path='/api/accounts/',
        )

        return response

    @staticmethod
    def blacklist_refresh_token(token_str):
        """
        Blacklist a refresh token to prevent future use.
        Returns True on success, False if the token is already invalid.
        """
        try:
            token = RefreshToken(token_str)
            token.blacklist()
            logger.info("Refresh token blacklisted successfully")
            return True
        except TokenError as e:
            logger.warning(f"Failed to blacklist token: {e}")
            return False

    @staticmethod
    def refresh_access_token(refresh_token_str):
        """
        Use a refresh token to generate a new access token.
        If ROTATE_REFRESH_TOKENS is enabled, also returns a new refresh token.
        """
        try:
            refresh = RefreshToken(refresh_token_str)
            new_tokens = {
                'access': str(refresh.access_token),
            }

            # If rotation is enabled, generate new refresh token
            if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
                # Blacklist the old refresh token
                if settings.SIMPLE_JWT.get('BLACKLIST_AFTER_ROTATION', False):
                    try:
                        refresh.blacklist()
                    except Exception:
                        pass

                new_refresh = RefreshToken.for_user(refresh.payload.get('user_id'))
                new_tokens['refresh'] = str(new_refresh)
            else:
                new_tokens['refresh'] = refresh_token_str

            return new_tokens

        except TokenError as e:
            logger.warning(f"Token refresh failed: {e}")
            raise
