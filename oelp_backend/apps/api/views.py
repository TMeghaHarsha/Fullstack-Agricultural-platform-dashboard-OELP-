from __future__ import annotations

import csv
import io
import os
import secrets
import requests
from datetime import date, datetime, timedelta

from django.db import IntegrityError
from django.contrib.auth import authenticate
from django.db.models import Count, F, Q
from django.http import HttpResponse
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.conf import settings
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from apps.models_app.token import UserAuthToken
from apps.models_app.user import CustomUser, Role, UserRole

from .auth import TokenAuthentication
from .permissions import IsOwnerOrReadOnly, HasRole
from .serializers import (
    AssetSerializer,
    ActivitySerializer,
    RoleSerializer,
    CropSerializer,
    CropVarietySerializer,
    DeviceSerializer,
    FarmSerializer,
    FeatureSerializer,
    FeatureTypeSerializer,
    FieldIrrigationMethodSerializer,
    FieldIrrigationPracticeSerializer,
    FieldSerializer,
    CropLifecycleDatesSerializer,
    LoginSerializer,
    NotificationSerializer,
    SignUpSerializer,
    SoilReportSerializer,
    SoilTextureSerializer,
    SupportRequestSerializer,
    TokenSerializer,
    PlanSerializer,
    UserPlanSerializer,
    IrrigationMethodSerializer,
    PaymentMethodSerializer,
    TransactionSerializer,
    SupportTicketSerializer,
    SupportTicketCreateSerializer,
    TicketCommentSerializer,
    TicketHistorySerializer,
)

from apps.models_app.assets import Asset
from apps.models_app.crop_variety import Crop, CropVariety
from apps.models_app.farm import Farm
from apps.models_app.field import Field, Device, CropLifecycleDates, FieldIrrigationMethod, FieldIrrigationPractice
from apps.models_app.feature import Feature, FeatureType
from apps.models_app.plan import Plan
from apps.models_app.feature_plan import PlanFeature
from apps.models_app.user_plan import UserPlan, PlanFeatureUsage, PaymentMethod, Transaction, RefundPolicy
from apps.models_app.notifications import Notification, SupportRequest
from apps.models_app.support_ticket import SupportTicket, TicketComment, TicketHistory
from apps.models_app.irrigation import IrrigationMethods
from apps.models_app.models import UserActivity
from apps.models_app.soil_report import SoilReport, SoilTexture
from apps.utils.notification_utils import get_allowed_receivers, normalize_role, send_notification

razorpay = None

