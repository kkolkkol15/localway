function requireValue(value, message) {
  if (!String(value ?? '').trim()) throw new Error(message);
  return String(value).trim();
}

function throwIfError(error) {
  if (error) throw error;
}

export function mapGuideRecord(profile = {}) {
  return {
    id: profile.id,
    name: profile.display_name || 'Local guide',
    city: profile.city || '',
    languages: profile.languages ?? [],
    years: profile.residence_years ?? 0,
    rating: Number(profile.rating_avg ?? 0),
    reviews: Number(profile.review_count ?? 0),
    avatar: profile.profile_image_path || ''
  };
}

export function mapTourRecord(record = {}) {
  const images = [...(record.tour_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const guide = mapGuideRecord(record.guide_profiles ?? record.guide ?? {});
  return {
    id: record.id,
    title: record.title,
    city: record.city,
    type: record.type,
    description: record.description,
    contentHtml: record.content_html || '',
    price: Number(record.price_amount ?? 0),
    currency: record.currency || 'USD',
    paymentType: record.payment_type || 'pay_as_you_go',
    durationMinutes: Number(record.duration_minutes ?? 0),
    maxPeople: Number(record.max_people ?? 1),
    status: record.status,
    thumbnail: images[0]?.image_path || guide.avatar || '',
    gallery: images.map((image) => image.image_path),
    options: record.options ?? {},
    transport: record.transport ?? [],
    guide,
    rating: guide.rating,
    reviews: guide.reviews,
    reviewsList: record.reviews ?? []
  };
}

export function buildAccountSettingsRow({ profileId, settings = {} }) {
  return {
    profile_id: requireValue(profileId, 'A profile id is required.'),
    preferences: settings.preferences ?? {},
    notifications: settings.notifications ?? {},
    privacy: settings.privacy ?? {},
    security: settings.security ?? {}
  };
}

export function buildBookmarkRow({ profileId, tourId }) {
  return {
    profile_id: requireValue(profileId, 'A profile id is required.'),
    tour_id: requireValue(tourId, 'A tour id is required.')
  };
}

export function buildSupportTicketRow({ profileId, payload = {} }) {
  const subject = requireValue(payload.subject, 'Support ticket subject and description are required.');
  const description = requireValue(payload.description, 'Support ticket subject and description are required.');
  return {
    author_id: requireValue(profileId, 'A profile id is required.'),
    subject,
    description,
    status: 'open'
  };
}

export function buildConversationMessageRow({ conversationId, senderId, body }) {
  return {
    conversation_id: requireValue(conversationId, 'A conversation id is required.'),
    sender_id: requireValue(senderId, 'A sender id is required.'),
    body: requireValue(body, 'Message body is required.')
  };
}

export async function fetchActiveTours(client, { city = '', filters = {} } = {}) {
  let query = client
    .from('tours')
    .select('*, guide_profiles(*), tour_images(*)')
    .eq('status', 'active');
  if (city) query = query.ilike('city', city);
  if (filters.type) query = query.eq('type', filters.type);
  const { data, error } = await query.order('created_at', { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapTourRecord);
}

export async function fetchTourById(client, tourId) {
  const { data, error } = await client
    .from('tours')
    .select('*, guide_profiles(*), tour_images(*), reviews(*)')
    .eq('id', requireValue(tourId, 'A tour id is required.'))
    .single();
  throwIfError(error);
  return mapTourRecord(data);
}

export async function fetchAccountSettings(client, profileId) {
  const { data, error } = await client
    .from('account_settings')
    .select('*')
    .eq('profile_id', requireValue(profileId, 'A profile id is required.'))
    .maybeSingle();
  throwIfError(error);
  return data;
}

export async function upsertAccountSettings(client, { profileId, settings }) {
  const row = buildAccountSettingsRow({ profileId, settings });
  const { data, error } = await client
    .from('account_settings')
    .upsert(row, { onConflict: 'profile_id' })
    .select()
    .single();
  throwIfError(error);
  return data;
}

export async function fetchBookmarks(client, profileId) {
  const { data, error } = await client
    .from('bookmarks')
    .select('tour_id, tours(*, guide_profiles(*), tour_images(*))')
    .eq('profile_id', requireValue(profileId, 'A profile id is required.'));
  throwIfError(error);
  return (data ?? []).map((item) => ({ tourId: item.tour_id, tour: item.tours ? mapTourRecord(item.tours) : null }));
}

export async function toggleBookmark(client, { profileId, tourId, currentlySaved }) {
  const row = buildBookmarkRow({ profileId, tourId });
  if (currentlySaved) {
    const { error } = await client
      .from('bookmarks')
      .delete()
      .eq('profile_id', row.profile_id)
      .eq('tour_id', row.tour_id);
    throwIfError(error);
    return { saved: false };
  }

  const { error } = await client.from('bookmarks').insert(row);
  throwIfError(error);
  return { saved: true };
}

export async function createSupportTicket(client, { profileId, payload }) {
  const row = buildSupportTicketRow({ profileId, payload });
  const { data, error } = await client.from('support_tickets').insert(row).select().single();
  throwIfError(error);
  return data;
}

export async function fetchSupportTickets(client, profileId) {
  const { data, error } = await client
    .from('support_tickets')
    .select('*')
    .eq('author_id', requireValue(profileId, 'A profile id is required.'))
    .order('created_at', { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export async function fetchConversations(client, profileId) {
  const { data, error } = await client
    .from('conversations')
    .select('*, conversation_messages(*)')
    .or(`traveler_id.eq.${requireValue(profileId, 'A profile id is required.')},participant_id.eq.${profileId}`)
    .order('updated_at', { ascending: false });
  throwIfError(error);
  return data ?? [];
}

export async function sendConversationMessage(client, { conversationId, senderId, body }) {
  const row = buildConversationMessageRow({ conversationId, senderId, body });
  const { data, error } = await client.from('conversation_messages').insert(row).select().single();
  throwIfError(error);
  return data;
}
