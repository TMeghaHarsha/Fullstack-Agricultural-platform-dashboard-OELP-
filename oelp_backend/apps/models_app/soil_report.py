from __future__ import annotations

from django.db import models


class SoilTexture(models.Model):
    name = models.CharField(max_length=100)
    icon = models.URLField()

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.name


class SoilReport(models.Model):
    field = models.ForeignKey('Field', on_delete=models.CASCADE, related_name="soilreport")
    ph = models.FloatField()
    ec = models.FloatField()
    nitrogen = models.FloatField(blank=True, null=True)
    phosphorous = models.FloatField(blank=True, null=True)
    potassium = models.FloatField(blank=True, null=True)
    boron = models.FloatField(blank=True, null=True)
    copper = models.FloatField(blank=True, null=True)
    iron = models.FloatField(blank=True, null=True)
    zinc = models.FloatField(blank=True, null=True)
    manganese = models.FloatField(blank=True, null=True)
    soil_type = models.ForeignKey(SoilTexture, on_delete=models.CASCADE)
    report_link = models.URLField(blank=True, null=True)

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"SoilReport - {self.field.name}"

