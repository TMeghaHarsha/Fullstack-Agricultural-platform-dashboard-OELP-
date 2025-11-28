from django.apps import AppConfig


class ModelsAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.models_app'
    
    def ready(self):
        import apps.models_app.signals  # Import signals to block notifications

