import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTourRow } from '../lib/guideTours.js';

test('buildTourRow maps an approved guide tour form to the existing tours schema', () => {
  const row = buildTourRow(
    {
      city: 'Seoul',
      title: 'Market walk',
      type: 'Food',
      description: 'A local market walk.',
      paymentType: 'pay_as_you_go',
      hourlyPrice: '25',
      currency: 'USD',
      durationMinutes: '90',
      maxPeople: '4'
    },
    { guideProfileId: '20000000-0000-4000-8000-000000000001' }
  );

  assert.deepEqual(row, {
    guide_id: '20000000-0000-4000-8000-000000000001',
    city: 'Seoul',
    title: 'Market walk',
    type: 'Food',
    description: 'A local market walk.',
    price_amount: 25,
    currency: 'USD',
    payment_type: 'pay_as_you_go',
    duration_minutes: 90,
    max_people: 4,
    status: 'pending'
  });
});
