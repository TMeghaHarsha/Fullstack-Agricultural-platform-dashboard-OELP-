from __future__ import annotations

from django.db import models
from django.utils import timezone

from .user import CustomUser


class UserAuthToken(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name="auth_token")
    access_token = models.TextField()
    last_login = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover - trivial
        username = self.user.username or self.user.email
        return f"{username} - Auth Token"

