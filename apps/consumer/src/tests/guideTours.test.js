import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTourChangeRequestRow,
  buildTourFormPayloadFromTour,
  buildTourRow,
  fetchGuideTours,
  submitTourChangeRequest
} from '../lib/guideTours.js';

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
    content_html: '',
    price_amount: 25,
    currency: 'USD',
    payment_type: 'pay_as_you_go',
    duration_minutes: 90,
    max_people: 4,
    options: {},
    status: 'pending'
  });
});

test('buildTourChangeRequestRow stores editable tour fields in the change request payload', () => {
  const row = buildTourChangeRequestRow({
    tourId: 'tour-1',
    payload: {
      city: 'Busan',
      title: 'Coastal walk',
      type: 'Nature',
      description: 'Updated route.',
      contentHtml: '<p>Updated route.</p>',
      paymentType: 'package',
      packagePrice: '80000',
      currency: 'KRW',
      durationMinutes: '120',
      maxPeople: '6',
      option_pickup: 'yes',
      option_pickup_price: '10000'
    }
  });

  assert.deepEqual(row, {
    tour_id: 'tour-1',
    payload: {
      city: 'Busan',
      title: 'Coastal walk',
      type: 'Nature',
      description: 'Updated route.',
      content_html: '<p>Updated route.</p>',
      price_amount: 80000,
      currency: 'KRW',
      payment_type: 'package',
      duration_minutes: 120,
      max_people: 6,
      options: {
        pickup: true,
        pickup_price: 10000
      }
    }
  });
});

test('buildTourFormPayloadFromTour converts a stored tour into edit form defaults', () => {
  assert.deepEqual(buildTourFormPayloadFromTour({
    id: 'tour-1',
    title: 'Market walk',
    city: 'Seoul',
    type: 'Food',
    description: 'A local market walk.',
    content_html: '<p>Full content</p>',
    payment_type: 'pay_as_you_go',
    price_amount: 25,
    currency: 'USD',
    duration_minutes: 90,
    max_people: 4,
    options: {
      pickup: true,
      pickup_price: 5,
      petFriendly: false
    }
  }), {
    id: 'edit-tour-1',
    sourceTourId: 'tour-1',
    type: 'tour-edit',
    typeValue: 'Food',
    title: 'Market walk',
    city: 'Seoul',
    description: 'A local market walk.',
    contentHtml: '<p>Full content</p>',
    paymentType: 'pay_as_you_go',
    hourlyPrice: '25',
    packagePrice: '',
    currency: 'USD',
    durationMinutes: '90',
    maxPeople: '4',
    option_pickup: 'yes',
    option_pickup_price: '5'
  });
});

test('fetchGuideTours loads a guide tour list with pending change requests', async () => {
  const calls = [];
  const fakeClient = {
    from: (table) => ({
      select: (columns) => {
        calls.push(['select', table, columns]);
        return {
          eq: (column, value) => {
            calls.push(['eq', column, value]);
            return {
              order: async (columnName, options) => {
                calls.push(['order', columnName, options]);
                return { data: [{ id: 'tour-1', title: 'Market walk' }], error: null };
              }
            };
          }
        };
      }
    })
  };

  const result = await fetchGuideTours(fakeClient, { guideProfileId: 'guide-1' });

  assert.deepEqual(result, [{ id: 'tour-1', title: 'Market walk' }]);
  assert.deepEqual(calls, [
    ['select', 'tours', '*,tour_images(image_path,sort_order),reservations(id),tour_change_requests(id,status,payload,created_at,reviewed_at,rejection_reason)'],
    ['eq', 'guide_id', 'guide-1'],
    ['order', 'updated_at', { ascending: false }]
  ]);
});

test('submitTourChangeRequest calls the RPC with a normalized edit payload', async () => {
  const calls = [];
  const fakeClient = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: { id: 'request-1', status: 'pending' }, error: null };
    }
  };

  const result = await submitTourChangeRequest(fakeClient, {
    tourId: 'tour-1',
    payload: {
      title: 'Updated tour',
      city: 'Seoul',
      type: 'Food',
      description: 'Updated.',
      paymentType: 'pay_as_you_go',
      hourlyPrice: '30',
      currency: 'USD',
      durationMinutes: '75',
      maxPeople: '3'
    }
  });

  assert.deepEqual(result, { id: 'request-1', status: 'pending' });
  assert.equal(calls[0][0], 'submit_tour_change_request');
  assert.equal(calls[0][1].p_tour_id, 'tour-1');
  assert.equal(calls[0][1].p_payload.price_amount, 30);
});
