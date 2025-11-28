from __future__ import annotations

from django.db import models


class FeatureType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover
        return self.name


class Feature(models.Model):
    name = models.CharField(max_length=100, unique=True)
    feature_type = models.ForeignKey(FeatureType, on_delete=models.CASCADE, related_name="features")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover
        return self.name

