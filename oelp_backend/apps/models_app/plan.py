from __future__ import annotations

from django.db import models


class Plan(models.Model):
    class PlanType(models.TextChoices):
        MAIN = "main", "Main"
        TOPUP = "topup", "TopUp"
        ENTERPRISE = "enterprise", "Enterprise"

    name = models.CharField(max_length=100, unique=True)
    type = models.CharField(max_length=16, choices=PlanType.choices, default=PlanType.MAIN)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    duration = models.PositiveIntegerField(help_text="Duration in days")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.name} ({self.type})"

