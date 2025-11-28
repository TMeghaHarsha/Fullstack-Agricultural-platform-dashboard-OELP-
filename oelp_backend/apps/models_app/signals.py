from __future__ import annotations

from django.apps import apps
from django.db.models.signals import post_migrate, post_save, pre_save
from django.dispatch import receiver
from django.db import connection
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError

# TEMPORARILY COMMENT OUT the signal to fix the startup error
# We'll add it back after fixing the model conflict

# from .notifications import Notification
# from .support_ticket import SupportTicket

# @receiver(pre_save, sender=Notification)
# def block_support_ticket_notifications(sender, instance, **kwargs):
#     """Prevent any support ticket notifications from being saved"""
#     message = str(getattr(instance, 'message', ''))
#     notification_type = getattr(instance, 'notification_type', '')
#     related_type = getattr(instance, 'related_object_type', '')
#     
#     if ('Support request' in message or 
#         'support request' in message.lower() or
#         notification_type == 'support_ticket' or
#         related_type == 'support_ticket'):
#         raise ValidationError("Support ticket notifications are blocked.")


@receiver(post_migrate)
def seed_core_data(sender, **kwargs):
    if sender and sender.name != "apps.models_app":
        return
    existing_tables = set(connection.introspection.table_names())

    # Seed roles
    if "models_app_role" in existing_tables:
        Role = apps.get_model("models_app", "Role")
        roles = [
            ("SuperAdmin", "Manages the entire platform, including user roles and system settings."),
            ("Admin", "Oversees platform operations and user management with limited system-level access."),
            ("Agronomist", "Provides expert advice on crop management and agricultural practices."),
            ("Support", "Handles user queries and technical support."),
            ("Analyst", "Analyzes data to generate insights and reports."),
            ("Business", "Manages subscriptions, billing, and business-related operations."),
            ("Developer", "Maintains and develops platform features and integrations."),
            ("End-App-User", "Standard user interacting with platform features like crops and fields."),
        ]
        for name, desc in roles:
            Role.objects.get_or_create(name=name, defaults={"description": desc})

    # Seed initial superuser at startup (idempotent)
    if "models_app_customuser" in existing_tables:
        CustomUser = apps.get_model("models_app", "CustomUser")
        Role = apps.get_model("models_app", "Role")
        UserRole = apps.get_model("models_app", "UserRole")
        try:
            desired_username = "vivek"
            desired_email = "mekarthivivek@gmail.com"
            desired_phone = "8885617016"
            desired_google_id = "mekarthivivek@gmail.com"
            desired_full_name = "Vivek Chaithanya"

            su = (
                CustomUser.objects.filter(username=desired_username).first()
                or CustomUser.objects.filter(email=desired_email).first()
                or CustomUser.objects.filter(phone_number=desired_phone).first()
                or CustomUser.objects.filter(google_id=desired_google_id).first()
            )
            if not su:
                su = CustomUser.objects.create_superuser(
                    username=desired_username,
                    password="qwert@123",
                    email=desired_email,
                    phone_number=desired_phone,
                    google_id=desired_google_id,
                    full_name=desired_full_name,
                    is_active=True,
                    is_staff=True,
                    is_superuser=True,
                )
            else:
                # Ensure flags and profile attributes; avoid overwriting existing password
                updated_fields: list[str] = []
                if not su.is_active:
                    su.is_active = True
                    updated_fields.append("is_active")
                if not su.is_staff:
                    su.is_staff = True
                    updated_fields.append("is_staff")
                if not su.is_superuser:
                    su.is_superuser = True
                    updated_fields.append("is_superuser")
                if su.full_name != desired_full_name:
                    su.full_name = desired_full_name
                    updated_fields.append("full_name")
                if not su.phone_number:
                    su.phone_number = desired_phone
                    updated_fields.append("phone_number")
                if not su.google_id:
                    su.google_id = desired_google_id
                    updated_fields.append("google_id")
                if not su.email:
                    su.email = desired_email
                    updated_fields.append("email")
                if updated_fields:
                    su.save(update_fields=updated_fields)

            # Ensure SuperAdmin role is attached
            try:
                super_role, _ = Role.objects.get_or_create(name="SuperAdmin")
                UserRole.objects.get_or_create(
                    user=su, role=super_role, defaults={"userrole_id": su.email or su.username}
                )
            except Exception:
                pass
        except Exception:
            # Do not block migrations if something goes wrong while seeding
            pass

    # Seed irrigation methods
    if "models_app_irrigationmethods" in existing_tables:
        IrrigationMethods = apps.get_model("models_app", "IrrigationMethods")
        for nm in ["Drip", "Sprinkler", "Flood", "Furrow", "Pivot"]:
            IrrigationMethods.objects.get_or_create(name=nm)

    # Seed soil textures
    if "models_app_soiltexture" in existing_tables:
        SoilTexture = apps.get_model("models_app", "SoilTexture")
        textures = [
            ("Sandy", "https://example.com/icons/sandy.png"),
            ("Loam", "https://example.com/icons/loam.png"),
            ("Clay", "https://example.com/icons/clay.png"),
            ("Silt", "https://example.com/icons/silt.png"),
        ]
        for name, icon in textures:
            SoilTexture.objects.get_or_create(name=name, defaults={"icon": icon})

    # Seed features/types per requirements (AI, Premium, Basic)
    if "models_app_featuretype" in existing_tables and "models_app_feature" in existing_tables:
        FeatureType = apps.get_model("models_app", "FeatureType")
        Feature = apps.get_model("models_app", "Feature")
        type_map = {}
        for t in [
            ("AI", "AI-powered features"),
            ("Premium", "Advanced premium capabilities"),
            ("Basic", "Essential/basic features"),
        ]:
            ft, _ = FeatureType.objects.get_or_create(name=t[0], defaults={"description": t[1]})
            type_map[t[0]] = ft
        for name, tname in [
            ("AI Assistant", "AI"),
            ("Advanced Analytics", "Premium"),
            ("Priority Support", "Premium"),
            ("Basic Reports", "Basic"),
            ("Unlimited Fields", "Premium"),
        ]:
            Feature.objects.get_or_create(name=name, defaults={"feature_type": type_map[tname]})

    # Seed plans per requirements and attach features
    if "models_app_plan" in existing_tables and "models_app_planfeature" in existing_tables:
        Plan = apps.get_model("models_app", "Plan")
        PlanFeature = apps.get_model("models_app", "PlanFeature")
        Feature = apps.get_model("models_app", "Feature")
        plans = [
            ("Free", "main", 0, 36500, ["Basic Reports"]),
            ("MainPlan", "main", 19, 30, ["Basic Reports", "Advanced Analytics"]),
            ("TopUpPlan", "topup", 9, 30, ["AI Assistant"]),
            ("EnterprisePlan", "enterprise", 129, 30, ["AI Assistant", "Advanced Analytics", "Priority Support", "Unlimited Fields"]),
        ]
        for name, ptype, price, duration, feats in plans:
            plan, created = Plan.objects.get_or_create(
                name=name,
                defaults={"type": ptype, "price": price, "duration": duration},
            )
            if not created:
                # Ensure attributes are aligned with requirements on existing rows
                updated = False
                if plan.type != ptype:
                    plan.type = ptype
                    updated = True
                if plan.price != price or plan.duration != duration:
                    plan.price = price
                    plan.duration = duration
                    updated = True
                if updated:
                    plan.save(update_fields=["type", "price", "duration"])
            for fname in feats:
                try:
                    f = Feature.objects.get(name=fname)
                    PlanFeature.objects.get_or_create(plan=plan, feature=f, defaults={"max_count": 1000, "duration_days": duration})
                except Feature.DoesNotExist:
                    continue

    # Seed common crops and predefined varieties
    if "models_app_crop" in existing_tables and "models_app_cropvariety" in existing_tables:
        Crop = apps.get_model("models_app", "Crop")
        CropVariety = apps.get_model("models_app", "CropVariety")
        seed = {
            "Wheat": ["Durum", "Hard Red", "Soft White"],
            "Corn": ["Dent", "Flint", "Sweet"],
            "Rice": ["Basmati", "Jasmine", "Arborio"],
            "Tomato": ["Roma", "Beefsteak", "Cherry"],
            "Soybean": ["Glycine Max A", "Glycine Max B", "Glycine Max C"],
        }
        for crop_name, varieties in seed.items():
            crop, _ = Crop.objects.get_or_create(name=crop_name)
            for i, vname in enumerate(varieties):
                obj, _ = CropVariety.objects.get_or_create(crop=crop, name=vname, defaults={"is_primary": i == 0})
                if i == 0 and not obj.is_primary:
                    obj.is_primary = True
                    obj.save(update_fields=["is_primary"])


