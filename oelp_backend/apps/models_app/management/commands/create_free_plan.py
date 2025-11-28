from django.core.management.base import BaseCommand
from apps.models_app.plan import Plan


class Command(BaseCommand):
    help = 'Creates a Free plan if it does not exist'

    def handle(self, *args, **options):
        free_plan, created = Plan.objects.get_or_create(
            name='Free',
            defaults={
                'price': 0.0,
                'duration': 365,
                'type': 'free',
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'Successfully created Free plan (ID: {free_plan.id})'))
        else:
            self.stdout.write(self.style.WARNING(f'Free plan already exists (ID: {free_plan.id})'))
