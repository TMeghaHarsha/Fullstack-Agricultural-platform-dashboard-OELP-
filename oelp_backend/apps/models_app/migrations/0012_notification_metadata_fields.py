from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("models_app", "0011_alter_notification_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="notification_type",
            field=models.CharField(
                choices=[
                    ("general", "General"),
                    ("alert", "Alert"),
                    ("update", "Update"),
                    ("support", "Support"),
                    ("reminder", "Reminder"),
                ],
                default="general",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="notification",
            name="cause",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name="notification",
            name="tags",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="notification",
            name="region",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="notification",
            name="crop_type",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="notification",
            name="metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]