# Basic activity logging for Field and SoilReport changes
@receiver(post_save)
def log_user_activity(sender, instance, created, **kwargs):
    try:
        models_module = sender.__module__
    except Exception:
        return
    if not models_module.startswith("apps.models_app"):
        return
    # Only track selected models for now
    track_models = {"Field", "SoilReport", "Crop", "CropVariety"}
    model_name = sender.__name__
    if model_name not in track_models:
        return
    user = getattr(instance, "user", None) or getattr(getattr(instance, "farm", None), "user", None)
    if not user:
        return
    try:
        Activity = apps.get_model("models_app", "UserActivity")
        ct = ContentType.objects.get_for_model(sender)
        action = "create" if created else "update"
        Activity.objects.create(user=user, action=action, content_type=ct, object_id=instance.pk, description=f"{model_name} {action}")
    except Exception:
        pass


@receiver(post_save)
def replicate_field_image_to_asset(sender, instance, created, **kwargs):
    try:
        from .field import Field  # local import to avoid circulars at import time
    except Exception:
        return
    if sender is not Field:
        return
    if not getattr(instance, "image", None):
        return
    try:
        Asset = apps.get_model("models_app", "Asset")
        ct = ContentType.objects.get_for_model(sender)
        # Avoid duplicates for same object and file name
        if not Asset.objects.filter(content_type=ct, object_id=instance.pk, file=str(instance.image)).exists():
            Asset.objects.create(content_type=ct, object_id=instance.pk, file=instance.image)
    except Exception:
        pass


# At the END of the file:
from django.core.exceptions import ValidationError
from .notifications import Notification  # Changed from .notification to .notifications
from .support_ticket import SupportTicket


@receiver(pre_save, sender=Notification)
def block_support_ticket_notifications(sender, instance, **kwargs):
    """Prevent support ticket notifications at signal level"""
    message = str(getattr(instance, 'message', ''))
    notification_type = getattr(instance, 'notification_type', '')
    related_type = getattr(instance, 'related_object_type', '')
    
    if ('Support request' in message or 
        'support request' in message.lower() or
        notification_type == 'support_ticket' or
        related_type == 'support_ticket'):
        raise ValidationError("Support ticket notifications are blocked. Use Support Tickets page.")