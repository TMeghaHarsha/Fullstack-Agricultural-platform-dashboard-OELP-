from __future__ import annotations

from typing import Optional, Tuple

from django.utils.translation import gettext_lazy as _
from rest_framework import authentication, exceptions

from apps.models_app.token import UserAuthToken


class TokenAuthentication(authentication.BaseAuthentication):
    keyword = "Token"

    def authenticate(self, request) -> Optional[Tuple[object, None]]:
        auth = authentication.get_authorization_header(request).split()
        if not auth or auth[0].lower() != self.keyword.lower().encode():
            return None
        if len(auth) == 1:
            raise exceptions.AuthenticationFailed(_("Invalid token header. No credentials provided."))
        if len(auth) > 2:
            raise exceptions.AuthenticationFailed(_("Invalid token header."))
        try:
            token = auth[1].decode()
        except UnicodeError:
            raise exceptions.AuthenticationFailed(_("Invalid token header. Token string should not contain invalid characters."))

        try:
            user_token = UserAuthToken.objects.select_related("user").get(access_token=token)
        except UserAuthToken.DoesNotExist:
            raise exceptions.AuthenticationFailed(_("Invalid token."))
        if not user_token.user.is_active:
            raise exceptions.AuthenticationFailed(_("User inactive or deleted."))

        return (user_token.user, None)

