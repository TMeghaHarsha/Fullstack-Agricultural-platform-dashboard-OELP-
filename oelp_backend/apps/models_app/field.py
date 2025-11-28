from __future__ import annotations

import math
from dataclasses import dataclass

from django.conf import settings
from django.db import models
from django.utils import timezone

try:  # Optional S3 storage
    from storages.backends.s3boto3 import S3Boto3Storage  # type: ignore
    ImageStorage = S3Boto3Storage
except Exception:  # pragma: no cover - fallback to default
    from django.core.files.storage import FileSystemStorage
    ImageStorage = FileSystemStorage

from .assets_util import asset_upload_to
from .crop_variety import Crop, CropVariety
from .farm import Farm
from .irrigation import IrrigationMethods
from .soil_report import SoilTexture
from .user import CustomUser


class Device(models.Model):
    name = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=100, unique=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.name} ({self.serial_number})"


class Field(models.Model):
    name = models.CharField(max_length=50)
    farm = models.ForeignKey(Farm, on_delete=models.CASCADE, related_name="fields")
    device = models.ForeignKey(Device, on_delete=models.SET_NULL, null=True, blank=True, related_name="fields")
    crop = models.ForeignKey(Crop, on_delete=models.SET_NULL, null=True, blank=True, related_name="fields")
    crop_variety = models.ForeignKey(CropVariety, on_delete=models.SET_NULL, null=True, blank=True, related_name="fields")
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, null=True)
    # Store boundary as GeoJSON-like structure to avoid PostGIS dependency on Render
    boundary = models.JSONField(null=True, blank=True)
    location_name = models.CharField(max_length=255, null=True, blank=True)
    area = models.JSONField(null=True, blank=True)
    soil_type = models.ForeignKey(SoilTexture, on_delete=models.SET_NULL, null=True, blank=True)
    image = models.ImageField(upload_to=asset_upload_to, blank=True, null=True, storage=ImageStorage())
    is_active = models.BooleanField(default=True)
    is_locked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.name} ({self.farm.name})"

    def save(self, *args, **kwargs):
        # Skip heavy GIS computations to keep deployment simple on Render
        super().save(*args, **kwargs)


class CropLifecycleDates(models.Model):
    field = models.ForeignKey(Field, on_delete=models.CASCADE)
    sowing_date = models.DateField(null=True, blank=True)
    growth_start_date = models.DateField(null=True, blank=True)
    flowering_date = models.DateField(null=True, blank=True)
    harvesting_date = models.DateField(null=True, blank=True)
    yield_amount = models.FloatField(null=True, blank=True, help_text="Total yield for the cycle (tons or units)")


class FieldIrrigationMethod(models.Model):
    field = models.ForeignKey(Field, on_delete=models.CASCADE)
    irrigation_method = models.ForeignKey(IrrigationMethods, on_delete=models.CASCADE)


class FieldIrrigationPractice(models.Model):
    field = models.ForeignKey(Field, on_delete=models.CASCADE, related_name="irrigation_practices")
    irrigation_method = models.ForeignKey(IrrigationMethods, on_delete=models.CASCADE)
    notes = models.TextField(blank=True, null=True)
    performed_at = models.DateTimeField(default=timezone.now)

