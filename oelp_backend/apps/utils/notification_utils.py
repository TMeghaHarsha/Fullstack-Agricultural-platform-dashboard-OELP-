from typing import List, Dict, Optional, Tuple
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.db import transaction

User = get_user_model()

def get_notification_templates() -> Dict[str, Dict]:
    """
    Returns a dictionary of notification templates with default messages
    """
    return {
        'welcome': {
            'message': 'Welcome to our platform! We are excited to have you on board.',
            'default_type': 'info',
            'allowed_senders': ['Admin', 'SuperAdmin']
        },
        'alert': {
            'message': 'Alert: {message}',
            'default_type': 'alert',
            'allowed_senders': ['Admin', 'SuperAdmin', 'Support']
        },
        'update': {
            'message': 'Update: {message}',
            'default_type': 'info',
            'allowed_senders': ['Admin', 'SuperAdmin']
        },
        'support_request': {
            'message': 'Support Request: {message}',
            'default_type': 'support',
            'allowed_senders': ['*']  # All roles can send support requests
        },
        'crop_advice': {
            'message': 'Crop Advice: {message}',
            'default_type': 'info',
            'allowed_senders': ['Agronomist', 'Admin', 'SuperAdmin']
        }
    }

def get_allowed_receivers(sender_role: str) -> Dict[str, List[str]]:
    """
    Returns a mapping of allowed receiver roles for a given sender role.
    
    Args:
        sender_role: The role of the sender
        
    Returns:
        Dict with 'roles' key containing list of allowed receiver roles
    """
    # Define the notification flow based on requirements
    notification_flow = {
        'SuperAdmin': ['Admin'],
        'Admin': ['SuperAdmin', 'Business', 'Agronomist', 'Developer', 'Analyst', 'Support', 'EndUser'],
        'Business': ['Admin', 'EndUser'],
        'Support': ['Admin'],
        'Agronomist': ['Admin', 'EndUser'],
        'Analyst': ['Admin', 'EndUser'],
        'Developer': ['Admin', 'EndUser']
    }
    
    return {
        'roles': notification_flow.get(sender_role, [])
    }

def get_users_by_roles(roles: List[str], **filters) -> List[User]:
    """
    Get users by their roles with optional filtering
    
    Args:
        roles: List of role names to filter by
        **filters: Additional filters to apply (e.g., region='North', crop_type='Wheat')
        
    Returns:
        List of User objects matching the criteria
    """
    from django.db.models import Q
    
    # Start with base query for active users with the specified roles
    query = Q(is_active=True) & Q(user_roles__role__name__in=roles)
    
    # Apply additional filters from metadata
    for key, value in filters.items():
        if key == 'region':
            query &= Q(profile__region=value)
        elif key == 'crop_type':
            query &= Q(profile__crop_types__icontains=value)
    
    return User.objects.filter(query).distinct()

def send_notification(
    sender: User,
    message: str,
    receiver_roles: List[str],
    notification_type: str = 'info',
    cause: str = 'user_action',
    template: Optional[str] = None,
    tags: Optional[List[str]] = None,
    region: Optional[str] = None,
    crop_type: Optional[str] = None,
    **metadata
) -> Tuple[int, List[Dict]]:
    """
    Helper function to send notifications to multiple users based on roles
    
    Args:
        sender: The user sending the notification
        message: The notification message
        receiver_roles: List of role names to receive the notification
        notification_type: Type of notification (info, alert, warning, success, error)
        cause: The cause/trigger of the notification
        template: Optional template name for the notification
        tags: List of tags for filtering
        region: Optional region for segmentation
        crop_type: Optional crop type for segmentation
        **metadata: Additional metadata to store with the notification
        
    Returns:
        Tuple of (number of notifications created, list of notification details)
    """
    from ..models_app.notifications import Notification, NotificationCause
    
    # Get all users with the specified roles and filters
    users = get_users_by_roles(receiver_roles, region=region, crop_type=crop_type)
    
    # Prepare tags string and ensure required tags are included
    tags = tags or []
    if region:
        tags.append(f'region:{region}')
    if crop_type:
        tags.append(f'crop_type:{crop_type}')
    tags_str = ','.join(tags) if tags else None
    
    # Create notifications in bulk
    notifications = []
    notification_details = []
    
    with transaction.atomic():
        for user in users:
            # Create sent notification
            sent_notification = Notification(
                sender=sender,
                receiver=user,
                message=message,
                notification_type=notification_type,
                cause=cause,
                template=template,
                tags=tags_str,
                region=region,
                crop_type=crop_type,
                direction='sent',
                metadata=metadata or {}
            )
            
            # Create received notification
            received_notification = Notification(
                sender=sender,
                receiver=user,
                message=message,
                notification_type=notification_type,
                cause=cause,
                template=template,
                tags=tags_str,
                region=region,
                crop_type=crop_type,
                direction='received',
                metadata=metadata or {}
            )
            
            notifications.extend([sent_notification, received_notification])
            notification_details.append({
                'receiver': user.id,
                'receiver_username': user.username,
                'message': message,
                'type': notification_type,
                'cause': cause
            })
        
        # Bulk create all notifications
        created = Notification.objects.bulk_create(notifications)
    
    return len(created) // 2, notification_details
    
    # Use bulk_create for better performance with many notifications
    created = Notification.objects.bulk_create(notifications)
    return len(created)
