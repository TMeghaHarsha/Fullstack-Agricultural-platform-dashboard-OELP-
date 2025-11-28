import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Load .env for local dev (repo root and project dir); not needed on Render
PROJECT_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = PROJECT_DIR.parent
load_dotenv(dotenv_path=PROJECT_DIR / ".env")
load_dotenv(dotenv_path=REPO_ROOT / ".env")

BASE_DIR = Path(__file__).resolve().parent.parent

# ------------------- SECURITY -------------------
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")

# Raise error if SECRET_KEY is not set at all
if not SECRET_KEY:
    raise ValueError("DJANGO_SECRET_KEY environment variable is required! Add it to your .env file or Vercel environment variables.")

DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() == "true"

ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",")
if '.onrender.com' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('.onrender.com')
# Add Vercel domains
if '.vercel.app' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('.vercel.app')
if 'oelp-backend.vercel.app' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('oelp-backend.vercel.app')

# ------------------- CORS -------------------

FRONTEND_URL = "https://fullstack-agricultural-platform-das.vercel.app"
BACKEND_URL = "https://oelp-backend-t8w3.onrender.com"

CORS_ALLOW_ALL_ORIGINS = False

CORS_ALLOWED_ORIGINS = [
    FRONTEND_URL,
    BACKEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    FRONTEND_URL,
    BACKEND_URL,
    "https://oelp-backend-t8w3.onrender.com",
]


# ------------------- APPS -------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "apps.models_app.apps.ModelsAppConfig",
    "apps.api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "oelp_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "oelp_backend.wsgi.application"

# ------------------- DATABASE -------------------
# Render provides DATABASE_URL automatically in Postgres service
import dj_database_url

# Allow opting into PostGIS explicitly; default to plain Postgres locally
USE_POSTGIS = os.getenv("USE_POSTGIS", "false").lower() == "true"
FORCED_ENGINE = (
    "django.contrib.gis.db.backends.postgis" if USE_POSTGIS else "django.db.backends.postgresql"
)

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Force the engine unless PostGIS is explicitly requested, so local dev
    # won't require the PostGIS extension.
    DATABASES = {
        "default": dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            ssl_require=True,  # Always require SSL for production
            engine=FORCED_ENGINE,
        )
    }
else:
    # Fallback config for environments without DATABASE_URL.
    # Ignore DB_ENGINE override unless PostGIS is explicitly enabled.
    engine_env = os.getenv("DB_ENGINE") if USE_POSTGIS else None
    DATABASES = {
        "default": {
            "ENGINE": engine_env or FORCED_ENGINE,
            "NAME": os.getenv("DB_NAME", "OELP_Final"),
            "USER": os.getenv("DB_USER", "postgres"),
            "PASSWORD": os.getenv("DB_PASSWORD", "postgres"),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
        }
    }

# ------------------- STATIC & MEDIA -------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# ------------------- STORAGE CONFIG -------------------
USE_S3 = all([
    os.getenv("AWS_ACCESS_KEY_ID"),
    os.getenv("AWS_SECRET_ACCESS_KEY"),
    os.getenv("AWS_STORAGE_BUCKET_NAME"),
])

if USE_S3:
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3boto3.S3Boto3Storage"},
        "staticfiles": {"BACKEND": "storages.backends.s3boto3.S3Boto3Storage"},
    }
else:
    DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"
    STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# ------------------- REST FRAMEWORK -------------------
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.api.auth.TokenAuthentication"],
    "DEFAULT_PAGINATION_CLASS": "apps.api.pagination.DefaultPageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# Disable browsable API in production (only use JSON)
if not DEBUG:
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [
        "rest_framework.renderers.JSONRenderer",
    ]

SPECTACULAR_SETTINGS = {"TITLE": "OELP API", "VERSION": "1.0.0"}

# ------------------- THIRD PARTY KEYS -------------------
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

# ------------------- CELERY -------------------
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)

# ------------------- PASSWORDS -------------------
PASSWORD_HASHERS = [
    # Removed Argon2PasswordHasher - not available on Vercel
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTH_USER_MODEL = "models_app.CustomUser"

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ------------------- LOGGING -------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
    },
}
