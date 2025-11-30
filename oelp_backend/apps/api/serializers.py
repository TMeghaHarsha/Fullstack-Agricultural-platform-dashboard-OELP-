from __future__ import annotations

from django.contrib.auth import password_validation
from rest_framework import serializers

from apps.models_app.assets import Asset
from apps.models_app.crop_variety import Crop, CropVariety
from apps.models_app.farm import Farm
from apps.models_app.field import Field, Device, CropLifecycleDates, FieldIrrigationMethod, FieldIrrigationPractice
from apps.models_app.feature import Feature, FeatureType
from apps.models_app.feature_plan import PlanFeature
from apps.models_app.irrigation import IrrigationMethods
from apps.models_app.notifications import Notification, SupportRequest
from apps.models_app.support_ticket import SupportTicket, TicketComment, TicketHistory
from apps.models_app.plan import Plan
from apps.models_app.soil_report import SoilTexture, SoilReport
from apps.models_app.token import UserAuthToken
from apps.models_app.user import CustomUser, Role, UserRole
from apps.models_app.models import UserActivity
from apps.models_app.user_plan import (
    UserPlan,
    PlanFeatureUsage,
    PaymentMethod,
    Transaction,
)


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    created_by_id = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            "id",
            "email",
            "username",
            "full_name",
            "phone_number",
            "avatar",
            "date_joined",
            "roles",
            "created_by_name",
            "created_by_id",
        )

    def get_roles(self, obj):
        try:
            return list(obj.user_roles.select_related("role").values_list("role__name", flat=True))
        except Exception:
            return []

    def get_created_by_name(self, obj):
        try:
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(obj.__class__)
            act = (
                UserActivity.objects
                .filter(content_type=ct, object_id=obj.pk, action__in=["create"])  # created
                .order_by("id")
                .select_related("user")
                .first()
            )
            if act and act.user:
                return act.user.full_name or act.user.username or None
        except Exception:
            pass
        return None

    def get_created_by_id(self, obj):
        try:
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(obj.__class__)
            act = (
                UserActivity.objects
                .filter(content_type=ct, object_id=obj.pk, action__in=["create"])
                .order_by("id")
                .select_related("user")
                .first()
            )
            if act and act.user:
                return act.user.id
        except Exception:
            pass
        return None


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("id", "name", "description")


class UserRoleSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = UserRole
        fields = ("id", "user", "user_username", "role", "role_name", "userrole_id", "assigned_at")


class SignUpSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    # Enforce required user fields per product requirements
    username = serializers.CharField(required=True, allow_blank=False)
    full_name = serializers.CharField(required=True, allow_blank=False)
    phone_number = serializers.CharField(required=True, allow_blank=False)

    class Meta:
        model = CustomUser
        fields = ("username", "full_name", "phone_number", "password", "google_id", "avatar")

    def validate_password(self, value: str) -> str:
        password_validation.validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = CustomUser.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class TokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAuthToken
        fields = ("access_token", "last_login")


class CropSerializer(serializers.ModelSerializer):
    class Meta:
        model = Crop
        fields = ("id", "name", "icon_url")


class CropVarietySerializer(serializers.ModelSerializer):
    crop_name = serializers.CharField(source="crop.name", read_only=True)

    class Meta:
        model = CropVariety
        fields = ("id", "crop", "name", "is_primary", "crop_name")


class FarmSerializer(serializers.ModelSerializer):
    class Meta:
        model = Farm
        fields = ("id", "name", "user")
        read_only_fields = ("user",)


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ("id", "name", "serial_number")


