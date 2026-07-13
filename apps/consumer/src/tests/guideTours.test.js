import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTourChangeRequestRow,
  buildTourFormPayloadFromTour,
  buildTourRow,
  filterGuideToursByStatus,
  fetchGuideTours,
  getGuideTourStatusLabel,
  mapGuideTourListItem,
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
        if (table === 'tours') {
          return {
            eq: (column, value) => {
              calls.push(['eq', column, value]);
              return {
                order: async (columnName, options) => {
                  calls.push(['order', table, columnName, options]);
                  return { data: [{ id: 'tour-1', title: 'Market walk' }], error: null };
                }
              };
            }
          };
        }
        return {
          in: (column, values) => {
            calls.push(['in', column, values]);
            return {
              order: async (columnName, options) => {
                calls.push(['order', table, columnName, options]);
                return {
                  data: [{ id: 'request-1', tour_id: 'tour-1', status: 'pending', payload: { title: 'Updated walk' } }],
                  error: null
                };
              }
            };
          }
        };
      }
    })
  };

  const result = await fetchGuideTours(fakeClient, { guideProfileId: 'guide-1' });

  assert.deepEqual(result, [{
    id: 'tour-1',
    title: 'Market walk',
    tour_change_requests: [{ id: 'request-1', tour_id: 'tour-1', status: 'pending', payload: { title: 'Updated walk' } }]
  }]);
  assert.deepEqual(calls, [
    ['select', 'tours', '*,tour_images(image_path,sort_order),reservations(id),bookmarks(id)'],
    ['eq', 'guide_id', 'guide-1'],
    ['order', 'tours', 'created_at', { ascending: false }],
    ['select', 'tour_change_requests', 'id,tour_id,status,payload,created_at,reviewed_at,rejection_reason'],
    ['in', 'tour_id', ['tour-1']],
    ['order', 'tour_change_requests', 'created_at', { ascending: false }]
  ]);
});

test('fetchGuideTours keeps showing tours when change request lookup fails', async () => {
  const fakeClient = {
    from: (table) => ({
      select: () => {
        if (table === 'tours') {
          return {
            eq: () => ({
              order: async () => ({
                data: [{ id: 'tour-1', title: 'Market walk' }],
                error: null
              })
            })
          };
        }
        return {
          in: () => ({
            order: async () => ({
              data: null,
              error: new Error('Could not find a relationship between tours and tour_change_requests in the schema cache')
            })
          })
        };
      }
    })
  };

  const result = await fetchGuideTours(fakeClient, { guideProfileId: 'guide-1' });

  assert.deepEqual(result, [{ id: 'tour-1', title: 'Market walk', tour_change_requests: [] }]);
});

test('getGuideTourStatusLabel maps active tours to approved for guide UI', () => {
  assert.equal(getGuideTourStatusLabel('active'), 'Approved');
  assert.equal(getGuideTourStatusLabel('pending'), 'Pending');
  assert.equal(getGuideTourStatusLabel('rejected'), 'Rejected');
  assert.equal(getGuideTourStatusLabel('unknown'), 'Draft');
});

test('filterGuideToursByStatus groups active tours under approved', () => {
  const tours = [
    { id: 'tour-1', status: 'active' },
    { id: 'tour-2', status: 'pending' },
    { id: 'tour-3', status: 'rejected' }
  ];

  assert.deepEqual(filterGuideToursByStatus(tours, 'all').map((tour) => tour.id), ['tour-1', 'tour-2', 'tour-3']);
  assert.deepEqual(filterGuideToursByStatus(tours, 'approved').map((tour) => tour.id), ['tour-1']);
  assert.deepEqual(filterGuideToursByStatus(tours, 'pending').map((tour) => tour.id), ['tour-2']);
});

test('mapGuideTourListItem prepares thumbnail, counts, dates, and fallback values', () => {
  const mapped = mapGuideTourListItem({
    id: 'tour-1',
    title: 'Market walk',
    city: 'Seoul',
    type: 'Food',
    status: 'active',
    price_amount: 50000,
    currency: 'KRW',
    payment_type: 'package',
    created_at: '2026-07-10T09:00:00Z',
    updated_at: '2026-07-11T10:00:00Z',
    tour_images: [
      { image_path: 'second.png', sort_order: 2 },
      { image_path: 'first.png', sort_order: 1 }
    ],
    reservations: [{ id: 'reservation-1' }],
    bookmarks: [{ id: 'bookmark-1' }, { id: 'bookmark-2' }]
  });

  assert.equal(mapped.thumbnail, 'https://qrabzkcibqaslealvdar.supabase.co/storage/v1/object/public/tour-images/first.png');
  assert.equal(mapped.statusLabel, 'Approved');
  assert.equal(mapped.statusFilter, 'approved');
  assert.equal(mapped.priceLabel, 'KRW 50000');
  assert.equal(mapped.bookingCount, 1);
  assert.equal(mapped.wishlistCount, 2);
  assert.equal(mapped.createdDateLabel, 'Jul 10, 2026');
  assert.equal(mapped.updatedDateLabel, 'Jul 11, 2026');
});

test('mapGuideTourListItem handles missing images and counts safely', () => {
  const mapped = mapGuideTourListItem({ id: 'tour-1' });

  assert.equal(mapped.thumbnail, '');
  assert.equal(mapped.title, 'Untitled tour');
  assert.equal(mapped.locationLabel, '-');
  assert.equal(mapped.bookingCount, 0);
  assert.equal(mapped.wishlistCount, 0);
  assert.equal(mapped.createdDateLabel, '-');
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
