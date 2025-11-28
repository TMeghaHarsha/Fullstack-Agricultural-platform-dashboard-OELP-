from __future__ import annotations

from django.db import models


class IrrigationMethods(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.name

