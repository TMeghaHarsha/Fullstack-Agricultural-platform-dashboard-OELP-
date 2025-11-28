from __future__ import annotations

from django.db import models

from .user import CustomUser


class TicketCategory(models.TextChoices):
    """Categories for support tickets"""
    CROP = "crop", "Crop Management"
    TRANSACTION = "transaction", "Payment/Transaction"
    ANALYSIS = "analysis", "Data Analysis"
    SOFTWARE_ISSUE = "software_issue", "Software Issue"
    TECHNICAL = "technical", "Technical Support"
    GENERAL = "general", "General Inquiry"


class TicketStatus(models.TextChoices):
    """Status of support tickets"""
    OPEN = "open", "Open"
    ASSIGNED = "assigned", "Assigned"
    IN_PROGRESS = "in_progress", "In Progress"
    RESOLVED = "resolved", "Resolved"
    CLOSED = "closed", "Closed"


class TicketPriority(models.TextChoices):
    """Priority levels for tickets"""
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"


class SupportTicket(models.Model):
    """Main support ticket model"""
    # Basic Information
    ticket_number = models.CharField(max_length=50, unique=True, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(
        max_length=32, 
        choices=TicketCategory.choices,
        default=TicketCategory.GENERAL
    )
    
    # User Information
    created_by = models.ForeignKey(
        CustomUser, 
        on_delete=models.CASCADE, 
        related_name="created_tickets"
    )
    
    # Support Assignment
    assigned_to_support = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="support_assigned_tickets",
        help_text="Support team member assigned to this ticket"
    )
    
    # Forwarding to specialized roles
    forwarded_to_role = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Role to which ticket is forwarded (admin, agronomist, analyst, developer, business)"
    )
    forwarded_to_user = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="forwarded_tickets",
        help_text="Specific user from the role who is handling the ticket"
    )
    
    # Status and Priority
    status = models.CharField(
        max_length=20,
        choices=TicketStatus.choices,
        default=TicketStatus.OPEN
    )
    priority = models.CharField(
        max_length=10,
        choices=TicketPriority.choices,
        default=TicketPriority.MEDIUM
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    
    # Resolution
    resolution_notes = models.TextField(blank=True, null=True)
    resolved_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_tickets"
    )
    
    class Meta:
        app_label = "models_app"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["created_by", "status"]),
            models.Index(fields=["forwarded_to_role", "status"]),
        ]
    
    def __str__(self) -> str:
        return f"Ticket #{self.ticket_number} - {self.title}"
    
    def save(self, *args, **kwargs):
        """Auto-generate ticket number if not exists"""
        if not self.ticket_number:
            # Generate ticket number: TKT-YYYYMMDD-XXXXX
            from django.utils import timezone
            import random
            date_str = timezone.now().strftime("%Y%m%d")
            random_num = random.randint(10000, 99999)
            self.ticket_number = f"TKT-{date_str}-{random_num}"
            
            # Ensure uniqueness
            while SupportTicket.objects.filter(ticket_number=self.ticket_number).exists():
                random_num = random.randint(10000, 99999)
                self.ticket_number = f"TKT-{date_str}-{random_num}"
        
        super().save(*args, **kwargs)
        # DO NOT CREATE NOTIFICATIONS HERE


class TicketComment(models.Model):
    """Comments/updates on support tickets"""
    ticket = models.ForeignKey(
        SupportTicket,
        on_delete=models.CASCADE,
        related_name="comments"
    )
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name="ticket_comments"
    )
    comment = models.TextField()
    is_internal = models.BooleanField(
        default=False,
        help_text="Internal comments visible only to staff"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        app_label = "models_app"
        ordering = ["created_at"]
    
    def __str__(self) -> str:
        return f"Comment on {self.ticket.ticket_number} by {self.user}"


class TicketHistory(models.Model):
    """Track all actions/changes on tickets"""
    ticket = models.ForeignKey(
        SupportTicket,
        on_delete=models.CASCADE,
        related_name="history"
    )
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        related_name="ticket_actions"
    )
    action = models.CharField(max_length=50)  # created, assigned, forwarded, resolved, etc.
    description = models.TextField()
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        app_label = "models_app"
        ordering = ["-created_at"]
        verbose_name_plural = "Ticket histories"
    
    def __str__(self) -> str:
        return f"{self.action} on {self.ticket.ticket_number} by {self.user}"
