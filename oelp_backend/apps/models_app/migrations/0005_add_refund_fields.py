from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("models_app", "0004_add_provider_fields_to_transaction"),
    ]

    operations = [
        migrations.AddField(
            model_name="transaction",
            name="transaction_type",
            field=models.CharField(choices=[("payment", "Payment"), ("refund", "Refund")], default="payment", max_length=20),
        ),
        migrations.AddField(
            model_name="transaction",
            name="refund_reason",
            field=models.TextField(blank=True, help_text="Reason for refund", null=True),
        ),
        migrations.CreateModel(
            name="RefundPolicy",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("plan_type", models.CharField(choices=[("main", "Main"), ("topup", "TopUp"), ("enterprise", "Enterprise")], max_length=16)),
                ("refund_percentage", models.DecimalField(decimal_places=2, help_text="Percentage refunded", max_digits=5)),
                ("days_after_purchase", models.IntegerField(help_text="Refund available up to N days after purchase")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name_plural": "Refund Policies",
            },
        ),
    ]

