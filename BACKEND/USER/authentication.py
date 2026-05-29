import logging

from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

logger = logging.getLogger(__name__)


class CookieJWTAuthentication(JWTAuthentication):
    

    def authenticate(self, request):
        # Try cookie-based authentication first
        raw_token = request.COOKIES.get(
            settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
        )

        if raw_token is not None:
            try:
                validated_token = self.get_validated_token(raw_token)
                user = self.get_user(validated_token)
                return user, validated_token
            except (InvalidToken, TokenError) as e:
                logger.debug(f"Cookie token invalid: {e}")
                # Fall through to header-based auth

        # Fallback to standard Authorization header
        return super().authenticate(request)
