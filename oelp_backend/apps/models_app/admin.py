from __future__ import annotations

from django.contrib import admin

from .assets import Asset
from .crop_variety import Crop, CropVariety
from .farm import Farm
from .field import Field, Device, CropLifecycleDates, FieldIrrigationMethod, FieldIrrigationPractice
from .feature import FeatureType, Feature
from .feature_plan import PlanFeature
from .irrigation import IrrigationMethods
from .notifications import Notification, SupportRequest
from .plan import Plan
from .soil_report import SoilTexture, SoilReport
from .token import UserAuthToken
from .user import CustomUser, Role, UserRole
from .models import UserActivity
from .user_plan import (
    UserPlan,
    PlanFeatureUsage,
    PaymentMethod,
    Transaction,
)


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ("id", "email", "username", "phone_number", "is_active", "is_staff", "date_joined")
    search_fields = ("email", "username", "phone_number")
    list_filter = ("is_active", "is_staff")
    fieldsets = (
        (None, {"fields": ("email", "username", "phone_number", "avatar", "google_id", "password")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )


@admin.register(UserAuthToken)
class UserAuthTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "last_login")
    search_fields = ("user__email",)


admin.site.register(Role)
admin.site.register(UserRole)
admin.site.register(UserActivity)


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("id", "file", "content_type", "object_id", "uploaded_at")
    search_fields = ("file",)


@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "icon_url")
    search_fields = ("name",)


@admin.register(CropVariety)
class CropVarietyAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "crop", "is_primary")
    list_filter = ("crop", "is_primary")
    search_fields = ("name", "crop__name")


@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "user")
    search_fields = ("name", "user__email")


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "serial_number")
    search_fields = ("name", "serial_number")


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "farm", "crop", "is_active", "is_locked")
    list_filter = ("is_active", "is_locked", "crop")
    search_fields = ("name", "farm__name", "crop__name")


admin.site.register(CropLifecycleDates)
admin.site.register(FieldIrrigationMethod)
admin.site.register(FieldIrrigationPractice)


@admin.register(IrrigationMethods)
class IrrigationMethodsAdmin(admin.ModelAdmin):
    list_display = ("id", "name")


@admin.register(SoilTexture)
class SoilTextureAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "icon")


@admin.register(SoilReport)
class SoilReportAdmin(admin.ModelAdmin):
    list_display = ("id", "field", "ph", "ec", "soil_type")
    search_fields = ("field__name",)


@admin.register(FeatureType)
class FeatureTypeAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_at")
    search_fields = ("name",)


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "feature_type")
    search_fields = ("name",)


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "type", "price", "duration")


admin.site.register(PlanFeature)


admin.site.register(UserPlan)
admin.site.register(PlanFeatureUsage)
admin.site.register(PaymentMethod)
admin.site.register(Transaction)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id", "receiver", "is_read", "created_at")
    list_filter = ("is_read",)
    search_fields = ("receiver__email", "message")


@admin.register(SupportRequest)
class SupportRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "category", "assigned_role", "created_at")
    list_filter = ("category", "assigned_role")
    search_fields = ("user__email", "description")

