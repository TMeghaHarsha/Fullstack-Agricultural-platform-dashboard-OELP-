from typing import Dict, List, Optional, Tuple

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q

from apps.models_app.field import Field

User = get_user_model()


def get_allowed_receivers(sender_role: str) -> Dict[str, List[str]]:
    flow = {
        "SuperAdmin": ["Admin"],
        "Admin": [
            "SuperAdmin",
            "Business",
            "Agronomist",
            "Developer",
            "Analyst",
            "Support",
            "End-App-User",
        ],
        "Business": ["Admin", "End-App-User"],
        "Support": ["Admin"],
        "Agronomist": ["Admin", "End-App-User"],
        "Analyst": ["Admin", "End-App-User"],
        "Developer": ["Admin", "End-App-User"],
    }
    return {"roles": flow.get(sender_role, [])}


def normalize_role(role: str | None) -> str | None:
    if not role:
        return role
    key = role.replace("-", "").replace("_", "").replace(" ", "").lower()
    aliases = {
        "enduser": "End-App-User",
        "endusers": "End-App-User",
        "endappuser": "End-App-User",
    }
    return aliases.get(key, role)


def get_users_by_roles(
    roles: List[str],
    region: Optional[str] = None,
    crop_type: Optional[str] = None,
) -> List[User]:
    qs = User.objects.filter(is_active=True, user_roles__role__name__in=roles).distinct()

    if region:
        region_user_ids = Field.objects.filter(
            Q(location_name__icontains=region) | Q(farm__name__icontains=region)
        ).values_list("user_id", flat=True)
        qs = qs.filter(id__in=region_user_ids)

    if crop_type:
        crop_user_ids = Field.objects.filter(
            Q(crop__name__icontains=crop_type)
            | Q(crop_variety__name__icontains(crop_type)
            )
        ).values_list("user_id", flat=True)
        qs = qs.filter(id__in=crop_user_ids)

    return qs.distinct()


def send_notification(
    sender: User,
    message: str,
    receiver_roles: List[str],
    notification_type: str = "general",
    cause: str = "user_action",
    tags: Optional[Dict[str, str]] = None,
    region: Optional[str] = None,
    crop_type: Optional[str] = None,
    metadata: Optional[Dict] = None,
) -> Tuple[int, List[Dict]]:
    from apps.models_app.notifications import Notification

    normalized_roles = [normalize_role(r) for r in receiver_roles]
    users = get_users_by_roles(normalized_roles, region=region, crop_type=crop_type)
    
    tags_payload = tags.copy() if isinstance(tags, dict) else {}
    if region:
        tags_payload["region"] = region
    if crop_type:
        tags_payload["crop_type"] = crop_type
    
    notifications: List[Notification] = []
    details: List[Dict] = []
    
    with transaction.atomic():
        for user in users:
            notifications.append(
                Notification(
                sender=sender,
                receiver=user,
                message=message,
                notification_type=notification_type,
                cause=cause,
                    tags=tags_payload,
                region=region,
                crop_type=crop_type,
                    metadata=metadata or {},
                )
            )
            details.append(
                {
                    "receiver": user.id,
                    "receiver_username": user.username,
                    "message": message,
                    "type": notification_type,
                    "cause": cause,
                }
            )

        Notification.objects.bulk_create(notifications)
    
    return len(notifications), details
