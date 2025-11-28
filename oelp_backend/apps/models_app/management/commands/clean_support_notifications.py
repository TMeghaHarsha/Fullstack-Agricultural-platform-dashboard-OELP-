from django.core.management.base import BaseCommand
from apps.models_app.notification import Notification


class Command(BaseCommand):
    help = 'Delete all support ticket notifications'

    def handle(self, *args, **kwargs):
        # Delete all support ticket related notifications
        deleted_count = Notification.objects.filter(
            message__icontains='Support request'
        ).delete()[0]
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully deleted {deleted_count} support ticket notifications'
            )
        )
