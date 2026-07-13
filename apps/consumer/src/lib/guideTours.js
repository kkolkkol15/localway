import { resolvePublicStorageUrl } from './supabaseAuth.js';

export const guideTourStatusFilters = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
];

export function buildTourRow(payload, { guideProfileId, fallbackCity = '' }) {
  if (!guideProfileId) throw new Error('A guide profile id is required to publish a tour.');

  const editablePayload = buildEditableTourPayload(payload, { fallbackCity });

  return {
    guide_id: guideProfileId,
    ...editablePayload,
    status: 'pending'
  };
}

export function getGuideTourStatusFilter(status = '') {
  if (status === 'active' || status === 'approved') return 'approved';
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  return 'draft';
}

export function getGuideTourStatusLabel(status = '') {
  return ({
    active: 'Approved',
    approved: 'Approved',
    pending: 'Pending',
    rejected: 'Rejected',
    paused: 'Paused',
    draft: 'Draft'
  })[status] ?? 'Draft';
}

export function filterGuideToursByStatus(tours = [], status = 'all') {
  if (status === 'all') return tours;
  return tours.filter((tour) => getGuideTourStatusFilter(tour.status) === status);
}

function formatGuideTourDate(value = '') {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatGuideTourPrice(tour = {}) {
  const amount = Number(tour.price_amount ?? 0);
  const cleanAmount = Number.isFinite(amount) ? amount : 0;
  return `${tour.currency || 'USD'} ${cleanAmount}`;
}

export function mapGuideTourListItem(tour = {}) {
  const images = [...(tour.tour_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const thumbnailPath = images[0]?.image_path || '';
  const statusFilter = getGuideTourStatusFilter(tour.status);
  const pendingRequest = (tour.tour_change_requests ?? []).find((request) => request.status === 'pending') ?? null;

  return {
    ...tour,
    title: tour.title || 'Untitled tour',
    locationLabel: [tour.city, tour.type].filter(Boolean).join(' · ') || '-',
    thumbnail: thumbnailPath ? resolvePublicStorageUrl('tour-images', thumbnailPath) : '',
    statusFilter,
    statusLabel: getGuideTourStatusLabel(tour.status),
    priceLabel: formatGuideTourPrice(tour),
    bookingCount: tour.reservations?.length ?? 0,
    wishlistCount: tour.bookmarks?.length ?? 0,
    createdDateLabel: formatGuideTourDate(tour.created_at),
    updatedDateLabel: formatGuideTourDate(tour.updated_at),
    pendingRequest
  };
}

function readOptionPayload(payload = {}) {
  return Object.entries(payload).reduce((options, [key, value]) => {
    if (!key.startsWith('option_') || value === '' || value == null) return options;
    const optionKey = key.replace(/^option_/, '');
    if (optionKey.endsWith('_price')) {
      const numeric = Number(value || 0);
      if (Number.isFinite(numeric) && numeric > 0) options[optionKey] = numeric;
      return options;
    }
    options[optionKey] = value === true || value === 'yes' || value === 'on';
    return options;
  }, {});
}

export function buildEditableTourPayload(payload = {}, { fallbackCity = '' } = {}) {
  const paymentType = payload.paymentType || 'pay_as_you_go';
  const priceAmount = paymentType === 'package'
    ? Number(payload.packagePrice || 0)
    : Number(payload.hourlyPrice || 0);

  return {
    city: payload.city || fallbackCity,
    title: payload.title,
    type: payload.type || payload.typeValue,
    description: payload.description || payload.contentHtml || '',
    content_html: payload.contentHtml || '',
    price_amount: priceAmount,
    currency: payload.currency || 'USD',
    payment_type: paymentType,
    duration_minutes: Number(payload.durationMinutes || 60),
    max_people: Number(payload.maxPeople || 1),
    options: readOptionPayload(payload)
  };
}

export function buildTourChangeRequestRow({ tourId, payload }) {
  if (!tourId) throw new Error('A tour id is required to submit a tour change request.');
  return {
    tour_id: tourId,
    payload: buildEditableTourPayload(payload)
  };
}

export function buildTourFormPayloadFromTour(tour = {}) {
  const paymentType = tour.payment_type || 'pay_as_you_go';
  const base = {
    id: `edit-${tour.id}`,
    sourceTourId: tour.id,
    type: 'tour-edit',
    typeValue: tour.type || '',
    title: tour.title || '',
    city: tour.city || '',
    description: tour.description || '',
    contentHtml: tour.content_html || '',
    paymentType,
    hourlyPrice: paymentType === 'pay_as_you_go' ? String(tour.price_amount ?? '') : '',
    packagePrice: paymentType === 'package' ? String(tour.price_amount ?? '') : '',
    currency: tour.currency || 'USD',
    durationMinutes: String(tour.duration_minutes ?? ''),
    maxPeople: String(tour.max_people ?? '')
  };
  const options = tour.options && typeof tour.options === 'object' ? tour.options : {};
  return Object.entries(options).reduce((payload, [key, value]) => {
    if (key.endsWith('_price')) {
      payload[`option_${key}`] = String(value);
    } else if (value === true) {
      payload[`option_${key}`] = 'yes';
    }
    return payload;
  }, base);
}

export async function publishGuideTour(client, { payload, guideProfileId, fallbackCity }) {
  const row = buildTourRow(payload, { guideProfileId, fallbackCity });
  const { data, error } = await client
    .from('tours')
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchGuideTours(client, { guideProfileId }) {
  if (!guideProfileId) throw new Error('A guide profile id is required to load guide tours.');
  const { data, error } = await client
    .from('tours')
    .select('*,tour_images(image_path,sort_order),reservations(id),bookmarks(tour_id)')
    .eq('guide_id', guideProfileId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  const tours = data ?? [];
  const tourIds = tours.map((tour) => tour.id).filter(Boolean);
  if (!tourIds.length) return tours;

  const { data: changeRequests, error: requestError } = await client
    .from('tour_change_requests')
    .select('id,tour_id,status,payload,created_at,reviewed_at,rejection_reason')
    .in('tour_id', tourIds)
    .order('created_at', { ascending: false });

  if (requestError) {
    return tours.map((tour) => ({ ...tour, tour_change_requests: [] }));
  }

  const requestsByTourId = (changeRequests ?? []).reduce((groups, request) => {
    const tourId = request?.tour_id;
    if (!tourId) return groups;
    return { ...groups, [tourId]: [...(groups[tourId] ?? []), request] };
  }, {});

  return tours.map((tour) => ({
    ...tour,
    tour_change_requests: requestsByTourId[tour.id] ?? []
  }));
}

export async function submitTourChangeRequest(client, { tourId, payload }) {
  const row = buildTourChangeRequestRow({ tourId, payload });
  const { data, error } = await client.rpc('submit_tour_change_request', {
    p_tour_id: row.tour_id,
    p_payload: row.payload
  });

  if (error) throw error;
  return data;
}
