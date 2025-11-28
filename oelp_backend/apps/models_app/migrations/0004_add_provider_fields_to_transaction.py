from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("models_app", "0003_useractivity"),
    ]

    operations = [
        migrations.AddField(
            model_name="transaction",
            name="provider_order_id",
            field=models.CharField(blank=True, help_text="Razorpay order ID", max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="transaction",
            name="provider_payment_id",
            field=models.CharField(blank=True, help_text="Razorpay payment ID", max_length=255, null=True),
        ),
    ]


