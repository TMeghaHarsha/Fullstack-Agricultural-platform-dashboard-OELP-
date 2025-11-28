from rest_framework import serializers
from apps.models_app.support_ticket import (
    SupportTicket, TicketComment, TicketHistory
)
from apps.models_app.user import CustomUser


class UserBasicSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'full_name', 'role']
    
    def get_full_name(self, obj):
        return obj.get_full_name() or obj.email


class TicketCommentSerializer(serializers.ModelSerializer):
    user = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = TicketComment
        fields = '__all__'
        read_only_fields = ['user', 'created_at', 'updated_at']


class TicketHistorySerializer(serializers.ModelSerializer):
    user = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = TicketHistory
        fields = '__all__'
        read_only_fields = ['created_at']


class SupportTicketSerializer(serializers.ModelSerializer):
    created_by = UserBasicSerializer(read_only=True)
    assigned_to_support = UserBasicSerializer(read_only=True)
    forwarded_to_user = UserBasicSerializer(read_only=True)
    resolved_by = UserBasicSerializer(read_only=True)
    comments = TicketCommentSerializer(many=True, read_only=True)
    history = TicketHistorySerializer(many=True, read_only=True)
    comments_count = serializers.SerializerMethodField()
    
    class Meta:
        model = SupportTicket
        fields = '__all__'
        read_only_fields = [
            'ticket_number', 'created_by', 'created_at', 'updated_at',
            'resolved_at', 'closed_at', 'resolved_by'
        ]
    
    def get_comments_count(self, obj):
        return obj.comments.count()
    
    def create(self, validated_data):
        # Ensure created_by is set from context if not provided
        if 'created_by' not in validated_data:
            validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
