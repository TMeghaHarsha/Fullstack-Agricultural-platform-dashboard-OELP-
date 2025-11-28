from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count, Case, When, IntegerField
from django.utils import timezone

from apps.models_app.support_ticket import (
    SupportTicket, TicketComment, TicketHistory,
    TicketStatus, TicketPriority
)
from apps.models_app.user import CustomUser
from apps.api.serializers.support_ticket_serializers import (
    SupportTicketSerializer, TicketCommentSerializer, 
    TicketHistorySerializer
)


class SupportTicketViewSet(viewsets.ModelViewSet):
    serializer_class = SupportTicketSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # Support role sees all tickets
        if user.role == 'support':
            return SupportTicket.objects.all().select_related(
                'created_by', 'assigned_to_support', 'resolved_by'
            ).prefetch_related('comments', 'history')
        
        # Superadmin sees all tickets
        if user.role == 'superadmin':
            return SupportTicket.objects.all().select_related(
                'created_by', 'assigned_to_support', 'resolved_by'
            ).prefetch_related('comments', 'history')
        
        # Other users see only their created tickets
        return SupportTicket.objects.filter(created_by=user).select_related(
            'created_by', 'assigned_to_support', 'resolved_by'
        ).prefetch_related('comments', 'history')
    
    def perform_create(self, serializer):
        """Create ticket without sending notifications"""
        ticket = serializer.save(created_by=self.request.user)
        
        # Create history entry
        TicketHistory.objects.create(
            ticket=ticket,
            user=self.request.user,
            action="created",
            description=f"Ticket created by {self.request.user.get_full_name() or self.request.user.email}",
            new_value=ticket.status
        )
        # NO NOTIFICATIONS - Support team will see tickets in their dedicated page
    
    def create(self, request, *args, **kwargs):
        """Override create to ensure proper ticket creation"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers
        )

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get ticket statistics for support dashboard"""
        if request.user.role != 'support':
            return Response(
                {'error': 'Only support users can access stats'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get counts by status
        stats = SupportTicket.objects.aggregate(
            total=Count('id'),
            open=Count(Case(When(status=TicketStatus.OPEN, then=1), output_field=IntegerField())),
            assigned=Count(Case(When(status=TicketStatus.ASSIGNED, then=1), output_field=IntegerField())),
            in_progress=Count(Case(When(status=TicketStatus.IN_PROGRESS, then=1), output_field=IntegerField())),
            resolved=Count(Case(When(status=TicketStatus.RESOLVED, then=1), output_field=IntegerField())),
            closed=Count(Case(When(status=TicketStatus.CLOSED, then=1), output_field=IntegerField())),
            unassigned=Count(Case(When(assigned_to_support__isnull=True, status=TicketStatus.OPEN, then=1), output_field=IntegerField())),
        )
        
        # Get my assigned tickets count
        my_tickets = SupportTicket.objects.filter(
            assigned_to_support=request.user,
            status__in=[TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS]
        ).count()
        
        # Get priority counts
        priority_stats = SupportTicket.objects.filter(
            status__in=[TicketStatus.OPEN, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS]
        ).aggregate(
            urgent=Count(Case(When(priority=TicketPriority.URGENT, then=1), output_field=IntegerField())),
            high=Count(Case(When(priority=TicketPriority.HIGH, then=1), output_field=IntegerField())),
        )
        
        return Response({
            **stats,
            'my_tickets': my_tickets,
            'urgent': priority_stats['urgent'],
            'high': priority_stats['high'],
            'avg_response_time': 0  # You'll need to implement this
        })
    
    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assign ticket to a support user"""
        ticket = self.get_object()
        assigned_to_id = request.data.get('assigned_to')
        
        if not assigned_to_id:
            return Response(
                {'error': 'assigned_to user ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            assigned_user = CustomUser.objects.get(id=assigned_to_id, role='support')
        except CustomUser.DoesNotExist:
            return Response(
                {'error': 'User not found or not a support team member'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        old_assigned = ticket.assigned_to_support
        ticket.assigned_to_support = assigned_user
        ticket.status = TicketStatus.ASSIGNED
        ticket.save()
        
        # Create history
        TicketHistory.objects.create(
            ticket=ticket,
            user=request.user,
            action="assigned",
            description=f"Ticket assigned to {assigned_user.get_full_name()}",
            old_value=old_assigned.get_full_name() if old_assigned else None,
            new_value=assigned_user.get_full_name()
        )
        
        # NO NOTIFICATIONS - Support team manages tickets in their page
        
        return Response(
            SupportTicketSerializer(ticket).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update ticket status"""
        ticket = self.get_object()
        new_status = request.data.get('status')
        
        if new_status not in dict(TicketStatus.choices):
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_status = ticket.status
        ticket.status = new_status
        
        if new_status == TicketStatus.RESOLVED:
            ticket.resolved_at = timezone.now()
            ticket.resolved_by = request.user
            ticket.resolution_notes = request.data.get('resolution_notes', '')
        elif new_status == TicketStatus.CLOSED:
            ticket.closed_at = timezone.now()
        
        ticket.save()
        
        # Create history
        TicketHistory.objects.create(
            ticket=ticket,
            user=request.user,
            action="status_changed",
            description=f"Status changed from {old_status} to {new_status}",
            old_value=old_status,
            new_value=new_status
        )
        
        # NO NOTIFICATIONS
        
        return Response(
            SupportTicketSerializer(ticket).data,
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Add comment to ticket"""
        ticket = self.get_object()
        comment_text = request.data.get('comment')
        is_internal = request.data.get('is_internal', False)
        
        if not comment_text:
            return Response(
                {'error': 'Comment text is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        comment = TicketComment.objects.create(
            ticket=ticket,
            user=request.user,
            comment=comment_text,
            is_internal=is_internal
        )
        
        # Create history
        TicketHistory.objects.create(
            ticket=ticket,
            user=request.user,
            action="commented",
            description=f"Comment added by {request.user.get_full_name()}",
            new_value=comment_text[:100]
        )
        
        # NO NOTIFICATIONS
        
        return Response(
            TicketCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=False, methods=['get'])
    def my_tickets(self, request):
        """Get tickets created by current user"""
        tickets = SupportTicket.objects.filter(created_by=request.user)
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def assigned_to_me(self, request):
        """Get tickets assigned to current support user"""
        if request.user.role != 'support':
            return Response(
                {'error': 'Only support users can access this endpoint'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        tickets = SupportTicket.objects.filter(assigned_to_support=request.user)
        serializer = self.get_serializer(tickets, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def support_users(self, request):
        """Get list of all support team members"""
        if request.user.role not in ['support', 'superadmin']:
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        support_users = CustomUser.objects.filter(role='support', is_active=True)
        from apps.api.serializers.support_ticket_serializers import UserBasicSerializer
        serializer = UserBasicSerializer(support_users, many=True)
        return Response(serializer.data)


class TicketCommentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TicketCommentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # Support and superadmin can see all comments including internal
        if user.role in ['support', 'superadmin']:
            return TicketComment.objects.all()
        
        # Regular users can only see non-internal comments on their tickets
        return TicketComment.objects.filter(
            ticket__created_by=user,
            is_internal=False
        )


class TicketHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TicketHistorySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # Support and superadmin can see all history
        if user.role in ['support', 'superadmin']:
            return TicketHistory.objects.all()
        
        # Regular users can only see history of their tickets
        return TicketHistory.objects.filter(ticket__created_by=user)
