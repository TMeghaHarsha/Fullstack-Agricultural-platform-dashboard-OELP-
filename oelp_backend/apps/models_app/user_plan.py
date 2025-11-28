from __future__ import annotations

from django.db import models
from django.utils import timezone

from .plan import Plan
from .user import CustomUser
from .feature import Feature


class UserPlan(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE)
    start_date = models.DateField()
    end_date = models.DateField()
    expire_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class PlanFeatureUsage(models.Model):
    user_plan = models.ForeignKey(UserPlan, on_delete=models.CASCADE, related_name="feature_usages")
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE)
    max_count = models.IntegerField()
    used_count = models.IntegerField(default=0)
    duration_days = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class PaymentMethod(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="payment_methods")
    brand = models.CharField(max_length=50)
    last4 = models.CharField(max_length=4)
    exp_month = models.IntegerField()
    exp_year = models.IntegerField()
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ("payment", "Payment"),
        ("refund", "Refund"),
    ]
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="transactions")
    plan = models.ForeignKey(Plan, on_delete=models.SET_NULL, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=10, default="USD")
    status = models.CharField(max_length=20, default="paid")
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES, default="payment")
    invoice_pdf = models.URLField(blank=True, null=True)
    provider_order_id = models.CharField(max_length=255, blank=True, null=True, help_text="Razorpay order ID")
    provider_payment_id = models.CharField(max_length=255, blank=True, null=True, help_text="Razorpay payment ID")
    refund_reason = models.TextField(blank=True, null=True, help_text="Reason for refund")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class RefundPolicy(models.Model):
    plan_type = models.CharField(max_length=16, choices=Plan.PlanType.choices)
    refund_percentage = models.DecimalField(max_digits=5, decimal_places=2, help_text="Percentage refunded")
    days_after_purchase = models.IntegerField(help_text="Refund available up to N days after purchase")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name_plural = "Refund Policies"
    
    def __str__(self):
        return f"{self.plan_type} - {self.refund_percentage}% within {self.days_after_purchase} days"