class SignUpView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def post(self, request):
        serializer = SignUpSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = serializer.save()
            # Ensure default role assignment for end users
            try:
                end_role, _ = Role.objects.get_or_create(name="End-App-User")
                UserRole.objects.get_or_create(user=user, role=end_role, defaults={"userrole_id": user.email or user.username})
            except Exception:
                pass
            token_value = secrets.token_urlsafe(48)
            UserAuthToken.objects.update_or_create(user=user, defaults={"access_token": token_value})
            
            from .serializers import UserSerializer
            return Response({"user": UserSerializer(user).data, "token": token_value}, status=status.HTTP_201_CREATED)
        except IntegrityError as e:
            # Handle duplicate email/username
            error_msg = str(e)
            if 'email' in error_msg:
                return Response({'email': ['A user with this email already exists.']}, status=status.HTTP_400_BAD_REQUEST)
            elif 'username' in error_msg:
                return Response({'username': ['A user with this username already exists.']}, status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response({'detail': 'User with these credentials already exists.'}, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            username = serializer.validated_data['username']
            password = serializer.validated_data['password']
            
            user = authenticate(username=username, password=password)
            
            if user:
                # Use UserAuthToken instead of Token
                token_value = secrets.token_urlsafe(48)
                UserAuthToken.objects.update_or_create(user=user, defaults={"access_token": token_value})
                
                # Get user roles
                try:
                    roles = list(user.user_roles.select_related("role").values_list("role__name", flat=True))
                except Exception:
                    roles = []
                
                return Response({
                    'token': token_value,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email if hasattr(user, 'email') else '',
                        'full_name': user.full_name if hasattr(user, 'full_name') else '',
                        'roles': roles,
                    }
                }, status=status.HTTP_200_OK)
            else:
                return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    authentication_classes = [TokenAuthentication]

    def post(self, request):
        try:
            request.user.auth_token.delete()
        except Exception:
            pass
        return Response({"detail": "Logged out"})


class MeView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .serializers import UserSerializer
        try:
            # Ensure user is authenticated
            if not request.user or not request.user.is_authenticated:
                return Response(
                    {"detail": "Authentication credentials were not provided."},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            serializer = UserSerializer(request.user)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {"detail": f"Error retrieving user data: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request):
        from .serializers import UserSerializer
        try:
            if not request.user or not request.user.is_authenticated:
                return Response(
                    {"detail": "Authentication credentials were not provided."},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            user = request.user
            allowed_fields = {"email", "username", "full_name", "phone_number", "avatar"}
            for key, value in request.data.items():
                if key in allowed_fields:
                    setattr(user, key, value)
            user.save()
            
            # Record profile update in activity log
            try:
                ct = ContentType.objects.get_for_model(user.__class__)
                UserActivity.objects.create(
                    user=user,
                    action="update",
                    content_type=ct,
                    object_id=user.pk,
                    description="Profile updated",
                )
            except Exception:
                pass
            
            serializer = UserSerializer(user)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {"detail": f"Error updating user data: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChangePasswordView(APIView):
    authentication_classes = [TokenAuthentication]

    def post(self, request):
        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")
        if not current_password or not new_password:
            return Response({"detail": "current_password and new_password are required"}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user
        if not user.check_password(current_password):
            return Response({"detail": "Current password is incorrect"}, status=status.HTTP_400_BAD_REQUEST)
        from django.contrib.auth import password_validation

        password_validation.validate_password(new_password, user)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        # Record activity in recent activity log
        try:
            ct = ContentType.objects.get_for_model(user.__class__)
            UserActivity.objects.create(
                user=user,
                action="update",
                content_type=ct,
                object_id=user.pk,
                description="Password changed",
            )
        except Exception:
            pass
        return Response({"detail": "Password changed successfully"})


class SuggestPasswordView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
        pw = secrets.token_urlsafe(12)
        return Response({"password": pw})


class ResetPasswordView(APIView):
    """Allow resetting password without current password.

    If authenticated, reset for the current user.
    If unauthenticated, requires a valid username to identify the account.
    """
    authentication_classes: list = []
    permission_classes: list = []

    def post(self, request):
        username = request.data.get("username")
        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")
        if not new_password or not confirm_password:
            return Response({"detail": "new_password and confirm_password are required"}, status=status.HTTP_400_BAD_REQUEST)
        if new_password != confirm_password:
            return Response({"detail": "Passwords do not match"}, status=status.HTTP_400_BAD_REQUEST)

        # Resolve user: prefer authenticated token if present; else username
        user: CustomUser | None = None
        try:
            auth_header = request.headers.get("Authorization") or ""
            if auth_header.startswith("Token "):
                token_value = auth_header.split(" ", 1)[1]
                token_obj = UserAuthToken.objects.filter(access_token=token_value).select_related("user").first()
                if token_obj:
                    user = token_obj.user
        except Exception:
            user = None
        if user is None and username:
            user = CustomUser.objects.filter(username=username).first()
        if user is None:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        from django.contrib.auth import password_validation
        password_validation.validate_password(new_password, user)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        # Record activity
        try:
            ct = ContentType.objects.get_for_model(user.__class__)
            UserActivity.objects.create(user=user, action="update", content_type=ct, object_id=user.pk, description="Password reset")
        except Exception:
            pass
        return Response({"detail": "Password reset successfully"})


class DashboardView(APIView):
    authentication_classes = [TokenAuthentication]

    def get(self, request):
        from django.utils import timezone

        user = request.user
        try:
            role_names = set(user.user_roles.select_related("role").values_list("role__name", flat=True))
        except Exception:
            role_names = set()
        privileged = user.is_superuser or bool({"SuperAdmin", "Admin", "Agronomist", "Analyst", "Business", "Developer"} & role_names)

        base_fields = Field.objects.filter(is_active=True)
        user_fields = base_fields if privileged else base_fields.filter(user=user)
        active_fields = user_fields.count()

        # Count fields with a crop assigned (considered active until harvested)
        # Prefer explicit lifecycle harvested flag when available, otherwise count assigned crops
        lifecycle_active = (
            CropLifecycleDates.objects
            .filter(field__in=user_fields, field__crop__isnull=False, harvesting_date__isnull=True)
            .values("field_id")
            .distinct()
            .count()
        )
        assigned_crops = user_fields.filter(crop__isnull=False).count()
        active_crops = max(lifecycle_active, assigned_crops)

        # Total area in hectares summed from JSON field
        total_hectares = 0.0
        for f in user_fields:
            try:
                hectares = (f.area or {}).get("hectares")
                if isinstance(hectares, (int, float)):
                    total_hectares += float(hectares)
            except Exception:
                pass

        # Get the most recent active plan that has a successful payment transaction
        # Prioritize paid plans over Free plans
        from django.db.models import Max
        successful_txns = Transaction.objects.filter(
            user=user, 
            status__in=["success", "paid", "completed"],
            transaction_type="payment"
        ).select_related("plan").order_by("-created_at")
        
        current_plan = None
        if successful_txns.exists():
            # Get the most recent successful transaction
            latest_txn = successful_txns.first()
            if latest_txn and latest_txn.plan:
                # Find the active UserPlan for this paid plan
                current_plan = UserPlan.objects.filter(
                    user=user,
                    plan=latest_txn.plan,
                    is_active=True
                ).select_related("plan").order_by("-created_at").first()
        
        # Fallback to any active plan if no paid plan found
        if not current_plan:
            plans = UserPlan.objects.filter(user=user, is_active=True).select_related("plan")
            current_plan = plans.order_by("-created_at").first()
        notifications_count = Notification.objects.filter(receiver=user, is_read=False).count()
        recent_practices_qs = (
            FieldIrrigationPractice.objects
            .filter(field__in=user_fields)
            .select_related("field", "irrigation_method")
            .order_by("-performed_at")[:3]
        )
        recent_practices = FieldIrrigationPracticeSerializer(recent_practices_qs, many=True).data
        recent_activity = UserActivity.objects.filter(user=user).order_by("-created_at")[:5]
        return Response(
            {
                "active_fields": active_fields,
                "active_crops": active_crops,
                "current_plan": UserPlanSerializer(current_plan).data if current_plan else None,
                "total_hectares": round(total_hectares, 4),
                "unread_notifications": notifications_count,
                "current_practices": recent_practices,
                "recent_activity": ActivitySerializer(recent_activity, many=True).data,
            }
        )


class MenuView(APIView):
    authentication_classes = [TokenAuthentication]

    def get(self, request):
        # Basic role/plan gate example
        base_items = [
            {"key": "dashboard", "label": "Dashboard"},
            {"key": "crops", "label": "Crops"},
            {"key": "fields", "label": "Fields"},
            {"key": "subscriptions", "label": "Subscriptions"},
            {"key": "reports", "label": "Reports"},
            {"key": "settings", "label": "Settings"},
        ]
        return Response(base_items)


class AdminUsersViewSet(viewsets.ModelViewSet):
    """Admin: manage users and assign roles."""

    authentication_classes = [TokenAuthentication]
    permission_classes = [HasRole]
    required_roles = ["SuperAdmin", "Admin", "Analyst", "Business", "Developer"]

    def get_queryset(self):
        return CustomUser.objects.all().order_by("-date_joined")

    def get_serializer_class(self):  # defer import to avoid circular timing
        from .serializers import UserSerializer as _UserSerializer

        return _UserSerializer

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        obj_id = user.pk
        obj_name = user.full_name or user.username or str(user.pk)
        resp = super().destroy(request, *args, **kwargs)
        # Record deletion activity by actor
        try:
            ct = ContentType.objects.get_for_model(user.__class__)
            UserActivity.objects.create(
                user=request.user,
                action="delete",
                content_type=ct,
                object_id=obj_id,
                description=f"Deleted admin: {obj_name}",
            )
        except Exception:
            pass
        return resp

    @action(detail=True, methods=["post"], url_path="assign-role")
    def assign_role(self, request, pk=None):
        user = self.get_object()
        role_name = request.data.get("role")
        if not role_name:
            return Response({"detail": "role is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Determine acting user's roles
        try:
            actor_roles = set(
                request.user.user_roles.select_related("role").values_list("role__name", flat=True)
            )
        except Exception:
            actor_roles = set()

        # SuperAdmin (or Django superuser) can assign any role
        is_super_admin = request.user.is_superuser or ("SuperAdmin" in actor_roles)
        if not is_super_admin:
            # Admins can assign non-end-user, non-admin, non-superadmin roles only
            if "Admin" in actor_roles:
                disallowed = {"SuperAdmin", "Admin", "End-App-User"}
                if role_name in disallowed:
                    return Response({"detail": "Admins cannot assign this role"}, status=status.HTTP_403_FORBIDDEN)
            else:
                return Response({"detail": "Only SuperAdmin or Admin can assign roles"}, status=status.HTTP_403_FORBIDDEN)

        role, _ = Role.objects.get_or_create(name=role_name)
        UserRole.objects.get_or_create(
            user=user, role=role, defaults={"userrole_id": user.email or user.username}
        )
        # Ensure a 'create' activity exists for this user with the acting admin as creator
        try:
            from django.contrib.contenttypes.models import ContentType
            ct = ContentType.objects.get_for_model(user.__class__)
            has_create = UserActivity.objects.filter(content_type=ct, object_id=user.pk, action="create").exists()
            if not has_create:
                UserActivity.objects.create(
                    user=request.user,
                    action="create",
                    content_type=ct,
                    object_id=user.pk,
                    description=f"Created employee: {user.full_name or user.username}",
                )
        except Exception:
            pass
        serializer = self.get_serializer(user)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="create-admin")
    def create_admin(self, request):
        # Only SuperAdmin can create Admin accounts
        roles = set(request.user.user_roles.select_related("role").values_list("role__name", flat=True))
        if not (request.user.is_superuser or ("SuperAdmin" in roles)):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        full_name = request.data.get("full_name") or request.data.get("name")
        raw_username = request.data.get("username")
        password = request.data.get("password")
        phone_number = request.data.get("phone_number")
        region = request.data.get("region")  # optional, currently stored nowhere explicit
        if not raw_username or not password or not full_name:
            return Response({"detail": "full_name, username, password are required"}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize username (strip any domain) and set corporate email
        try:
            base_username = str(raw_username).strip()
            if "@" in base_username:
                base_username = base_username.split("@", 1)[0]
            # remove spaces and illegal chars
            import re
            base_username = re.sub(r"[^a-zA-Z0-9._-]", "", base_username)
        except Exception:
            base_username = raw_username
        email = f"{base_username}@agriplatform.com"

        # Create user with normalized username/email and optional phone
        user = CustomUser.objects.create_user(
            username=base_username,
            password=password,
            full_name=full_name,
            email=email,
        )
        if phone_number:
            try:
                user.phone_number = phone_number
                user.save(update_fields=["phone_number"])
            except Exception:
                pass
        # Assign ONLY Admin role
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        UserRole.objects.get_or_create(user=user, role=admin_role, defaults={"userrole_id": user.email or user.username})
        # Ensure End-App-User role is NOT attached
        try:
            end_role = Role.objects.get(name="End-App-User")
            UserRole.objects.filter(user=user, role=end_role).delete()
        except Role.DoesNotExist:
            pass
        # Record activity for creator (SuperAdmin)
        try:
            ct = ContentType.objects.get_for_model(user.__class__)
            UserActivity.objects.create(
                user=request.user,
                action="create",
                content_type=ct,
                object_id=user.pk,
                description=f"Created admin: {user.full_name or user.username}",
            )
        except Exception:
            pass
        return Response({"user": UserSerializer(user).data}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="dedupe-roles")
    def dedupe_roles(self, request, pk=None):
        # Remove any duplicate End-App-User role for Admin users
        user = self.get_object()
        roles = set(user.user_roles.select_related("role").values_list("role__name", flat=True))
        if "Admin" in roles:
            try:
                end_role = Role.objects.get(name="End-App-User")
                UserRole.objects.filter(user=user, role=end_role).delete()
            except Role.DoesNotExist:
                pass
        return Response({"roles": list(user.user_roles.select_related("role").values_list("role__name", flat=True))})

    @action(detail=False, methods=["post"], url_path="dedupe-roles-bulk")
    def dedupe_roles_bulk(self, request):
        """Remove End-App-User role from users who also have other roles. SuperAdmin only."""
        roles = set(request.user.user_roles.select_related("role").values_list("role__name", flat=True))
        if not (request.user.is_superuser or ("SuperAdmin" in roles)):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        try:
            end_role = Role.objects.get(name="End-App-User")
        except Role.DoesNotExist:
            return Response({"removed": 0, "detail": "End-App-User role not found"})

        # Users who have End-App-User and at least one other role
        from django.db.models import Count
        candidate_user_ids = (
            UserRole.objects
            .values("user_id")
            .annotate(rc=Count("role_id"))
            .filter(rc__gt=1)
            .values_list("user_id", flat=True)
        )
        qs = UserRole.objects.filter(user_id__in=candidate_user_ids, role=end_role)
        removed = qs.count()
        qs.delete()
        return Response({"removed": removed})


class UsersReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [HasRole]
    required_roles = ["SuperAdmin", "Admin", "Agronomist", "Analyst", "Business", "Developer", "Support"]

    def get_queryset(self):
        # Only return pure End-App-Users (exclude users who also have privileged roles)
        end_user_qs = CustomUser.objects.filter(is_active=True, user_roles__role__name="End-App-User").distinct()
        privileged_roles = [
            "SuperAdmin", "Admin", "Analyst", "Business", "Developer", "Support", "Agronomist", "Manager",
        ]
        mixed_ids = (
            CustomUser.objects
            .filter(id__in=end_user_qs.values_list("id", flat=True), user_roles__role__name__in=privileged_roles)
            .values_list("id", flat=True)
        )
        return end_user_qs.exclude(id__in=mixed_ids).order_by("-date_joined")

    def get_serializer_class(self):
        from .serializers import UserSerializer as _UserSerializer
        return _UserSerializer

class AdminRolesViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [HasRole]
    required_roles = ["SuperAdmin", "Admin", "Business", "Developer"]
    queryset = Role.objects.all().order_by("name")
    serializer_class = RoleSerializer


class AdminFieldViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [HasRole]
    required_roles = ["SuperAdmin", "Admin", "Analyst", "Agronomist", "Business", "Developer"]
    queryset = Field.objects.select_related("user", "farm", "crop", "crop_variety", "soil_type")
    serializer_class = FieldSerializer


class AdminAnalyticsView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [HasRole]
    required_roles = ["SuperAdmin", "Admin", "Analyst", "Business", "Developer"]

    def get(self, request):
        # Role of requester for UI
        role_names = list(request.user.user_roles.select_related("role").values_list("role__name", flat=True))
        # Stats per requirements
        # Total revenue from transactions
        try:
            total_revenue = (
                Transaction.objects.all().aggregate(total=Count("id"))  # fallback count if no sum
            )
        except Exception:
            total_revenue = {"total": 0}
        try:
            from django.db.models import Sum

            # Sum successful payment transactions, exclude refunds
            # Include payments that may have been marked 'refunded' so the ledger remains consistent
            payments_sum = (
                Transaction.objects.filter(status__in=["success", "paid", "completed", "refunded"], transaction_type="payment").aggregate(sum_amt=Sum("amount"))
            )["sum_amt"] or 0
            # Sum successful refund transactions
            refunds_sum = (
                Transaction.objects.filter(status__in=["success", "paid", "completed"], transaction_type="refund").aggregate(sum_amt=Sum("amount"))
            )["sum_amt"] or 0
            # Revenue = payments - refunds
            revenue_amount = payments_sum - refunds_sum
        except Exception:
            revenue_amount = 0

        # Active end-users: users who have ONLY the End-App-User role (no other roles)
        try:
            from django.db.models import Q
            end_user_ids = (
                CustomUser.objects
                .filter(is_active=True, user_roles__role__name="End-App-User")
                .values_list("id", flat=True)
            )
            # Exclude anyone who also has any non end-user role
            privileged_roles = [
                "SuperAdmin", "Admin", "Analyst", "Business", "Developer", "Support", "Agronomist", "Manager",
            ]
            mixed_ids = (
                CustomUser.objects
                .filter(id__in=end_user_ids, user_roles__role__name__in=privileged_roles)
                .values_list("id", flat=True)
            )
            active_end_users = (
                CustomUser.objects.filter(id__in=end_user_ids).exclude(id__in=mixed_ids).distinct().count()
            )
        except Exception:
            active_end_users = 0
        # Total fields
        total_fields = Field.objects.count()
        # Active admins (exclude SuperAdmin)
        active_admins = (
            CustomUser.objects.filter(is_active=True, user_roles__role__name="Admin").distinct().count()
        )

        # Business-centric analytics
        from django.db.models.functions import TruncDate
        from django.db.models import Sum, Case, When, F, Value, FloatField
        last_7_days = datetime.now().date() - timedelta(days=6)
        # Compute net amount per day: payments add, refunds subtract
        revenue_daily_qs = (
            Transaction.objects.filter(created_at__date__gte=last_7_days, status__in=["success", "paid", "completed", "refunded"])
            .annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(amount=Sum(
                Case(
                    When(transaction_type="refund", then=F("amount") * Value(-1.0)),
                    When(transaction_type="payment", then=F("amount")),
                    default=Value(0.0),
                    output_field=FloatField(),
                )
            ))
            .order_by("day")
        )
        revenue_by_day = [
            {"name": row["day"].isoformat() if getattr(row.get("day"), "isoformat", None) else str(row.get("day")), "value": float(row["amount"] or 0)}
            for row in revenue_daily_qs
        ]
        
        # Ensure we have data for all 7 days (fill missing days with 0)
        if len(revenue_by_day) < 7:
            existing_dates = {row["name"] for row in revenue_by_day}
            for i in range(7):
                day = (datetime.now().date() - timedelta(days=6-i)).isoformat()
                if day not in existing_dates:
                    revenue_by_day.append({"name": day, "value": 0})
            revenue_by_day.sort(key=lambda x: x["name"])
        
        # Calculate weekly revenue (last 7 days)
        weekly_revenue = sum(row["value"] for row in revenue_by_day)
        
        # Transactions by status
        txn_status_counts = (
            Transaction.objects.values("status").annotate(cnt=Count("id")).order_by("-cnt")
        )
        transactions_by_status = [
            {"name": (row["status"] or "unknown"), "value": row["cnt"]} for row in txn_status_counts
        ]
        # Plan distribution (active user plans by plan)
        plan_counts = (
            UserPlan.objects.filter(is_active=True).values("plan__name").annotate(cnt=Count("id")).order_by("-cnt")
        )
        plan_distribution = [
            {"name": (row["plan__name"] or "Unknown"), "value": row["cnt"]} for row in plan_counts
        ]

        # Recent activity for this user
        recent_activity = UserActivity.objects.filter(user=request.user).order_by("-created_at")[:6]

        return Response(
            {
                "role_names": role_names,
                "stats": {
                    "total_revenue": float(revenue_amount) if revenue_amount is not None else 0,
                    "weekly_revenue": float(weekly_revenue),
                    "active_end_users": active_end_users,
                    "total_fields": total_fields,
                    "active_admins": active_admins,
                    "active_employees": CustomUser.objects.filter(
                        is_active=True,
                        user_roles__role__name__in=["Analyst","Agronomist","Support","Business","Developer"],
                    ).distinct().count(),
                },
                "revenue_by_day": revenue_by_day,
                "transactions_by_status": transactions_by_status,
                "plan_distribution": plan_distribution,
                "recent_activity": ActivitySerializer(recent_activity, many=True).data,
            }
        )


class RefundsSummaryView(APIView):
    """Admin-only view that returns sums for payments and refunds and net revenue"""
    authentication_classes = [TokenAuthentication]
    permission_classes = [HasRole]
    required_roles = ["SuperAdmin", "Admin"]

    def get(self, request):
        from django.db.models import Sum
        payments_sum = (
            Transaction.objects.filter(status__in=["success", "paid", "completed", "refunded"], transaction_type="payment").aggregate(sum_amt=Sum("amount"))
        )["sum_amt"] or 0
        refunds_sum = (
            Transaction.objects.filter(status__in=["success", "paid", "completed", "refunded"], transaction_type="refund").aggregate(sum_amt=Sum("amount"))
        )["sum_amt"] or 0
        return Response({"payments_sum": float(payments_sum), "refunds_sum": float(refunds_sum), "net_revenue": float(payments_sum - refunds_sum)})


class PlanFeatureViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [HasRole]
    required_roles = ["SuperAdmin", "Admin", "Business", "Developer"]

    def get_queryset(self):
        qs = PlanFeature.objects.select_related("plan", "feature").all()
        plan_id = self.request.query_params.get("plan") or self.request.query_params.get("plan_id")
        if plan_id:
            try:
                qs = qs.filter(plan_id=plan_id)
            except Exception:
                pass
        return qs

    def get_serializer_class(self):
        from .serializers import PlanFeatureSerializer as _PlanFeatureSerializer
        return _PlanFeatureSerializer


class EnsureRoleView(APIView):
    authentication_classes = [TokenAuthentication]

    def post(self, request):
        role_name = request.data.get("role")
        if not role_name:
            return Response({"detail": "role is required"}, status=status.HTTP_400_BAD_REQUEST)
        # Only allow all users to ensure the default end-user role for themselves.
        # Elevating to privileged roles requires SuperAdmin (or Django superuser).
        try:
            user_roles = set(
                request.user.user_roles.select_related("role").values_list("role__name", flat=True)
            )
        except Exception:
            user_roles = set()
        if role_name != "End-App-User":
            is_super_admin = request.user.is_superuser or ("SuperAdmin" in user_roles)
            if not is_super_admin:
                return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        role, _ = Role.objects.get_or_create(name=role_name)
        UserRole.objects.get_or_create(
            user=request.user, role=role, defaults={"userrole_id": request.user.email or request.user.username}
        )
        roles = list(
            request.user.user_roles.select_related("role").values_list("role__name", flat=True)
        )
        return Response({"roles": roles})


class CropViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    queryset = Crop.objects.all()
    serializer_class = CropSerializer
    filterset_fields = ["name"]
    search_fields = ["name"]
    ordering_fields = ["name"]


class CropVarietyViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    queryset = CropVariety.objects.select_related("crop").all()
    serializer_class = CropVarietySerializer
    filterset_fields = ["crop", "name", "is_primary"]
    search_fields = ["name", "crop__name"]
    ordering_fields = ["name"]


class FarmViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    serializer_class = FarmSerializer
    filterset_fields = ["name"]
    search_fields = ["name"]
    ordering_fields = ["name"]

    def get_queryset(self):
        return Farm.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class FieldViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    serializer_class = FieldSerializer
    filterset_fields = ["farm", "crop", "is_active"]
    search_fields = ["name", "location_name"]
    ordering_fields = ["created_at", "updated_at", "name"]

    def get_queryset(self):
        return Field.objects.filter(user=self.request.user).select_related("farm", "crop", "crop_variety")

    def perform_create(self, serializer):
        # Map size_acres to area.hectares if provided on create
        size_acres = None
        try:
            raw = self.request.data.get("size_acres")
            if raw is not None and raw != "":
                size_acres = float(raw)
        except Exception:
            size_acres = None
        area = None
        if size_acres is not None:
            try:
                area = {"hectares": round(size_acres / 2.47105, 6)}
            except Exception:
                area = None
        field = serializer.save(user=self.request.user, area=area if area else None)
        # Persist irrigation method relation when passed during create
        try:
            method_id = self.request.data.get("irrigation_method")
            if method_id:
                method = IrrigationMethods.objects.get(pk=method_id)
                FieldIrrigationMethod.objects.update_or_create(field=field, defaults={"irrigation_method": method})
        except Exception:
            pass

    @action(detail=True, methods=["get"])
    def lifecycle(self, request, pk=None):
        field = self.get_object()
        data = CropLifecycleDates.objects.filter(field=field).values(
            "sowing_date",
            "growth_start_date",
            "flowering_date",
            "harvesting_date",
            "yield_amount",
        ).first()
        return Response(data or {})

    @action(detail=True, methods=["post"])
    def update_lifecycle(self, request, pk=None):
        field = self.get_object()
        payload = {
            "sowing_date": request.data.get("sowing_date"),
            "growth_start_date": request.data.get("growth_start_date"),
            "flowering_date": request.data.get("flowering_date"),
            "harvesting_date": request.data.get("harvesting_date"),
            "yield_amount": request.data.get("yield_amount"),
        }
        obj, _ = CropLifecycleDates.objects.update_or_create(field=field, defaults=payload)
        return Response(CropLifecycleDatesSerializer(obj).data)

    def partial_update(self, request, *args, **kwargs):
        # Allow updating Field normally, and handle irrigation_method specially
        response = None
        # Map size_acres to area.hectares when present (update instance directly to avoid mutable issues)
        try:
            raw = request.data.get("size_acres")
            if raw is not None and raw != "":
                acres = float(raw)
                fld = self.get_object()
                fld.area = {"hectares": round(acres / 2.47105, 6)}
                fld.save(update_fields=["area"])
        except Exception:
            pass
        method_id = request.data.get("irrigation_method")
        if method_id:
            try:
                field = self.get_object()
                method = IrrigationMethods.objects.get(pk=method_id)
                FieldIrrigationMethod.objects.update_or_create(field=field, defaults={"irrigation_method": method})
            except IrrigationMethods.DoesNotExist:
                return Response({"detail": "Invalid irrigation_method"}, status=status.HTTP_400_BAD_REQUEST)
        # Proceed with default partial update for other fields
        response = super().partial_update(request, *args, **kwargs)
        # Return fresh serialized field with derived attributes
        field = self.get_object()
        return Response(FieldSerializer(field).data)

    def update(self, request, *args, **kwargs):
        # Support PUT updates, including irrigation method mapping and size conversion
        try:
            raw = request.data.get("size_acres")
            if raw is not None and raw != "":
                acres = float(raw)
                fld = self.get_object()
                fld.area = {"hectares": round(acres / 2.47105, 6)}
                fld.save(update_fields=["area"])
        except Exception:
            pass
        response = super().update(request, *args, **kwargs)
        # After update, persist irrigation method relationship if provided
        try:
            method_id = request.data.get("irrigation_method")
            if method_id:
                field = self.get_object()
                method = IrrigationMethods.objects.get(pk=method_id)
                FieldIrrigationMethod.objects.update_or_create(field=field, defaults={"irrigation_method": method})
                # return refreshed representation
                return Response(FieldSerializer(field).data)
        except Exception:
            pass
        return response

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj_id = obj.pk
        resp = super().destroy(request, *args, **kwargs)
        # Record activity
        try:
            ct = ContentType.objects.get_for_model(obj.__class__)
            UserActivity.objects.create(
                user=request.user,
                action="delete",
                content_type=ct,
                object_id=obj_id,
                description=f"Field delete",
            )
        except Exception:
            pass
        return resp

    @action(detail=True, methods=["post"], url_path="set_irrigation_method")
    def set_irrigation_method(self, request, pk=None):
        field = self.get_object()
        method_id = request.data.get("irrigation_method")
        if not method_id:
            return Response({"detail": "irrigation_method is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            method = IrrigationMethods.objects.get(pk=method_id)
        except IrrigationMethods.DoesNotExist:
            return Response({"detail": "Invalid irrigation_method"}, status=status.HTTP_400_BAD_REQUEST)
        FieldIrrigationMethod.objects.update_or_create(field=field, defaults={"irrigation_method": method})
        return Response({"detail": "Irrigation method set"})


class SoilReportViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    queryset = SoilReport.objects.select_related("field", "soil_type").all()
    serializer_class = SoilReportSerializer
    filterset_fields = ["field", "soil_type"]

    def perform_create(self, serializer):
        report = serializer.save()
        # Set a convenient report link to the PDF export filtered by field
        try:
            report.report_link = f"/api/reports/export/pdf/?field_id={report.field_id}"
            report.save(update_fields=["report_link"])
        except Exception:
            pass


class SoilTextureViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    queryset = SoilTexture.objects.all()
    serializer_class = SoilTextureSerializer


class IrrigationMethodViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    queryset = IrrigationMethods.objects.all()
    serializer_class = IrrigationMethodSerializer
    search_fields = ["name"]


class FieldIrrigationPracticeViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    serializer_class = FieldIrrigationPracticeSerializer

    def get_queryset(self):
        return FieldIrrigationPractice.objects.filter(field__user=self.request.user).select_related("field", "irrigation_method")


class AssetViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    queryset = Asset.objects.all()
    serializer_class = AssetSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [TokenAuthentication]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        user = self.request.user
        scope = (self.request.query_params.get("type") or "received").lower()
        qs = Notification.objects.select_related("sender", "receiver")
        if scope == "sent":
            qs = qs.filter(sender=user)
        else:
            qs = qs.filter(receiver=user)
        if self.request.query_params.get("unread_only") in {"1", "true", "True"}:
            qs = qs.filter(is_read=False)
        return qs.order_by("-created_at")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        cnt = self.get_queryset().filter(is_read=False).count()
        return Response({"count": cnt})

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response({"detail": "Marked as read"})

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"detail": f"{updated} notifications marked as read"})


class SupportRequestViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    serializer_class = SupportRequestSerializer

    def get_queryset(self):
        return SupportRequest.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        obj = serializer.save(user=self.request.user)
        # Auto route to appropriate roles and create notifications (Support flows)
        try:
            category = obj.category
            # Map categories to roles that should be notified
            category_roles_map = {
                "transaction": ["Business", "Support", "Admin"],
                "analysis": ["Analyst", "Support", "Admin"],
                "software_issue": ["Development", "Support", "Admin"],
                "crop": ["Agronomist", "Support", "Admin"],
            }
            target_roles = category_roles_map.get(category, ["Support", "Admin"])
            # Ensure we do not include SuperAdmin per requirements
            target_roles = [r for r in target_roles if r != "SuperAdmin"]
            # Persist the first assigned role for quick triage
            try:
                obj.assigned_role = target_roles[0]
                obj.save(update_fields=["assigned_role"])
            except Exception:
                pass
            users = CustomUser.objects.filter(user_roles__role__name__in=target_roles).distinct()
            for u in users:
                Notification.objects.create(
                    sender=self.request.user,
                    receiver=u,
                    message=f"Support request ({category}) from {self.request.user.username}: {obj.description[:140]}",
                    notification_type="support",
                    cause="support_request",
                    tags={"category": category},
                    metadata={"support_request_id": obj.id},
                )
        except Exception:
            # Non-critical
            pass


class NotificationCenterViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [HasRole]
    required_roles = [
        "SuperAdmin",
        "Admin",
        "Support",
        "Business",
        "Developer",
        "Analyst",
        "Agronomist",
    ]
    serializer_class = NotificationSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        scope = (self.request.query_params.get("type") or "received").lower()
        qs = Notification.objects.select_related("sender", "receiver").order_by("-created_at")
        if scope == "sent":
            qs = qs.filter(sender=user)
        elif scope == "all":
            qs = qs.filter(Q(sender=user) | Q(receiver=user))
        else:
            qs = qs.filter(receiver=user)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def _allowed_roles(self, user: CustomUser) -> set[str]:
        role_names = user.user_roles.select_related("role").values_list("role__name", flat=True)
        allowed: set[str] = set()
        for role in role_names:
            allowed.update(get_allowed_receivers(role).get("roles", []))
        normalized = {normalize_role(r) for r in allowed if r}
        return normalized

    @action(detail=False, methods=["get"], url_path="allowed-receivers")
    def allowed_receivers(self, request):
        allowed = sorted(filter(None, self._allowed_roles(request.user)))
        return Response({"allowed_receivers": allowed})

    def create(self, request, *args, **kwargs):
        message = (request.data.get("message") or "").strip()
        if not message:
            return Response({"detail": "Message is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Accept either a single role or multiple roles from the payload
        raw_roles = (
            request.data.get("receiver_roles")
            or request.data.get("target_roles")
            or request.data.get("receiver_role")
            or request.data.get("target_role")
        )

        if not raw_roles:
            return Response(
                {"detail": "At least one receiver role is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Normalise into a list
        if isinstance(raw_roles, (list, tuple, set)):
            receiver_roles = list(raw_roles)
        else:
            receiver_roles = [raw_roles]

        # Normalise role names and drop empties
        normalized_roles = [normalize_role(r) for r in receiver_roles if r]
        if not normalized_roles:
            return Response(
                {"detail": "At least one valid receiver role is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed = self._allowed_roles(request.user)
        # Find any roles not permitted for this sender
        invalid = [r for r in normalized_roles if r not in allowed]
        if invalid:
            return Response(
                {
                    "detail": (
                        "One or more receiver roles are not allowed for your account: "
                        + ", ".join(sorted(set(invalid)))
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        notification_type = request.data.get("notification_type", "general")
        cause = request.data.get("cause", "user_action")
        region = request.data.get("region")
        crop_type = request.data.get("crop_type")
        tags = request.data.get("tags")
        metadata = request.data.get("metadata")

        sent_count, details = send_notification(
            sender=request.user,
            message=message,
            receiver_roles=normalized_roles,
            notification_type=notification_type,
            cause=cause,
            tags=tags if isinstance(tags, dict) else {},
            region=region,
            crop_type=crop_type,
            metadata=metadata if isinstance(metadata, dict) else {},
        )

        if not sent_count:
            return Response({"detail": "No recipients matched the criteria."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"sent": sent_count, "details": details}, status=status.HTTP_201_CREATED)


class PracticeViewSet(viewsets.GenericViewSet, mixins.ListModelMixin):
    authentication_classes = [TokenAuthentication]
    # Placeholder for practices list
    def list(self, request, *args, **kwargs):
        # Could be tied to crop lifecycle tracking
        return Response([])


class FeatureViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    queryset = Feature.objects.select_related("feature_type").all()
    serializer_class = FeatureSerializer


class FeatureTypeViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    queryset = FeatureType.objects.all()
    serializer_class = FeatureTypeSerializer


class PlanViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer


class UserPlanViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    queryset = UserPlan.objects.select_related("user", "plan").all()
    serializer_class = UserPlanSerializer

    def get_queryset(self):
        return UserPlan.objects.filter(user=self.request.user).select_related("plan").order_by("-created_at")
    
    def list(self, request, *args, **kwargs):
        # Return the most recent active paid plan (based on successful transactions)
        queryset = self.get_queryset()
        successful_txns = Transaction.objects.filter(
            user=request.user,
            status__in=["success", "paid", "completed"],
            transaction_type="payment"
        ).select_related("plan").order_by("-created_at")

        current_plan = None
        if successful_txns.exists():
            latest_txn = successful_txns.first()
            if latest_txn and latest_txn.plan:
                current_plan = queryset.filter(
                    plan=latest_txn.plan,
                    is_active=True
                ).first()

        if not current_plan:
            current_plan = queryset.filter(is_active=True).first()

        if current_plan:
            data = self.get_serializer(current_plan).data
            return Response({"results": [data]})
        else:
            return Response({"results": []})

    def perform_create(self, serializer):
        plan_data = serializer.validated_data.get("plan")
        if not plan_data:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Plan is required")
        
        # Check if trying to subscribe to top-up plan
        if plan_data.type == "topup" or (plan_data.name and "topup" in plan_data.name.lower()):
            # Check if user has an active main plan
            has_main_plan = UserPlan.objects.filter(
                user=self.request.user,
                is_active=True,
                expire_at__gt=timezone.now()
            ).filter(
                Q(plan__type="main") | Q(plan__name__icontains="MainPlan")
            ).exists()
            
            if not has_main_plan:
                from rest_framework.exceptions import ValidationError
                raise ValidationError(
                    "Top-up plan requires an active Main plan. Please subscribe to Main plan first."
                )
        
        # Check if user has an active paid subscription
        active_paid = UserPlan.objects.filter(
            user=self.request.user,
            is_active=True
        ).exclude(plan__name__iexact="Free").select_related("plan").first()
        
        if active_paid:
            # Check if there's a successful transaction for this plan
            has_paid = Transaction.objects.filter(
                user=self.request.user,
                plan=active_paid.plan,
                status__in=["success", "paid", "completed"],
                transaction_type="payment"
            ).exists()
            
            if has_paid and active_paid.expire_at and active_paid.expire_at > timezone.now():
                from rest_framework.exceptions import ValidationError
                raise ValidationError(
                    f"You have an active subscription ({active_paid.plan.name}) until {active_paid.expire_at.date()}. "
                    "Please cancel your current subscription before selecting a new plan."
                )
        
        user_plan = serializer.save(user=self.request.user)
        try:
            # Record a simple transaction entry for the selected plan
            Transaction.objects.create(
                user=self.request.user,
                plan=user_plan.plan,
                amount=user_plan.plan.price,
                currency="USD",
                status="paid",
                transaction_type="payment",
            )
        except Exception:
            pass
        # Record activity
        try:
            ct = ContentType.objects.get_for_model(user_plan.__class__)
            UserActivity.objects.create(
                user=self.request.user,
                action="create",
                content_type=ct,
                object_id=user_plan.pk,
                description=f"Selected plan {getattr(user_plan.plan, 'name', '-')}",
            )
        except Exception:
            pass
        # Auto notify user (Business flow) about subscription
        try:
            Notification.objects.create(
                sender=None,
                receiver=self.request.user,
                message=f"Your subscription to {getattr(user_plan.plan, 'name', '-')} is active."
            )
        except Exception:
            pass

    @action(detail=True, methods=["get"], url_path="refund-info")
    def refund_info(self, request, pk=None):
        """Get refund information for a subscription"""
        user_plan = self.get_object()
        if not user_plan.plan:
            return Response({"detail": "Plan not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Find the most recent successful payment transaction for this plan
        payment_txn = Transaction.objects.filter(
            user=request.user,
            plan=user_plan.plan,
            status__in=["success", "paid", "completed"],
            transaction_type="payment"
        ).order_by("-created_at").first()

        used_fallback = False
        if not payment_txn:
            # Fallback: use the most recent successful payment for the user (regardless of plan)
            payment_txn = Transaction.objects.filter(
                user=request.user,
                status__in=["success", "paid", "completed"],
                transaction_type="payment"
            ).order_by("-created_at").first()
            used_fallback = True
        
        # Get refund policy for this plan type (may be None)
        refund_policy = RefundPolicy.objects.filter(plan_type=user_plan.plan.type).first()
        from django.utils import timezone
        days_since = (timezone.now() - payment_txn.created_at).days if payment_txn and payment_txn.created_at else 0

        refund_policy_data = None
        refund_amount = 0
        refund_available = False

        if refund_policy:
            refund_policy_data = {
                "percentage": float(refund_policy.refund_percentage),
                "days_after_purchase": refund_policy.days_after_purchase,
            }
            refund_available = days_since <= refund_policy.days_after_purchase
            if refund_available:
                refund_amount = float(payment_txn.amount) * (float(refund_policy.refund_percentage) / 100)
        else:
            # No refund policy configured: default to full refund
            refund_policy_data = None
            refund_available = True
            # Prefer payment txn amount, else fall back to plan price
            refund_amount = float(payment_txn.amount) if payment_txn and getattr(payment_txn, 'amount', None) is not None else float(getattr(user_plan.plan, 'price', 0) or 0)

        return Response({
            "refund_available": refund_available,
            "refund_policy": refund_policy_data,
            "payment_info": {
                "amount": float(payment_txn.amount) if payment_txn and getattr(payment_txn, 'amount', None) is not None else float(getattr(user_plan.plan, 'price', 0) or 0),
                "date": payment_txn.created_at.isoformat() if payment_txn and getattr(payment_txn, 'created_at', None) else None,
                "days_since": days_since,
            },
            "refund_amount": round(refund_amount, 2),
            "reason": (
                f"Refund available: {refund_policy.refund_percentage}% within {refund_policy.days_after_purchase} days" if refund_policy and refund_available else (
                    f"Refund period expired ({days_since} days since purchase, policy allows {refund_policy.days_after_purchase} days)" if refund_policy and not refund_available else "No refund policy configured (full refund possible)"
                )
            ),
            "used_fallback_payment": used_fallback,
            "payment_txn_id": payment_txn.id if payment_txn else None,
        })
    
    @action(detail=True, methods=["post"], url_path="downgrade")
    def downgrade(self, request, pk=None):
        """Downgrade user plan to Free plan with optional refund"""
        user_plan = self.get_object()
        refund_reason = request.data.get("refund_reason", "")
        request_refund = request.data.get("request_refund", False)
        
        try:
            # Find Free plan
            free_plan = Plan.objects.filter(name__iexact="Free").first()
            if not free_plan:
                return Response({"detail": "Free plan not found"}, status=status.HTTP_404_NOT_FOUND)
            
            refund_amount = 0
            refund_txn = None
            
            # Process refund if requested
            if request_refund:
                from django.utils import timezone
                payment_txn = Transaction.objects.filter(
                    user=request.user,
                    plan=user_plan.plan,
                    status__in=["success", "paid", "completed"],
                    transaction_type="payment"
                ).order_by("-created_at").first()
                
                if payment_txn:
                    refund_policy = RefundPolicy.objects.filter(plan_type=user_plan.plan.type).first()
                    # If a refund policy exists, honor its rules. Otherwise, allow a full refund.
                    if refund_policy:
                        days_since = (timezone.now() - payment_txn.created_at).days
                        if days_since <= refund_policy.days_after_purchase:
                            refund_amount = float(payment_txn.amount) * (float(refund_policy.refund_percentage) / 100)
                    else:
                        # No refund policy configured: default to full refund
                        refund_amount = float(payment_txn.amount)

                    if refund_amount > 0:
                        # Create refund transaction
                        refund_txn = Transaction.objects.create(
                            user=request.user,
                            plan=user_plan.plan,
                            amount=refund_amount,
                            currency=payment_txn.currency,
                            status="success",
                            transaction_type="refund",
                            refund_reason=refund_reason or "Subscription cancelled by user",
                            provider_payment_id=payment_txn.provider_payment_id,
                        )
                        # Do NOT change the original payment.status here — keep ledger consistent by adding explicit refund txn
            
            # Deactivate current plan
            user_plan.is_active = False
            user_plan.save(update_fields=["is_active", "updated_at"])
            
            # Create Free plan subscription
            from django.utils import timezone
            start = timezone.now().date()
            end = start + timedelta(days=365)
            expire_at = timezone.now() + timedelta(days=365)
            
            UserPlan.objects.update_or_create(
                user=request.user,
                plan=free_plan,
                defaults={"start_date": start, "end_date": end, "is_active": True, "expire_at": expire_at},
            )
            
            response_data = {
                "detail": "Downgraded to Free plan successfully",
                "refund_processed": refund_txn is not None,
            }
            if refund_txn:
                response_data["refund_amount"] = float(refund_amount)
                response_data["refund_transaction"] = TransactionSerializer(refund_txn).data
            # Include refund policy information (if computed) so the frontend can show policy details to the user
            try:
                response_data["refund_policy"] = refund_policy_data if "refund_policy_data" in locals() else None
            except Exception:
                response_data["refund_policy"] = None
            
            return Response(response_data)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    serializer_class = PaymentMethodSerializer

    def get_queryset(self):
        return PaymentMethod.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [TokenAuthentication]
    serializer_class = TransactionSerializer

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user).select_related("plan")

    @action(
        detail=True,
        methods=["get"],
        url_path="invoice",
        authentication_classes=[],
        permission_classes=[],
    )
    def invoice(self, request, pk=None):
        # Allow Authorization header OR token query param like exports
        resolved_user: CustomUser | None = None
        try:
            auth_header = request.headers.get("Authorization") or ""
            token_value = None
            if auth_header.startswith("Token "):
                token_value = auth_header.split(" ", 1)[1]
            token_value = token_value or request.query_params.get("token") or request.query_params.get("access_token")
            if token_value:
                tok = UserAuthToken.objects.filter(access_token=token_value).select_related("user").first()
                if tok:
                    resolved_user = tok.user
        except Exception:
            resolved_user = None
        if resolved_user is None and not request.user.is_authenticated:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        # Only allow downloading your own invoice
        base_qs = Transaction.objects.all()
        if resolved_user:
            base_qs = base_qs.filter(user=resolved_user)
        else:
            base_qs = base_qs.filter(user=request.user)
        txn = base_qs.filter(pk=pk).select_related("plan", "user").first()
        if not txn:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        # Generate a simple invoice PDF on the fly
        try:
            from reportlab.pdfgen import canvas
        except Exception:
            return Response({"detail": "reportlab not installed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        import io
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer)
        p.setTitle("Invoice")
        y = 800
        p.drawString(100, y, "Invoice")
        y -= 20
        p.drawString(100, y, f"Transaction ID: {txn.id}")
        y -= 20
        p.drawString(100, y, f"User: {txn.user.username}")
        y -= 20
        p.drawString(100, y, f"Plan: {getattr(txn.plan, 'name', '-')}")
        y -= 20
        p.drawString(100, y, f"Amount: {txn.amount} {txn.currency}")
        y -= 20
        p.drawString(100, y, f"Status: {txn.status}")
        y -= 40
        p.drawString(100, y, "Thank you for your purchase.")
        p.showPage()
        p.save()
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = f"attachment; filename=invoice_{txn.id}.pdf"
        return response

class RecentSubscriptionsView(APIView):
    def get(self, request):
        return Response([], status=200)

class RazorpayCreateOrderView(APIView):
    authentication_classes = [TokenAuthentication]

    def post(self, request):
        # Expect plan_id; fallback to explicit amount
        plan_id = request.data.get("plan_id") or request.data.get("plan")
        currency = request.data.get("currency", "INR")
        amount_paise = None
        plan_obj = None
        try:
            if plan_id:
                plan_obj = Plan.objects.filter(pk=plan_id).first()
                if plan_obj and getattr(plan_obj, "price", None) is not None:
                    amount_paise = int(float(plan_obj.price) * 100)
        except Exception:
            plan_obj = None
        if amount_paise is None:
            try:
                amount_paise = int(float(request.data.get("amount", 0)) * 100)
            except Exception:
                amount_paise = 0
        # Lazy import to avoid hard dependency during CI checks
        global razorpay  # type: ignore
        if razorpay is None:
            from importlib import import_module
            razorpay = import_module("razorpay")  # type: ignore
        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))  # type: ignore
        order = client.order.create({"amount": amount_paise, "currency": currency})
        # Pre-create a pending transaction row linked to this order
        try:
            Transaction.objects.create(
                user=request.user,
                plan=plan_obj,
                amount=(amount_paise or 0) / 100.0,
                currency=currency,
                status="pending",
                provider_order_id=order.get("id"),
            )
        except Exception:
            pass
        return Response(order)


class RazorpayPaymentSuccessView(APIView):
    """Handle payment success callback from frontend and update user plan"""
    authentication_classes = [TokenAuthentication]

    def post(self, request):
        payment_id = request.data.get("razorpay_payment_id")
        order_id = request.data.get("razorpay_order_id")
        plan_id = request.data.get("plan_id")
        
        if not order_id or not plan_id:
            return Response({"detail": "order_id and plan_id are required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            plan_obj = Plan.objects.get(pk=plan_id)
        except Plan.DoesNotExist:
            return Response({"detail": "Plan not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Find or create transaction
        txn = Transaction.objects.filter(provider_order_id=order_id, user=request.user).first()
        if not txn:
            # Create transaction if not found (fallback)
            txn = Transaction.objects.create(
                user=request.user,
                plan=plan_obj,
                amount=plan_obj.price,
                currency="INR",
                status="success",
                provider_order_id=order_id,
                provider_payment_id=payment_id,
            )
        else:
            # Update transaction
            txn.status = "success"
            txn.provider_payment_id = payment_id or txn.provider_payment_id
            txn.plan = plan_obj
            txn.save(update_fields=["status", "provider_payment_id", "plan", "updated_at"])
        
        # Update or create user plan
        from django.utils import timezone
        start = timezone.now().date()
        end = start + timedelta(days=int(plan_obj.duration or 30))
        expire_at = timezone.now() + timedelta(days=int(plan_obj.duration or 30))
        
        # Deactivate existing active plans
        UserPlan.objects.filter(user=request.user, is_active=True).update(is_active=False)
        
        # Create or update the new plan
        user_plan, created = UserPlan.objects.update_or_create(
            user=request.user,
            plan=plan_obj,
            defaults={"start_date": start, "end_date": end, "is_active": True, "expire_at": expire_at},
        )
        
        return Response({
            "status": "success",
            "message": "Payment successful and plan activated",
            "user_plan": UserPlanSerializer(user_plan).data,
            "transaction": TransactionSerializer(txn).data,
        })


class RazorpayWebhookView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def post(self, request):
        # Verify signature
        payload = request.body
        signature = request.headers.get("X-Razorpay-Signature") or request.headers.get("X-RAZORPAY-SIGNATURE")
        webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", settings.RAZORPAY_KEY_SECRET)
        if not signature:
            return Response({"detail": "Missing signature"}, status=status.HTTP_400_BAD_REQUEST)
        global razorpay  # type: ignore
        if razorpay is None:
            from importlib import import_module
            razorpay = import_module("razorpay")  # type: ignore
        try:
            razorpay.Utility.verify_webhook_signature(payload, signature, webhook_secret)  # type: ignore
        except Exception:
            return Response({"detail": "Invalid signature"}, status=status.HTTP_400_BAD_REQUEST)
        event = request.data
        event_type = event.get("event") or event.get("type")
        payload_obj = event.get("payload") or {}
        # Update transaction based on event
        try:
            if event_type in ("payment.captured", "order.paid"):
                # locate by order id
                order_entity = payload_obj.get("order", {}).get("entity") or {}
                payment_entity = payload_obj.get("payment", {}).get("entity") or {}
                provider_order_id = (order_entity.get("id") or payment_entity.get("order_id"))
                txn = Transaction.objects.filter(provider_order_id=provider_order_id).first()
                if txn:
                    txn.status = "success"
                    txn.provider_payment_id = payment_entity.get("id") or txn.provider_payment_id
                    txn.save(update_fields=["status", "provider_payment_id", "updated_at"])
                    # Activate plan for user if attached
                    if txn.plan and txn.user:
                        from django.utils import timezone
                        start = timezone.now().date()
                        end = start + timedelta(days=int(getattr(txn.plan, "duration", 30) or 30))
                        expire_at = timezone.now() + timedelta(days=int(getattr(txn.plan, "duration", 30) or 30))
                        # Deactivate existing active plans
                        UserPlan.objects.filter(user=txn.user, is_active=True).update(is_active=False)
                        # Create or update the new plan
                        UserPlan.objects.update_or_create(
                            user=txn.user,
                            plan=txn.plan,
                            defaults={"start_date": start, "end_date": end, "is_active": True, "expire_at": expire_at},
                        )
            elif event_type in ("payment.failed", "order.payment_failed"):
                order_entity = payload_obj.get("order", {}).get("entity") or {}
                payment_entity = payload_obj.get("payment", {}).get("entity") or {}
                provider_order_id = (order_entity.get("id") or payment_entity.get("order_id"))
                txn = Transaction.objects.filter(provider_order_id=provider_order_id).first()
                if txn:
                    txn.status = "failed"
                    txn.provider_payment_id = payment_entity.get("id") or txn.provider_payment_id
                    txn.save(update_fields=["status", "provider_payment_id", "updated_at"])
        except Exception:
            pass
        return Response({"status": "ok"})


class FakeChargeView(APIView):
    authentication_classes = [TokenAuthentication]

    def post(self, request):
        plan_id = request.data.get("plan_id") or request.data.get("plan")
        payment_method_id = request.data.get("payment_method_id")
        if not plan_id or not payment_method_id:
            return Response({"detail": "plan_id and payment_method_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            plan = Plan.objects.get(pk=plan_id)
        except Plan.DoesNotExist:
            return Response({"detail": "Plan not found"}, status=status.HTTP_404_NOT_FOUND)

        pm = PaymentMethod.objects.filter(id=payment_method_id, user=request.user).first()
        if not pm:
            return Response({"detail": "Payment method not found"}, status=status.HTTP_404_NOT_FOUND)

        # Create a successful transaction (fake charge)
        txn = Transaction.objects.create(
            user=request.user,
            plan=plan,
            amount=plan.price,
            currency="INR",
            status="success",
            transaction_type="payment",
        )

        from django.utils import timezone
        start = timezone.now().date()
        end = start + timedelta(days=int(plan.duration or 30))
        expire_at = timezone.now() + timedelta(days=int(plan.duration or 30))
        UserPlan.objects.filter(user=request.user, is_active=True).update(is_active=False)
        user_plan, _ = UserPlan.objects.update_or_create(
            user=request.user,
            plan=plan,
            defaults={"start_date": start, "end_date": end, "is_active": True, "expire_at": expire_at},
        )

        return Response({
            "status": "success",
            "message": "Charged successfully and plan activated",
            "user_plan": UserPlanSerializer(user_plan).data,
            "transaction": TransactionSerializer(txn).data,
        })


class ExportCSVView(APIView):
    # Accept token via header or query param; handle auth manually to support new-tab downloads
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
        # Resolve user from Authorization header (Token ...) or token query param
        resolved_user: CustomUser | None = None
        try:
            auth_header = request.headers.get("Authorization") or ""
            token_value = None
            if auth_header.startswith("Token "):
                token_value = auth_header.split(" ", 1)[1]
            token_value = token_value or request.query_params.get("token") or request.query_params.get("access_token")
            if token_value:
                tok = UserAuthToken.objects.filter(access_token=token_value).select_related("user").first()
                if tok:
                    resolved_user = tok.user
        except Exception:
            resolved_user = None
        if resolved_user is None:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        # Optional date filters (YYYY-MM-DD)
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        field_id = request.query_params.get("field_id") or request.query_params.get("field")
        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            if end_date_str:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except Exception:
            pass

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["Field", "Crop", "Hectares"])
        queryset = Field.objects.filter(user=resolved_user)
        if resolved_user is None:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        # Minimal PDF export with optional date filter
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        field_id = request.query_params.get("field_id") or request.query_params.get("field")
        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            if end_date_str:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except Exception:
            pass
        from reportlab.pdfgen import canvas

        buffer = io.BytesIO()
        p = canvas.Canvas(buffer)
        p.drawString(100, 800, "OELP Report")
        y = 760
        queryset = Field.objects.filter(user=resolved_user)
        if field_id:
            queryset = queryset.filter(pk=field_id)
        if start_date:
            queryset = queryset.filter(updated_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(updated_at__date__lte=end_date)
        for fld in queryset[:30]:
            p.drawString(100, y, f"Field: {fld.name}")
            y -= 20
        p.showPage()
        p.save()
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = "attachment; filename=report.pdf"
        return response


class ExportPDFView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    def get(self, request):
        # Resolve user from Authorization header (Token ...) or token query param
        resolved_user: CustomUser | None = None
        try:
            auth_header = request.headers.get("Authorization") or ""
            token_value = None
            if auth_header.startswith("Token "):
                token_value = auth_header.split(" ", 1)[1]
            token_value = token_value or request.query_params.get("token") or request.query_params.get("access_token")
            if token_value:
                tok = UserAuthToken.objects.filter(access_token=token_value).select_related("user").first()
                if tok:
                    resolved_user = tok.user
        except Exception:
            resolved_user = None
        if resolved_user is None:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        
        # Minimal PDF export (same as earlier behavior). If reportlab is missing, return 501.
        try:
            from reportlab.pdfgen import canvas
        except Exception:
            return Response({"detail": "PDF export not available (reportlab missing)"}, status=status.HTTP_501_NOT_IMPLEMENTED)

        # Optional date filters and field filter
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        field_id = request.query_params.get("field_id") or request.query_params.get("field")
        start_date = None
        end_date = None
        try:
            if start_date_str:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            if end_date_str:
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except Exception:
            pass

        buffer = io.BytesIO()
        p = canvas.Canvas(buffer)
        p.drawString(100, 800, "OELP Report")
        y = 760
        
        queryset = Field.objects.filter(user=resolved_user)
        if field_id:
            queryset = queryset.filter(pk=field_id)
        if start_date:
            queryset = queryset.filter(updated_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(updated_at__date__lte=end_date)
        
        for fld in queryset[:30]:
            p.drawString(100, y, f"Field: {fld.name}")
            y -= 20
            if y < 50:
                p.showPage()
                y = 800
        
        p.showPage()
        p.save()
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type="application/pdf")
        response["Content-Disposition"] = "attachment; filename=report.pdf"
        return response

def get_user_subscription_features(user):
    """Helper function to get user's active subscription features"""
    from django.utils import timezone
    from django.db.models import Q
    
    # Get active user plan
    active_plan = UserPlan.objects.filter(
        user=user,
        is_active=True,
        expire_at__gt=timezone.now()
    ).select_related("plan").order_by("-created_at").first()
    
    if not active_plan:
        return {"plan_name": "Free", "features": ["Basic Reports"], "plan_type": "free"}
    
    plan = active_plan.plan
    features = []
    try:
        for pf in plan.plan_features.select_related("feature").all():
            features.append(pf.feature.name)
    except Exception:
        pass
    
    return {
        "plan_name": plan.name,
        "features": features,
        "plan_type": plan.type,
        "user_plan": active_plan
    }


def get_user_farm_data(user):
    """Helper function to get user's farm data for AI context"""
    try:
        # Get user info
        user_info = {
            "name": user.full_name or user.username or "User",
            "email": user.email,
        }
        
        # Get subscription info
        sub_info = get_user_subscription_features(user)
        
        # Get farms
        farms = Farm.objects.filter(user=user).values("id", "name")
        
        # Get fields with related data
        fields = Field.objects.filter(user=user).select_related(
            "farm", "crop", "crop_variety", "soil_type"
        ).prefetch_related("field_irrigation_methods__irrigation_method")
        
        fields_data = []
        total_acres = 0
        crops_list = []
        
        for field in fields:
            # Get irrigation method
            irrigation_method = None
            try:
                fim = field.field_irrigation_methods.first()
                if fim:
                    irrigation_method = fim.irrigation_method.name
            except Exception:
                pass
            
            # Get size
            size_acres = None
            try:
                hectares = (field.area or {}).get("hectares")
                if isinstance(hectares, (int, float)):
                    size_acres = round(float(hectares) * 2.47105, 4)
                    total_acres += size_acres
            except Exception:
                pass
            
            # Get lifecycle dates
            lifecycle = CropLifecycleDates.objects.filter(field=field).order_by("-id").first()
            
            field_data = {
                "name": field.name,
                "farm": field.farm.name if field.farm else None,
                "crop": field.crop.name if field.crop else None,
                "crop_variety": field.crop_variety.name if field.crop_variety else None,
                "soil_type": field.soil_type.name if field.soil_type else None,
                "irrigation_method": irrigation_method,
                "size_acres": size_acres,
                "location": field.location_name,
                "is_active": field.is_active,
                "sowing_date": str(lifecycle.sowing_date) if lifecycle and lifecycle.sowing_date else None,
                "harvesting_date": str(lifecycle.harvesting_date) if lifecycle and lifecycle.harvesting_date else None,
            }
            fields_data.append(field_data)
            
            # Collect unique crops
            if field.crop and field.crop.name:
                if field.crop.name not in crops_list:
                    crops_list.append(field.crop.name)
        
        # Get all crops (even if not assigned to fields)
        all_crops = Crop.objects.all().values_list("name", flat=True).distinct()
        
        return {
            "user": user_info,
            "subscription": {
                "plan_name": sub_info.get("plan_name", "Free"),
                "features": sub_info.get("features", []),
            },
            "farms": list(farms),
            "fields": fields_data,
            "total_acres": round(total_acres, 2),
            "crops_growing": crops_list,
            "all_available_crops": list(all_crops),
            "total_fields": len(fields_data),
            "active_fields": len([f for f in fields_data if f.get("is_active")]),
        }
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching user farm data: {str(e)}")
        return {
            "user": {"name": "User"},
            "subscription": {"plan_name": "Free", "features": []},
            "farms": [],
            "fields": [],
            "total_acres": 0,
            "crops_growing": [],
            "all_available_crops": [],
            "total_fields": 0,
            "active_fields": 0,
        }


class AgribotView(APIView):
    authentication_classes = [TokenAuthentication]
    
    def post(self, request):
        """Handle Agribot chat requests with OpenAI"""
        user = request.user
        message = request.data.get("message", "").strip()
        
        if not message:
            return Response({"detail": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check user's subscription
        sub_info = get_user_subscription_features(user)
        plan_name = sub_info.get("plan_name", "Free")
        plan_type = sub_info.get("plan_type", "free")
        features = sub_info.get("features", [])
        
        # Check if user has AI Assistant feature
        has_ai_assistant = "AI Assistant" in features
        
        if not has_ai_assistant:
            return Response({
                "detail": "AI Assistant is only available with TopUp or Enterprise plans. Please upgrade your subscription.",
                "error": "feature_not_available"
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Check if it's top-up plan (limited calls) or enterprise (unlimited)
        is_enterprise = plan_name.lower() == "enterpriseplan" or plan_type == "enterprise"
        is_topup = plan_name.lower() == "topupplan" or plan_type == "topup"
        
        # Track usage for top-up plan (6-8 calls per day)
        usage = None
        if is_topup:
            from datetime import date
            today = date.today()
            user_plan = sub_info.get("user_plan")
            
            if user_plan:
                # Get or create feature usage tracking
                try:
                    ai_feature = Feature.objects.get(name="AI Assistant")
                    usage, created = PlanFeatureUsage.objects.get_or_create(
                        user_plan=user_plan,
                        feature=ai_feature,
                        defaults={"max_count": 8, "used_count": 0, "duration_days": 1}
                    )
                    
                    # Reset daily count if it's a new day (simplified - check if created today)
                    if created or usage.updated_at.date() < today:
                        usage.used_count = 0
                        usage.save()
                    
                    # Check if limit exceeded
                    if usage.used_count >= usage.max_count:
                        return Response({
                            "detail": f"You have reached your daily limit of {usage.max_count} AI prompts. Please try again tomorrow or upgrade to Enterprise for unlimited access.",
                            "error": "limit_exceeded",
                            "remaining": 0
                        }, status=status.HTTP_429_TOO_MANY_REQUESTS)
                    
                    # Increment usage (will save after successful API call)
                except Feature.DoesNotExist:
                    # Feature doesn't exist, allow but don't track
                    pass
                except Exception as e:
                    # If tracking fails, still allow but log
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Error tracking AI usage: {str(e)}")
                    pass
        
        # Validate message is related to farming/agriculture
        farming_keywords = [
            "farm", "crop", "field", "soil", "irrigation", "harvest", "sowing", "agriculture",
            "farming", "fertilizer", "pest", "disease", "yield", "acre", "hectare", "agricultural",
            "farmer", "cultivation", "planting", "watering", "weather", "season", "agricultural",
            "livestock", "cattle", "poultry", "organic", "sustainable", "agri", "agribot",
            "cotton", "wheat", "rice", "corn", "maize", "vegetable", "fruit", "grain", "seed",
            "suitable", "type", "grow", "growing", "plant", "plants", "crops", "farming"
        ]
        
        message_lower = message.lower()
        is_farming_related = any(keyword in message_lower for keyword in farming_keywords)
        
        if not is_farming_related:
            return Response({
                "response": "I'm Agribot, your agricultural assistant. Please ask me questions related to farming, agriculture, crops, soil management, irrigation, or anything related to this agricultural platform.",
                "error": "off_topic"
            }, status=status.HTTP_200_OK)
        
        # Get user's farm data for context
        farm_data = get_user_farm_data(user)
        
        # Call AI API (Free alternatives: Groq, Hugging Face, or OpenAI)
        try:
            import os
            import json
            # Support multiple API providers (in order of preference: Groq > Hugging Face > OpenAI)
            groq_api_key = os.getenv("GROQ_API_KEY")
            huggingface_api_key = os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_API_KEY")
            openai_api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY")
            
            # Prepare prompt with user's farm data context
            user_context = f"""=== FARMER INFORMATION ===
Name: {farm_data['user']['name']}
Subscription Plan: {farm_data['subscription']['plan_name']}
Plan Features: {', '.join(farm_data['subscription']['features']) if farm_data['subscription']['features'] else 'Basic Reports'}

=== FARM STATISTICS ===
Total Fields: {farm_data['total_fields']}
Active Fields: {farm_data['active_fields']}
Total Land Area: {farm_data['total_acres']} acres
Number of Farms: {len(farm_data['farms'])}

=== CROPS CURRENTLY GROWING ===
{f', '.join(farm_data['crops_growing']) if farm_data['crops_growing'] else 'No crops currently assigned to fields'}

=== AVAILABLE CROPS IN SYSTEM ===
{', '.join(farm_data['all_available_crops'][:30]) if farm_data['all_available_crops'] else 'None'}

=== FIELD DETAILS ===
"""
            if farm_data['fields']:
                for idx, field in enumerate(farm_data['fields'][:15], 1):  # Limit to 15 fields for context
                    field_info = f"""
Field #{idx}: "{field['name']}"
  • Farm: {field['farm'] or 'Not assigned'}
  • Crop: {field['crop'] or 'Not assigned'}
  • Variety: {field['crop_variety'] or 'Not specified'}
  • Size: {field['size_acres'] or 'Unknown'} acres
  • Soil Type: {field['soil_type'] or 'Not specified'}
  • Irrigation Method: {field['irrigation_method'] or 'Not specified'}
  • Location: {field['location'] or 'Not specified'}
  • Status: {'Active' if field['is_active'] else 'Inactive'}
  • Sowing Date: {field['sowing_date'] or 'Not set'}
  • Harvest Date: {field['harvesting_date'] or 'Not set'}
"""
                    user_context += field_info
            else:
                user_context += "No fields registered yet.\n"
            
            system_prompt = f"""You are Agribot, an AI assistant specialized in agriculture and farming. You have DIRECT ACCESS to this farmer's actual farm data.

{user_context}

CRITICAL INSTRUCTIONS:
1. ALWAYS use the farmer's actual data from above when answering questions
2. If asked "what crops am I growing?" or "list my crops", respond with the EXACT crops from "CROPS CURRENTLY GROWING" section
3. If asked about fields, reference the SPECIFIC field names and details from "FIELD DETAILS"
4. If asked about farm size or acres, use the EXACT number from "Total Land Area: {farm_data['total_acres']} acres"
5. If asked about subscription/plan, mention their current plan: {farm_data['subscription']['plan_name']}
6. Be specific and personal - use "your" instead of "the farmer's" when referring to their data
7. If they ask about a specific crop/field, look it up in the data above and provide details

You help with:
- Answering questions about their specific crops, fields, and farm
- Crop management and best practices
- Soil analysis and recommendations
- Irrigation scheduling and methods
- Pest and disease identification
- Harvest planning
- Agricultural best practices
- General farming questions

Keep responses concise, practical, and focused on agriculture. ALWAYS reference their actual farm data when available."""
            
            full_prompt = f"{system_prompt}\n\nUser Question: {message}\n\nAgribot Response:"
            
            # Try Groq API first (Free and Fast), then Hugging Face, then OpenAI
            if groq_api_key:
                # Use Groq API (Free, Fast, No Credit Card Required)
                # Try multiple models in case one is unavailable
                groq_models = ["llama-3.1-8b-instant", "llama-3.2-3b-preview", "mixtral-8x7b-32768"]
                
                for model_name in groq_models:
                    try:
                        response = requests.post(
                            "https://api.groq.com/openai/v1/chat/completions",
                            headers={
                                "Authorization": f"Bearer {groq_api_key}",
                                "Content-Type": "application/json"
                            },
                            json={
                                "model": model_name,
                                "messages": [
                                    {"role": "system", "content": system_prompt},
                                    {"role": "user", "content": message}
                                ],
                                "max_tokens": 500,
                                "temperature": 0.7
                            },
                            timeout=30
                        )
                        
                        if response.status_code == 200:
                            data = response.json()
                            ai_response = data.get("choices", [{}])[0].get("message", {}).get("content", "I'm sorry, I couldn't generate a response.")
                            
                            # Save usage increment after successful API call
                            if usage:
                                try:
                                    usage.used_count += 1
                                    usage.save()
                                except Exception:
                                    pass
                            
                            return Response({
                                "response": ai_response,
                                "remaining": (usage.max_count - usage.used_count) if usage else None
                            })
                        elif response.status_code in [404, 410]:  # Model not found or gone, try next model
                            continue  # Try next model
                        else:
                            # For other errors, try to get error message but still try next model
                            try:
                                error_data = response.json()
                                error_msg = error_data.get("error", {}).get("message", "")
                                if "quota" in error_msg.lower() or "billing" in error_msg.lower():
                                    # Quota error - don't try more models
                                    return Response({
                                        "response": "I'm currently unavailable due to service limitations. Please contact support or try again later.",
                                        "error": "quota_exceeded"
                                    }, status=status.HTTP_200_OK)
                            except Exception:
                                pass
                            continue  # Try next model
                    except Exception:
                        continue  # Try next model
            
            # Try Hugging Face if Groq not available
            if huggingface_api_key:
                # Use Hugging Face Inference API - try multiple models
                hf_models = [
                    "google/flan-t5-large",  # Reliable text generation
                    "microsoft/DialoGPT-large",  # Conversational
                    "facebook/blenderbot-400M-distill"  # Chat model
                ]
                
                for model_name in hf_models:
                    try:
                        response = requests.post(
                            f"https://api-inference.huggingface.co/models/{model_name}",
                            headers={
                                "Authorization": f"Bearer {huggingface_api_key}",
                                "Content-Type": "application/json"
                            },
                            json={
                                "inputs": f"{system_prompt}\n\nUser: {message}\n\nAssistant:",
                                "parameters": {
                                    "max_new_tokens": 500,
                                    "temperature": 0.7,
                                    "return_full_text": False
                                }
                            },
                            timeout=45
                        )
                        
                        if response.status_code == 200:
                            data = response.json()
                            # Hugging Face returns generated text
                            if isinstance(data, list) and len(data) > 0:
                                ai_response = data[0].get("generated_text", "").strip()
                            elif isinstance(data, dict):
                                ai_response = data.get("generated_text", "").strip()
                            else:
                                ai_response = str(data).strip()
                            
                            # Clean up the response
                            if "Assistant:" in ai_response:
                                ai_response = ai_response.split("Assistant:")[-1].strip()
                            
                            if not ai_response or len(ai_response) < 10:
                                continue  # Try next model if response is too short
                            
                            # Save usage increment after successful API call
                            if usage:
                                try:
                                    usage.used_count += 1
                                    usage.save()
                                except Exception:
                                    pass
                            
                            return Response({
                                "response": ai_response,
                                "remaining": (usage.max_count - usage.used_count) if usage else None
                            })
                        elif response.status_code not in [404, 410, 503]:  # Skip if model not found/gone/loading
                            break  # Other errors, don't try more models
                    except Exception:
                        continue  # Try next model
            
            # Fallback to OpenAI if Hugging Face not configured
            if openai_api_key:
                response = requests.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {openai_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-3.5-turbo",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": message}
                        ],
                        "max_tokens": 500,
                        "temperature": 0.7
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    ai_response = data.get("choices", [{}])[0].get("message", {}).get("content", "I'm sorry, I couldn't generate a response.")
                    
                    # Save usage increment after successful API call
                    if usage:
                        try:
                            usage.used_count += 1
                            usage.save()
                        except Exception:
                            pass
                    
                    return Response({
                        "response": ai_response,
                        "remaining": (usage.max_count - usage.used_count) if usage else None
                    })
            
            # No API key configured
            if not groq_api_key and not huggingface_api_key and not openai_api_key:
                return Response({
                    "response": "AI service is not configured. Please set GROQ_API_KEY, HUGGINGFACE_API_KEY, or OPENAI_API_KEY environment variable.",
                    "error": "config_error"
                }, status=status.HTTP_200_OK)
            
            # If we get here, all AI services failed - return helpful error
            return Response({
                "response": "I'm currently unable to process your request. The AI service may be temporarily unavailable or the model endpoint has changed. Please try again in a few moments or contact support.",
                "error": "service_unavailable"
            }, status=status.HTTP_200_OK)
                
        except requests.exceptions.Timeout:
            return Response({
                "response": "The AI service is taking too long to respond. Please try again later.",
                "error": "timeout_error"
            }, status=status.HTTP_200_OK)
        except requests.exceptions.ConnectionError:
            return Response({
                "response": "Unable to connect to the AI service. Please check your internet connection and try again.",
                "error": "connection_error"
            }, status=status.HTTP_200_OK)
        except requests.exceptions.RequestException as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Agribot request error: {str(e)}")
            return Response({
                "response": f"Error connecting to AI service: {str(e)}. Please try again later.",
                "error": "connection_error"
            }, status=status.HTTP_200_OK)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Agribot unexpected error: {str(e)}", exc_info=True)
            return Response({
                "response": f"I encountered an unexpected error. Please try again later or contact support. Error: {str(e)}",
                "error": "unexpected_error"
            }, status=status.HTTP_200_OK)
    
    def get(self, request):
        """Get user's AI usage status"""
        user = request.user
        sub_info = get_user_subscription_features(user)
        plan_name = sub_info.get("plan_name", "Free")
        plan_type = sub_info.get("plan_type", "free")
        features = sub_info.get("features", [])
        
        has_ai_assistant = "AI Assistant" in features
        is_enterprise = plan_name.lower() == "enterpriseplan" or plan_type == "enterprise"
        is_topup = plan_name.lower() == "topupplan" or plan_type == "topup"
        
        usage_info = {
            "has_ai_assistant": has_ai_assistant,
            "plan_name": plan_name,
            "is_unlimited": is_enterprise,
            "remaining": None
        }
        
        if is_topup and has_ai_assistant:
            user_plan = sub_info.get("user_plan")
            if user_plan:
                try:
                    from datetime import date
                    today = date.today()
                    ai_feature = Feature.objects.get(name="AI Assistant")
                    usage = PlanFeatureUsage.objects.filter(
                        user_plan=user_plan,
                        feature=ai_feature
                    ).first()
                    
                    if usage:
                        # Reset if new day
                        if usage.updated_at.date() < today:
                            usage.used_count = 0
                            usage.save()
                        
                        usage_info["remaining"] = max(0, usage.max_count - usage.used_count)
                        usage_info["daily_limit"] = usage.max_count
                except Exception:
                    pass
        
        return Response(usage_info)


class AnalyticsSummaryView(APIView):
    authentication_classes = [TokenAuthentication]

    def get(self, request):
        user = request.user
        try:
            role_names = set(user.user_roles.select_related("role").values_list("role__name", flat=True))
        except Exception:
            role_names = set()
        privileged = user.is_superuser or bool({"SuperAdmin", "Admin", "Agronomist", "Analyst", "Business", "Developer"} & role_names)

        # Crop distribution by assigned crop on fields
        crop_counts = (
            (Field.objects.all() if privileged else Field.objects.filter(user=user))
            .values("crop__name")
            .annotate(cnt=Count("id"))
            .order_by("-cnt")
        )
        crop_distribution = [
            {"name": (row["crop__name"] or "Unassigned"), "value": row["cnt"]}
            for row in crop_counts
        ]

        # Irrigation distribution: prefer explicit method mapping; fallback to practices
        irrigation_counts = (
            FieldIrrigationMethod.objects.filter(field__in=(Field.objects.all() if privileged else Field.objects.filter(user=user)))
            .values("irrigation_method__name")
            .annotate(cnt=Count("id"))
            .order_by("-cnt")
        )
        irrigation_distribution = [
            {"name": (row["irrigation_method__name"] or "Unspecified"), "value": row["cnt"]}
            for row in irrigation_counts
        ]
        if not irrigation_distribution:
            practice_counts = (
                FieldIrrigationPractice.objects.filter(field__in=(Field.objects.all() if privileged else Field.objects.filter(user=user)))
                .values("irrigation_method__name")
                .annotate(cnt=Count("id"))
                .order_by("-cnt")
            )
            irrigation_distribution = [
                {"name": (row["irrigation_method__name"] or "Unspecified"), "value": row["cnt"]}
                for row in practice_counts
            ]

        # Lifecycle completion breakdown and percent
        lifecycle_base = CropLifecycleDates.objects.filter(field__in=(Field.objects.all() if privileged else Field.objects.filter(user=user)))
        total_lifecycle = lifecycle_base.count()
        completed_lifecycle = lifecycle_base.filter(harvesting_date__isnull=False).count()
        remaining_lifecycle = max(total_lifecycle - completed_lifecycle, 0)
        lifecycle_completion_percent = int(round((completed_lifecycle / total_lifecycle) * 100)) if total_lifecycle else 0
        lifecycle_completion = [
            {"name": "Completed", "value": completed_lifecycle},
            {"name": "Remaining", "value": remaining_lifecycle},
        ]

        # Region distribution based on Field.location_name (fallback to Unknown)
        region_counts = (
            (Field.objects.all() if privileged else Field.objects.filter(user=user))
            .values("location_name")
            .annotate(cnt=Count("id"))
            .order_by("-cnt")
        )
        region_distribution = [
            {"name": (row["location_name"] or "Unknown"), "value": row["cnt"]}
            for row in region_counts
        ]

        has_data = bool(crop_distribution or irrigation_distribution or region_distribution or total_lifecycle)

        return Response(
            {
                "has_data": has_data,
                "lifecycle_completion": lifecycle_completion,
                "lifecycle_completion_percent": lifecycle_completion_percent,
                "crop_distribution": crop_distribution,
                "irrigation_distribution": irrigation_distribution,
                "region_distribution": region_distribution,
            }
        )

# Support Ticket ViewSets

class SupportTicketViewSet(viewsets.ModelViewSet):
    """

    Support Tickets for End Users and Support team
    - End users can create tickets
    - Support team can view, assign, forward, and resolve tickets
    - Other roles can view tickets forwarded to them
    """
    authentication_classes = [TokenAuthentication]
    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        user = self.request.user
        user_roles = list(user.user_roles.select_related("role").values_list("role__name", flat=True))
        
        # Support team sees all tickets
        if "Support" in user_roles or "Admin" in user_roles or "SuperAdmin" in user_roles:
            return SupportTicket.objects.all().select_related(
                "created_by", "assigned_to_support", "forwarded_to_user", "resolved_by"
            ).prefetch_related("comments", "history").order_by("-created_at")
        
        # Other roles see tickets forwarded to their role or tickets they created
        queryset = SupportTicket.objects.filter(
            Q(created_by=user) | 
            Q(forwarded_to_role__in=user_roles) |
            Q(forwarded_to_user=user)
        ).select_related(
            "created_by", "assigned_to_support", "forwarded_to_user", "resolved_by"
        ).prefetch_related("comments", "history").order_by("-created_at")
        
        return queryset

    def get_serializer_class(self):
        """Use simplified serializer for creating tickets"""
        if self.action == "create":
            return SupportTicketCreateSerializer
        return SupportTicketSerializer

    def perform_create(self, serializer):
        """End user creates a ticket - NO NOTIFICATIONS, tickets appear in support dashboard"""
        ticket = serializer.save()
        
        # Create history entry
        TicketHistory.objects.create(
            ticket=ticket,
            user=self.request.user,
            action="created",
            description=f"Ticket created by {self.request.user.full_name}"
        )
        
        # NO NOTIFICATIONS - Support team will see tickets in their dedicated dashboard

    @action(detail=True, methods=["post"], url_path="assign-support")
    def assign_support(self, request, pk=None):
        """Support/Admin assigns ticket to a support member"""
        ticket = self.get_object()
        support_user_id = request.data.get("support_user_id")
        
        if not support_user_id:
            return Response(
                {"error": "support_user_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            support_user = CustomUser.objects.get(
                id=support_user_id,
                user_roles__role__name="Support",
                is_active=True
            )
        except CustomUser.DoesNotExist:
            return Response(
                {"error": "Support user not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        old_assigned = ticket.assigned_to_support.full_name if ticket.assigned_to_support else "None"
        ticket.assigned_to_support = support_user
        ticket.status = "assigned"
        ticket.save(update_fields=["assigned_to_support", "status", "updated_at"])
        
        # Create history
        TicketHistory.objects.create(
            ticket=ticket,
            user=request.user,
            action="assigned",
            description=f"Ticket assigned to {support_user.full_name}",
            old_value=old_assigned,
            new_value=support_user.full_name
        )
        
        # Notify assigned support user
        Notification.objects.create(
            sender=request.user,
            receiver=support_user,
            message=f"Ticket #{ticket.ticket_number} has been assigned to you"
        )
        
        return Response({"detail": "Ticket assigned successfully"})

    @action(detail=True, methods=["post"], url_path="forward")
    def forward_ticket(self, request, pk=None):
        """Support forwards ticket to specialized role"""
        ticket = self.get_object()
        target_role = request.data.get("role")  # admin, agronomist, analyst, developer, business
        user_id = request.data.get("user_id", None)  # Optional specific user
        
        valid_roles = ["Admin", "Agronomist", "Analyst", "Developer", "Business"]
        
        if not target_role or target_role not in valid_roles:
            return Response(
                {"error": f"Valid role required. Options: {', '.join(valid_roles)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_role = ticket.forwarded_to_role or "None"
        ticket.forwarded_to_role = target_role
        ticket.status = "in_progress"
        
        # If specific user provided, assign to them
        if user_id:
            try:
                target_user = CustomUser.objects.get(
                    id=user_id,
                    user_roles__role__name=target_role,
                    is_active=True
                )
                ticket.forwarded_to_user = target_user
            except CustomUser.DoesNotExist:
                return Response(
                    {"error": f"User with {target_role} role not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        ticket.save(update_fields=["forwarded_to_role", "forwarded_to_user", "status", "updated_at"])
        
        # Create history
        TicketHistory.objects.create(
            ticket=ticket,
            user=request.user,
            action="forwarded",
            description=f"Ticket forwarded to {target_role}",
            old_value=old_role,
            new_value=target_role
        )
        
        # NO NOTIFICATIONS - Tickets will appear in the role's Issues page
        
        return Response({"detail": f"Ticket forwarded to {target_role}"})

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve_ticket(self, request, pk=None):
        """Mark ticket as resolved by assigned role - sends back to support for review"""
        ticket = self.get_object()
        resolution_notes = request.data.get("resolution_notes", "")
        
        from django.utils import timezone
        
        ticket.status = "resolved"
        ticket.resolved_by = request.user
        ticket.resolved_at = timezone.now()
        ticket.resolution_notes = resolution_notes
        # Clear forwarded fields so it goes back to support
        ticket.forwarded_to_role = None
        ticket.forwarded_to_user = None
        ticket.save(update_fields=["status", "resolved_by", "resolved_at", "resolution_notes", "forwarded_to_role", "forwarded_to_user", "updated_at"])
        
        # Create history
        TicketHistory.objects.create(
            ticket=ticket,
            user=request.user,
            action="resolved",
            description=f"Ticket resolved by {request.user.full_name}. Sent back to support for review.",
            new_value=resolution_notes[:200]  # Store first 200 chars
        )
        
        # NO NOTIFICATIONS - Support will see resolved tickets in their dashboard
        
        return Response({"detail": "Ticket marked as resolved and sent to support for review"})

    @action(detail=True, methods=["post"], url_path="close")
    def close_ticket(self, request, pk=None):
        """Support closes ticket after resolution"""
        ticket = self.get_object()
        
        if ticket.status != "resolved":
            return Response(
                {"error": "Ticket must be resolved before closing"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from django.utils import timezone
        
        ticket.status = "closed"
        ticket.closed_at = timezone.now()
        ticket.save(update_fields=["status", "closed_at", "updated_at"])
        
        # Create history
        TicketHistory.objects.create(
            ticket=ticket,
            user=request.user,
            action="closed",
            description=f"Ticket closed by {request.user.full_name}"
        )
        
        # Notify ticket creator
        Notification.objects.create(
            sender=request.user,
            receiver=ticket.created_by,
            message=f"Your ticket #{ticket.ticket_number} has been closed"
        )
        
        return Response({"detail": "Ticket closed successfully"})

    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen_ticket(self, request, pk=None):
        """Reopen a closed ticket"""
        ticket = self.get_object()
        
        ticket.status = "open"
        ticket.resolved_at = None
        ticket.closed_at = None
        ticket.save(update_fields=["status", "resolved_at", "closed_at", "updated_at"])
        
        # Create history
        TicketHistory.objects.create(
            ticket=ticket,
            user=request.user,
            action="reopened",
            description=f"Ticket reopened by {request.user.full_name}"
        )
        
        return Response({"detail": "Ticket reopened successfully"})

    @action(detail=False, methods=["get"], url_path="my-tickets")
    def my_tickets(self, request):
        """Get tickets created by current user"""
        tickets = SupportTicket.objects.filter(
            created_by=request.user
        ).select_related(
            "created_by", "assigned_to_support", "forwarded_to_user", "resolved_by"
        ).order_by("-created_at")
        
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="assigned-to-me")
    def assigned_to_me(self, request):
        """Get tickets assigned to current user"""
        tickets = SupportTicket.objects.filter(
            Q(assigned_to_support=request.user) |
            Q(forwarded_to_user=request.user)
        ).select_related(
            "created_by", "assigned_to_support", "forwarded_to_user", "resolved_by"
        ).order_by("-created_at")
        
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="by-status")
    def by_status(self, request):
        """Filter tickets by status"""
        ticket_status = request.query_params.get("status", "open")
        user = request.user
        user_roles = list(user.user_roles.select_related("role").values_list("role__name", flat=True))
        
        # Base queryset based on role
        if "Support" in user_roles or "Admin" in user_roles or "SuperAdmin" in user_roles:
            queryset = SupportTicket.objects.all()
        else:
            queryset = SupportTicket.objects.filter(
                Q(created_by=user) | 
                Q(forwarded_to_role__in=user_roles) |
                Q(forwarded_to_user=user)
            )
        
        # Filter by status
        tickets = queryset.filter(status=ticket_status).select_related(
            "created_by", "assigned_to_support", "forwarded_to_user", "resolved_by"
        ).order_by("-created_at")
        
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=["get"], url_path="forwarded-to-me")
    def forwarded_to_me(self, request):
        """Get tickets forwarded to current user's role (for Issues pages)"""
        user = request.user
        user_roles = list(user.user_roles.select_related("role").values_list("role__name", flat=True))
        
        # Get tickets forwarded to user's role or specifically to user
        tickets = SupportTicket.objects.filter(
            Q(forwarded_to_role__in=user_roles) | Q(forwarded_to_user=user),
            status__in=["in_progress", "assigned"]  # Only active forwarded tickets
        ).select_related(
            "created_by", "assigned_to_support", "forwarded_to_user", "resolved_by"
        ).prefetch_related("comments", "history").order_by("-created_at")
        
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=["post"], url_path="notify-user")
    def notify_user(self, request, pk=None):
        """Support notifies user after ticket resolution"""
        ticket = self.get_object()
        user_roles = list(request.user.user_roles.select_related("role").values_list("role__name", flat=True))
        
        # Only support/admin can notify users
        if "Support" not in user_roles and "Admin" not in user_roles and "SuperAdmin" not in user_roles:
            return Response(
                {"error": "Only support team can notify users"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if ticket.status != "resolved":
            return Response(
                {"error": "Ticket must be resolved before notifying user"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        message = request.data.get(
            "message",
            f"Your ticket #{ticket.ticket_number} has been resolved. {ticket.resolution_notes or ''}",
        )

        Notification.objects.create(
            sender=request.user,
            receiver=ticket.created_by,
            message=message,
            notification_type="support",
            cause="support",
            tags={"ticket": ticket.ticket_number},
        )
        
        # Create history
        TicketHistory.objects.create(
            ticket=ticket,
            user=request.user,
            action="user_notified",
            description=f"User notified about ticket resolution by {request.user.full_name}",
            new_value=message[:200]
        )
        
        return Response({"detail": "User notified successfully"})
    
    @action(detail=False, methods=["get"], url_path="users-by-role")
    def users_by_role(self, request):
        role_name = request.query_params.get("role")
        user_roles = list(request.user.user_roles.select_related("role")
                          .values_list("role__name", flat=True))
    
        if "Support" not in user_roles and "Admin" not in user_roles and "SuperAdmin" not in user_roles:
            return Response({"error": "Access denied"}, status=403)
    
        if not role_name:
            return Response({"error": "role parameter is required"}, status=400)
    
        users = CustomUser.objects.filter(
            user_roles__role__name__iexact=role_name,
            is_active=True
        ).distinct().values("id", "full_name", "email", "username")
    
        return Response(list(users))


class TicketCommentViewSet(viewsets.ModelViewSet):
    """Comments on support tickets"""
    authentication_classes = [TokenAuthentication]
    serializer_class = TicketCommentSerializer

    def get_queryset(self):
        user = self.request.user
        user_roles = list(user.user_roles.select_related("role").values_list("role__name", flat=True))
        
        # Staff can see all comments including internal
        if "Support" in user_roles or "Admin" in user_roles or "SuperAdmin" in user_roles:
            return TicketComment.objects.all().select_related("ticket", "user").order_by("created_at")
        
        # Other users only see non-internal comments on their accessible tickets
        accessible_tickets = SupportTicket.objects.filter(
            Q(created_by=user) | 
            Q(forwarded_to_role__in=user_roles) |
            Q(forwarded_to_user=user)
        ).values_list("id", flat=True)
        
        return TicketComment.objects.filter(
            ticket_id__in=accessible_tickets,
            is_internal=False
        ).select_related("ticket", "user").order_by("created_at")

    def perform_create(self, serializer):
        """Add comment to ticket"""
        comment = serializer.save(user=self.request.user)
        
        # Create history entry
        TicketHistory.objects.create(
            ticket=comment.ticket,
            user=self.request.user,
            action="commented",
            description=f"{self.request.user.full_name} added a comment"
        )
        
        # Notify relevant parties (exclude commenter)
        recipients = set()
        ticket = comment.ticket
        
        # Add ticket creator
        if ticket.created_by != self.request.user:
            recipients.add(ticket.created_by)
        
        # Add assigned support
        if ticket.assigned_to_support and ticket.assigned_to_support != self.request.user:
            recipients.add(ticket.assigned_to_support)
        
        # Add forwarded user
        if ticket.forwarded_to_user and ticket.forwarded_to_user != self.request.user:
            recipients.add(ticket.forwarded_to_user)
        
        # Create notifications
        for recipient in recipients:
            Notification.objects.create(
                sender=self.request.user,
                receiver=recipient,
                message=f"New comment on ticket #{ticket.ticket_number}"
            )


class TicketHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    """View ticket history/audit log"""
    authentication_classes = [TokenAuthentication]
    serializer_class = TicketHistorySerializer

    def get_queryset(self):
        user = self.request.user
        user_roles = list(user.user_roles.select_related("role").values_list("role__name", flat=True))
        
        # Staff can see all history
        if "Support" in user_roles or "Admin" in user_roles or "SuperAdmin" in user_roles:
            return TicketHistory.objects.all().select_related("ticket", "user").order_by("-created_at")
        
        # Other users only see history of their accessible tickets
        accessible_tickets = SupportTicket.objects.filter(
            Q(created_by=user) | 
            Q(forwarded_to_role__in=user_roles) |
            Q(forwarded_to_user=user)
        ).values_list("id", flat=True)
        
        return TicketHistory.objects.filter(
            ticket_id__in=accessible_tickets
        ).select_related("ticket", "user").order_by("-created_at")

from .serializers import UserSerializer  # noqa: E402

@require_http_methods(["GET", "HEAD"])
def health_check(request):
    return JsonResponse({"status": "ok"})

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """Get or update current user profile"""
    user = request.user
    
    if request.method == 'GET':
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email if hasattr(user, 'email') else '',
            'full_name': user.full_name if hasattr(user, 'full_name') else '',
            'phone_number': user.phone_number if hasattr(user, 'phone_number') else '',
            'avatar': user.avatar if hasattr(user, 'avatar') else '',
        })
    
    elif request.method == 'PUT':
        # Update user profile
        data = request.data
        if 'full_name' in data:
            user.full_name = data['full_name']
        if 'phone_number' in data:
            user.phone_number = data['phone_number']
        if 'avatar' in data:
            user.avatar = data['avatar']
        if 'email' in data:
            user.email = data['email']
        
        user.save()
        
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'phone_number': user.phone_number,
            'avatar': user.avatar,
        })