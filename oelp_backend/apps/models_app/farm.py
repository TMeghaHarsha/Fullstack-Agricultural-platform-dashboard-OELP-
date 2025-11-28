from __future__ import annotations

from django.db import models

from .user import CustomUser


class Farm(models.Model):
    name = models.CharField(max_length=25)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.name

