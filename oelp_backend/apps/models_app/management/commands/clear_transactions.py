from django.core.management.base import BaseCommand
from apps.models_app.user_plan import Transaction

class Command(BaseCommand):
    help = 'Delete all transactions from the database (useful for resetting dev data)'

    def add_arguments(self, parser):
        parser.add_argument('--confirm', action='store_true', help='Confirm deletion')

    def handle(self, *args, **options):
        if not options.get('confirm'):
            self.stdout.write(self.style.WARNING('This will delete ALL Transaction records. Re-run with --confirm to proceed.'))
            return
        count = Transaction.objects.count()
        Transaction.objects.all().delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {count} transactions'))
