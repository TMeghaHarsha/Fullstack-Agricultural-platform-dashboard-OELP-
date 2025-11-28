from __future__ import annotations

from django.db import models

from .user import CustomUser


class Notification(models.Model):
    sender = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, related_name="sent_notifications")
    receiver = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="notifications")
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:  # pragma: no cover
        return f"Notification to {self.receiver}"

    def save(self, *args, **kwargs):
        """Block support ticket notifications from being saved"""
        message = str(self.message) if self.message else ''
        notification_type = self.notification_type if hasattr(self, 'notification_type') else ''
        related_type = self.related_object_type if hasattr(self, 'related_object_type') else ''

        # Block all support ticket notifications
        if ('Support request' in message or
            'support request' in message.lower() or
            notification_type == 'support_ticket' or
            related_type == 'support_ticket'):
            # Don't save - return without calling super()
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

