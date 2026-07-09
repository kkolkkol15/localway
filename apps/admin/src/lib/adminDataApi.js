function requireText(value, message) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(message);
  return text;
}

function asAdminStatus(status) {
  const normalized = String(status || '').trim();
  if (normalized === '일시정지') return 'paused';
  if (normalized === '활성') return 'active';
  return normalized;
}

export function buildNoticeRow({ adminId, payload = {} }) {
  return {
    title: requireText(payload.title, 'Notice title and content are required.'),
    content: requireText(payload.content, 'Notice title and content are required.'),
    is_public: Boolean(payload.isPublic),
    created_by: adminId || null
  };
}

export function buildSupportReplyPatch(reply) {
  return {
    admin_reply: requireText(reply, 'A support reply is required.'),
    status: 'closed'
  };
}

export function buildPlatformSettingRow({ group, name, active = true, sortOrder = 0 }) {
  return {
    group_key: requireText(group, 'A setting group is required.'),
    name: requireText(name, 'A setting name is required.'),
    active: Boolean(active),
    sort_order: Number(sortOrder || 0)
  };
}

export function mapProfileToAdminMember(profile = {}) {
  return {
    id: profile.id,
    name: profile.display_name || profile.email || 'Member',
    email: profile.email || '',
    role: profile.role || 'traveler',
    joinedAt: profile.created_at || '',
    status: profile.status || 'active',
    bookings: profile.reservations?.length ?? 0
  };
}

export function mapGuideProfileToAdminGuide(profile = {}) {
  return {
    id: profile.id,
    userId: profile.user_id,
    name: profile.display_name || 'Guide',
    city: profile.city || '',
    rating: Number(profile.rating_avg ?? 0),
    tours: profile.tours?.length ?? 0,
    status: profile.status || 'active',
    profile: profile.intro || ''
  };
}

export function mapTourToAdminRow(tour = {}) {
  return {
    id: tour.id,
    title: tour.title,
    guide: tour.guide_profiles?.display_name || '',
    city: tour.city,
    type: tour.type,
    thumbnail: tour.tour_images?.[0]?.image_path || '',
    createdAt: tour.created_at || '',
    bookings: tour.reservations?.length ?? 0,
    status: tour.status,
    description: tour.description,
    price: `${tour.currency || 'USD'} ${tour.price_amount ?? 0}`,
    options: tour.options ? Object.keys(tour.options).filter((key) => tour.options[key]).join(', ') : ''
  };
}

export async function fetchAdminMembers(client) {
  const profiles = await client.request('profiles', {
    query: '?select=id,email,display_name,role,status,created_at'
  });
  const guideProfiles = await client.request('guide_profiles', {
    query: '?select=*,tours(id)'
  });
  return {
    travelers: profiles.filter((profile) => profile.role !== 'guide').map(mapProfileToAdminMember),
    guides: guideProfiles.map(mapGuideProfileToAdminGuide)
  };
}

export async function fetchAdminTours(client) {
  const tours = await client.request('tours', {
    query: '?select=*,guide_profiles(display_name),tour_images(image_path,sort_order),reservations(id)&order=created_at.desc'
  });
  return tours.map(mapTourToAdminRow);
}

export async function updateProfileStatus(client, { profileId, status }) {
  const updated = await client.request('profiles', {
    method: 'PATCH',
    query: `?id=eq.${requireText(profileId, 'A profile id is required.')}`,
    body: { status: requireText(status, 'A profile status is required.') }
  });
  return updated[0] ?? null;
}

export async function updateTourStatus(client, { tourId, status }) {
  const updated = await client.request('tours', {
    method: 'PATCH',
    query: `?id=eq.${requireText(tourId, 'A tour id is required.')}`,
    body: { status: asAdminStatus(status) }
  });
  return updated[0] ?? null;
}

export async function fetchAdminReviews(client) {
  return client.request('reviews', {
    query: '?select=*,profiles(display_name),tours(title)&order=created_at.desc'
  });
}

export async function updateReviewStatus(client, { reviewId, status }) {
  const updated = await client.request('reviews', {
    method: 'PATCH',
    query: `?id=eq.${requireText(reviewId, 'A review id is required.')}`,
    body: { status: requireText(status, 'A review status is required.') }
  });
  return updated[0] ?? null;
}

export async function fetchSupportTickets(client) {
  return client.request('support_tickets', {
    query: '?select=*,profiles(display_name,email)&order=created_at.desc'
  });
}

export async function replyToSupportTicket(client, { ticketId, reply }) {
  const updated = await client.request('support_tickets', {
    method: 'PATCH',
    query: `?id=eq.${requireText(ticketId, 'A ticket id is required.')}`,
    body: buildSupportReplyPatch(reply)
  });
  return updated[0] ?? null;
}

export async function fetchNotices(client) {
  return client.request('notices', {
    query: '?select=*&order=created_at.desc'
  });
}

export async function createNotice(client, { adminId, payload }) {
  const created = await client.request('notices', {
    method: 'POST',
    body: buildNoticeRow({ adminId, payload })
  });
  return created[0] ?? null;
}

export async function deleteNotice(client, noticeId) {
  await client.request('notices', {
    method: 'DELETE',
    query: `?id=eq.${requireText(noticeId, 'A notice id is required.')}`,
    prefer: ''
  });
  return { deleted: true };
}

export async function fetchPlatformSettings(client) {
  return client.request('platform_settings', {
    query: '?select=*&order=group_key.asc,sort_order.asc,name.asc'
  });
}

export async function createPlatformSetting(client, payload) {
  const created = await client.request('platform_settings', {
    method: 'POST',
    body: buildPlatformSettingRow(payload)
  });
  return created[0] ?? null;
}
