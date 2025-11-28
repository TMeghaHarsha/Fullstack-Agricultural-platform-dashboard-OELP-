from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from apps.models_app.user import CustomUser
from apps.models_app.plan import Plan
from apps.models_app.user_plan import Transaction, UserPlan

class RefundFlowTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        # create a user
        self.user = CustomUser.objects.create_user(username='testuser', password='testpass')
        # create a plan
        self.plan = Plan.objects.create(name='Basic', price=100.0, duration=30, type='main')
        # create a payment transaction
        self.payment_txn = Transaction.objects.create(user=self.user, plan=self.plan, amount=100.0, currency='INR', status='success', transaction_type='payment')
        # create active user plan
        self.user_plan = UserPlan.objects.create(user=self.user, plan=self.plan, start_date='2025-01-01', end_date='2026-01-01', expire_at='2026-01-01', is_active=True)

    def test_refund_flow_and_summary(self):
        # authenticate
        self.client.force_authenticate(user=self.user)
        # call downgrade with refund
        url = reverse('user-plan-downgrade', kwargs={'pk': self.user_plan.pk})
        resp = self.client.post(url, {'request_refund': True, 'refund_reason': 'testing'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data.get('refund_processed'))
        # refresh transactions
        payment = Transaction.objects.filter(pk=self.payment_txn.pk).first()
        self.assertIsNotNone(payment)
        # Do not require changing original payment.status; analytics computes net revenue as payments - refunds
        refund_txn = Transaction.objects.filter(user=self.user, transaction_type='refund').first()
        self.assertIsNotNone(refund_txn)
        # Response should include refund policy info (or null) so the user sees the policy
        self.assertIn('refund_processed', resp.data)
        self.assertIn('refund_amount', resp.data)
        self.assertIn('refund_transaction', resp.data)
        # refund_policy may be None or an object
        self.assertIn('refund_policy', resp.data)

        # Check refunds summary (admin) - create admin user
        admin = CustomUser.objects.create_user(username='admin', password='adminpass')
        admin.is_staff = True
        admin.save()
        self.client.force_authenticate(user=admin)
        summary_url = reverse('refunds-summary')
        sresp = self.client.get(summary_url)
        self.assertEqual(sresp.status_code, 200)
        data = sresp.data
        self.assertIn('payments_sum', data)
        self.assertIn('refunds_sum', data)
        # refunds_sum should be >= refund amount
        self.assertGreaterEqual(float(data.get('refunds_sum') or 0), float(refund_txn.amount))
