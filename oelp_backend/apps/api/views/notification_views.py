from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.models_app.notifications import Notification  # Changed from .notification
from apps.api.serializers.notification_serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Exclude all support ticket notifications"""
        return Notification.objects.filter(
            user=self.request.user
        ).exclude(
            notification_type='support_ticket'
        ).exclude(
            related_object_type='support_ticket'
        ).exclude(
            message__icontains='Support request'
        ).order_by('-created_at')
    
    def create(self, request, *args, **kwargs):
        """Block creation of support ticket notifications"""
        message = request.data.get('message', '').lower()
        if (request.data.get('notification_type') == 'support_ticket' or
            request.data.get('related_object_type') == 'support_ticket' or
            'support request' in message):
            return Response(
                {'detail': 'Support ticket notifications are disabled. Use Support Tickets page.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'marked as read'})
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'status': 'all marked as read'})
