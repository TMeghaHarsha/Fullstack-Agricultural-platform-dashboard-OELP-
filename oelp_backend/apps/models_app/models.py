from __future__ import annotations

# Aggregate imports so Django loads all models when importing this app's
# models module. This ensures AUTH_USER_MODEL is registered early.

from django.db import models
from .user import CustomUser, Role, UserRole  # noqa: F401
from .farm import Farm  # noqa: F401
from .field import Field, Device, CropLifecycleDates, FieldIrrigationMethod, FieldIrrigationPractice  # noqa: F401
from .crop_variety import Crop, CropVariety  # noqa: F401
from .soil_report import SoilTexture, SoilReport  # noqa: F401
from .irrigation import IrrigationMethods  # noqa: F401
from .assets import Asset  # noqa: F401
from .feature import Feature, FeatureType  # noqa: F401
from .plan import Plan  # noqa: F401
from .user_plan import (
    UserPlan,
    PlanFeatureUsage,
    PaymentMethod,
    Transaction,
)  # noqa: F401
from .notifications import Notification, SupportRequest  # noqa: F401
from .support_ticket import SupportTicket, TicketComment, TicketHistory  # noqa: F401
from .token import UserAuthToken  # noqa: F401
from django.contrib.contenttypes.fields import GenericForeignKey  # noqa: F401
from django.contrib.contenttypes.models import ContentType  # noqa: F401


class ActivityAction:  # lightweight enum for references; real model in migrations below
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class UserActivity(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="activities")
    action = models.CharField(max_length=16)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "models_app"
        ordering = ("-created_at",)
