from __future__ import annotations

from django.db import models, transaction


class Crop(models.Model):
    name = models.CharField(max_length=100, unique=True)
    icon_url = models.URLField(max_length=300, blank=True, null=True)

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.name


class CropVariety(models.Model):
    crop = models.ForeignKey(Crop, on_delete=models.CASCADE, related_name="varieties")
    name = models.CharField(max_length=100)
    is_primary = models.BooleanField(default=False)

    class Meta:
        unique_together = ("crop", "name")
        verbose_name_plural = "Crop Varieties"

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.name} ({self.crop.name})"

    def save(self, *args, **kwargs):
        with transaction.atomic():
            super().save(*args, **kwargs)
            if self.is_primary:
                CropVariety.objects.filter(crop=self.crop).exclude(pk=self.pk).update(is_primary=False)

