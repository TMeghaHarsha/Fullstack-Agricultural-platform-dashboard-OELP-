import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'oelp_backend.settings')

application = get_wsgi_application()

# Vercel serverless function handler
app = application

