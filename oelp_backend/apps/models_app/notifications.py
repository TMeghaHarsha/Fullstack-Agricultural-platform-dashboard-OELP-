from __future__ import annotations

from django.db import models

from .user import CustomUser


class NotificationType(models.TextChoices):
    GENERAL = "general", "General"
    ALERT = "alert", "Alert"
    UPDATE = "update", "Update"
    SUPPORT = "support", "Support"
    REMINDER = "reminder", "Reminder"


class Notification(models.Model):
    sender = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_notifications",
    )
    receiver = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    message = models.TextField()
    notification_type = models.CharField(
        max_length=32,
        choices=NotificationType.choices,
        default=NotificationType.GENERAL,
    )
    cause = models.CharField(max_length=64, blank=True, null=True)
    tags = models.JSONField(default=dict, blank=True)
    region = models.CharField(max_length=100, blank=True, null=True)
    crop_type = models.CharField(max_length=100, blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:  # pragma: no cover
        return f"Notification to {self.receiver}"

    def save(self, *args, **kwargs):
        """Block legacy support ticket notifications from being saved"""
        message = (self.message or "").lower()
        notification_type = getattr(self, "notification_type", "")
        related_type = (self.metadata or {}).get("related_type")

        if (
            "support request" in message
            or notification_type == "support_ticket"
            or related_type == "support_ticket"
        ):
            return None

        super().save(*args, **kwargs)


class SupportCategory(models.TextChoices):
    CROP = "crop", "Crop"
    TRANSACTION = "transaction", "Transaction"
    ANALYSIS = "analysis", "Analysis"
    SOFTWARE_ISSUE = "software_issue", "Software Issue"


class SupportRequest(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    category = models.CharField(max_length=32, choices=SupportCategory.choices)
    description = models.TextField()
    assigned_role = models.CharField(max_length=50, default="support")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"SupportRequest({self.user})"