class FieldSerializer(serializers.ModelSerializer):
    soil_type_name = serializers.CharField(source="soil_type.name", read_only=True)
    farm_name = serializers.CharField(source="farm.name", read_only=True)
    crop_name = serializers.CharField(source="crop.name", read_only=True)
    crop_variety_name = serializers.CharField(source="crop_variety.name", read_only=True)
    irrigation_method_name = serializers.SerializerMethodField()
    irrigation_method_id = serializers.SerializerMethodField()
    size_acres = serializers.SerializerMethodField()
    current_sowing_date = serializers.SerializerMethodField()
    current_growth_start_date = serializers.SerializerMethodField()
    current_flowering_date = serializers.SerializerMethodField()
    current_harvesting_date = serializers.SerializerMethodField()

    class Meta:
        model = Field
        fields = (
            "id",
            "name",
            "farm",
            "farm_name",
            "device",
            "crop",
            "crop_name",
            "crop_variety",
            "crop_variety_name",
            "user",
            "boundary",
            "location_name",
            "area",
            "soil_type",
            "soil_type_name",
            "image",
            "irrigation_method_name",
            "size_acres",
            "irrigation_method_id",
            "current_sowing_date",
            "current_growth_start_date",
            "current_flowering_date",
            "current_harvesting_date",
            "is_active",
            "is_locked",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("user", "created_at", "updated_at", "area")

    def get_irrigation_method_name(self, obj):
        try:
            fim = FieldIrrigationMethod.objects.filter(field=obj).select_related("irrigation_method").first()
            return getattr(getattr(fim, "irrigation_method", None), "name", None)
        except Exception:
            return None

    def get_irrigation_method_id(self, obj):
        try:
            fim = FieldIrrigationMethod.objects.filter(field=obj).select_related("irrigation_method").first()
            return getattr(getattr(fim, "irrigation_method", None), "id", None)
        except Exception:
            return None

    def _latest_lifecycle(self, obj):
        try:
            return CropLifecycleDates.objects.filter(field=obj).order_by("-id").first()
        except Exception:
            return None

    def get_current_sowing_date(self, obj):
        lcd = self._latest_lifecycle(obj)
        return getattr(lcd, "sowing_date", None)

    def get_current_growth_start_date(self, obj):
        lcd = self._latest_lifecycle(obj)
        return getattr(lcd, "growth_start_date", None)

    def get_current_flowering_date(self, obj):
        lcd = self._latest_lifecycle(obj)
        return getattr(lcd, "flowering_date", None)

    def get_current_harvesting_date(self, obj):
        lcd = self._latest_lifecycle(obj)
        return getattr(lcd, "harvesting_date", None)

    def get_size_acres(self, obj):
        try:
            hectares = (obj.area or {}).get("hectares")
            if isinstance(hectares, (int, float)):
                return round(float(hectares) * 2.47105, 4)
        except Exception:
            pass
        return None


class CropLifecycleDatesSerializer(serializers.ModelSerializer):
    class Meta:
        model = CropLifecycleDates
        fields = ("id", "field", "sowing_date", "growth_start_date", "flowering_date", "harvesting_date", "yield_amount")


class FieldIrrigationMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = FieldIrrigationMethod
        fields = ("id", "field", "irrigation_method")


class FieldIrrigationPracticeSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source="field.name", read_only=True)
    method_name = serializers.CharField(source="irrigation_method.name", read_only=True)
    irrigation_method = serializers.PrimaryKeyRelatedField(queryset=IrrigationMethods.objects.all(), required=False, allow_null=True)
    scheduled_time = serializers.DateTimeField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = FieldIrrigationPractice
        fields = ("id", "field", "field_name", "irrigation_method", "method_name", "notes", "performed_at", "scheduled_time")

    def create(self, validated_data):
        # Map scheduled_time to performed_at if provided
        scheduled = validated_data.pop("scheduled_time", None)
        if scheduled and not validated_data.get("performed_at"):
            validated_data["performed_at"] = scheduled
        # Default irrigation_method from field current method if not provided
        if not validated_data.get("irrigation_method") and validated_data.get("field"):
            try:
                fim = FieldIrrigationMethod.objects.filter(field=validated_data["field"]).select_related("irrigation_method").first()
                if fim and fim.irrigation_method:
                    validated_data["irrigation_method"] = fim.irrigation_method
            except Exception:
                pass
        return super().create(validated_data)


class SoilTextureSerializer(serializers.ModelSerializer):
    class Meta:
        model = SoilTexture
        fields = ("id", "name", "icon")


class SoilReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = SoilReport
        fields = (
            "id",
            "field",
            "ph",
            "ec",
            "nitrogen",
            "phosphorous",
            "potassium",
            "boron",
            "copper",
            "iron",
            "zinc",
            "manganese",
            "soil_type",
            "report_link",
        )


class IrrigationMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = IrrigationMethods
        fields = ("id", "name")


class FeatureTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeatureType
        fields = ("id", "name", "description", "created_at", "updated_at")


class FeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feature
        fields = ("id", "name", "feature_type", "created_at", "updated_at")


class PlanSerializer(serializers.ModelSerializer):
    features = serializers.SerializerMethodField()

    class Meta:
        model = Plan
        fields = ("id", "name", "type", "price", "duration", "features")

    def get_features(self, obj):
        items = []
        try:
            for pf in obj.plan_features.select_related("feature").all():
                items.append(pf.feature.name)
        except Exception:
            pass
        return items


class PlanFeatureSerializer(serializers.ModelSerializer):
    feature_name = serializers.CharField(source="feature.name", read_only=True)

    class Meta:
        model = PlanFeature
        fields = (
            "id",
            "plan",
            "feature",
            "feature_name",
            "max_count",
            "duration_days",
            "created_at",
            "updated_at",
        )


class UserPlanSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    plan_details = PlanSerializer(source="plan", read_only=True)

    class Meta:
        model = UserPlan
        fields = ("id", "user", "plan", "plan_name", "plan_details", "start_date", "end_date", "expire_at", "is_active")


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.SerializerMethodField()
    receiver_name = serializers.SerializerMethodField()
    receiver_role = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "sender",
            "sender_name",
            "sender_role",
            "receiver",
            "receiver_name",
            "receiver_role",
            "message",
            "notification_type",
            "cause",
            "tags",
            "region",
            "crop_type",
            "metadata",
            "is_read",
            "created_at",
        )
        read_only_fields = ("sender", "receiver", "created_at")

    def _first_role(self, user: CustomUser | None):
        if not user:
            return None
        try:
            # Get all roles for the user
            all_roles = list(
                user.user_roles.select_related("role")
                .values_list("role__name", flat=True)
            )
            if not all_roles:
                return None
            
            # Prioritize non-end-user roles (for sender, we want their primary role)
            # Filter out End-App-User and similar variants
            non_end_user_roles = [
                r for r in all_roles
                if r and r.lower().replace("-", "").replace("_", "").replace(" ", "") not in ["endappuser", "enduser", "endusers"]
            ]
            
            # If there are non-end-user roles, return the first one
            if non_end_user_roles:
                return non_end_user_roles[0]
            
            # Otherwise, return the first role (which might be End-App-User)
            return all_roles[0]
        except Exception:
            return None

    def get_sender_name(self, obj):
        if obj.sender:
            return obj.sender.full_name or obj.sender.username or obj.sender.email
        return "System"

    def get_sender_role(self, obj):
        return self._first_role(obj.sender)

    def get_receiver_name(self, obj):
        if obj.receiver:
            return obj.receiver.full_name or obj.receiver.username or obj.receiver.email
        return None

    def get_receiver_role(self, obj):
        return self._first_role(obj.receiver)


class SupportRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportRequest
        fields = ("id", "user", "category", "description", "assigned_role", "created_at", "updated_at")
        read_only_fields = ("user", "assigned_role", "created_at", "updated_at")


class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = ("id", "file", "content_type", "object_id", "uploaded_at")


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = UserActivity
        fields = ("id", "action", "description", "created_at", "object_id")


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ("id", "brand", "last4", "exp_month", "exp_year", "is_primary", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")


class TransactionSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Transaction
        fields = (
            "id",
            "user",
            "user_username",
            "plan",
            "plan_name",
            "amount",
            "currency",
            "status",
            "transaction_type",
            "refund_reason",
            "invoice_pdf",
            "created_at",
        )


# Support Ticket Serializers

class TicketCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_roles = serializers.SerializerMethodField()

    class Meta:
        model = TicketComment
        fields = (
            "id",
            "ticket",
            "user",
            "user_name",
            "user_roles",
            "comment",
            "is_internal",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("user", "created_at", "updated_at")

    def get_user_roles(self, obj):
        try:
            return list(obj.user.user_roles.select_related("role").values_list("role__name", flat=True))
        except Exception:
            return []


class TicketHistorySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = TicketHistory
        fields = (
            "id",
            "ticket",
            "user",
            "user_name",
            "action",
            "description",
            "old_value",
            "new_value",
            "created_at",
        )
        read_only_fields = ("created_at",)


class SupportTicketSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    created_by_email = serializers.CharField(source="created_by.email", read_only=True)
    assigned_to_support_name = serializers.CharField(source="assigned_to_support.full_name", read_only=True)
    forwarded_to_user_name = serializers.CharField(source="forwarded_to_user.full_name", read_only=True)
    resolved_by_name = serializers.CharField(source="resolved_by.full_name", read_only=True)
    comments = TicketCommentSerializer(many=True, read_only=True)
    comments_count = serializers.SerializerMethodField()
    
    class Meta:
        model = SupportTicket
        fields = (
            "id",
            "ticket_number",
            "title",
            "description",
            "category",
            "created_by",
            "created_by_name",
            "created_by_email",
            "assigned_to_support",
            "assigned_to_support_name",
            "forwarded_to_role",
            "forwarded_to_user",
            "forwarded_to_user_name",
            "status",
            "priority",
            "created_at",
            "updated_at",
            "resolved_at",
            "closed_at",
            "resolution_notes",
            "resolved_by",
            "resolved_by_name",
            "comments",
            "comments_count",
        )
        read_only_fields = (
            "ticket_number",
            "created_by",
            "created_at",
            "updated_at",
        )

    def get_comments_count(self, obj):
        return obj.comments.count()


class SupportTicketCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for end-users creating tickets"""
    
    class Meta:
        model = SupportTicket
        fields = (
            "title",
            "description",
            "category",
            "priority",
        )

    def create(self, validated_data):
        # Auto-assign created_by from request user
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


