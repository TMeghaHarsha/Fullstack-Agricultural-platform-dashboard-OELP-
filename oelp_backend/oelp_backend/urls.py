from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from apps.api.views import health_check

def healthz(_request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    # Redirect the root path to API docs for convenience during local dev
    path("", RedirectView.as_view(url="/api/docs/", permanent=False)),
    path("healthz/", healthz),
    path("health/", health_check, name='health-check'),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    path("api/", include("apps.api.urls")),
]

