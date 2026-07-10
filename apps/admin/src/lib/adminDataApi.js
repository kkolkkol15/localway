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

function compactText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToText(value) {
  return compactText(decodeHtmlEntities(String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')));
}

function formatPrice(currency, amount) {
  const code = compactText(currency || 'USD') || 'USD';
  const numeric = Number(amount ?? 0);
  const formatted = Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : '0';
  return `${code} ${formatted}`;
}

function formatDuration(minutes) {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric) || numeric <= 0) return '미입력';
  const hours = Math.floor(numeric / 60);
  const remainingMinutes = numeric % 60;
  if (hours && remainingMinutes) return `${hours}시간 ${remainingMinutes}분`;
  if (hours) return `${hours}시간`;
  return `${remainingMinutes}분`;
}

function formatPeople(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return '미입력';
  return `${numeric}명`;
}

function formatPaymentType(value) {
  const normalized = compactText(value);
  const labels = {
    pay_now: '즉시 결제',
    prepaid: '즉시 결제',
    pay_later: '현장 결제',
    onsite: '현장 결제',
    free: '무료'
  };
  return labels[normalized] || normalized || '미입력';
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(compactText).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(compactText).filter(Boolean);
  if (value && typeof value === 'object') {
    return Object.keys(value).filter((key) => value[key]);
  }
  return [];
}

export function buildAdminConversationRow({ adminId, memberId, title = '운영팀 메시지' }) {
  return {
    type: 'admin',
    participant_id: requireText(memberId, 'A member id is required.'),
    created_by: requireText(adminId, 'An admin id is required.'),
    title: requireText(title || '운영팀 메시지', 'A conversation title is required.'),
    reply_enabled: true,
    last_message: ''
  };
}

export function buildConversationMessageRow({ conversationId, senderId, body }) {
  return {
    conversation_id: requireText(conversationId, 'A conversation id is required.'),
    sender_id: requireText(senderId, 'A sender id is required.'),
    body: requireText(body, 'A message body is required.')
  };
}

export function mapConversationToAdminThread(conversation = {}) {
  const messages = [...(conversation.conversation_messages ?? [])]
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    .map((message) => ({
      id: message.id,
      senderId: message.sender_id,
      text: message.body,
      createdAt: message.created_at || ''
    }));
  return {
    id: conversation.id,
    type: conversation.type || 'admin',
    title: conversation.title || '운영팀 메시지',
    memberId: conversation.participant_id || '',
    memberName: conversation.profiles?.display_name || conversation.profiles?.email || '회원',
    memberEmail: conversation.profiles?.email || '',
    lastMessage: conversation.last_message || '',
    replyEnabled: conversation.reply_enabled !== false,
    updatedAt: conversation.updated_at || conversation.created_at || '',
    messages
  };
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
    isGuide: Boolean(profile.is_guide),
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
  const images = [...(tour.tour_images ?? [])]
    .filter((image) => image?.image_path)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const optionLabels = normalizeList(tour.options);
  const transportLabels = normalizeList(tour.transport);
  const detailText = htmlToText(tour.content_html) || compactText(tour.description) || '상세 설명이 없습니다.';
  const priceLabel = formatPrice(tour.currency, tour.price_amount);

  return {
    id: tour.id,
    title: tour.title,
    guide: tour.guide_profiles?.display_name || '',
    city: tour.city || '',
    type: tour.type || '',
    thumbnail: images[0]?.image_path || '',
    gallery: images.map((image) => image.image_path),
    hasImage: Boolean(images[0]?.image_path),
    createdAt: tour.created_at || '',
    bookings: tour.reservations?.length ?? 0,
    status: tour.status || '',
    description: compactText(tour.description),
    contentHtml: tour.content_html || '',
    detailText,
    priceAmount: tour.price_amount ?? 0,
    currency: tour.currency || 'USD',
    price: priceLabel,
    priceLabel,
    paymentType: tour.payment_type || '',
    paymentTypeLabel: formatPaymentType(tour.payment_type),
    durationMinutes: tour.duration_minutes ?? null,
    durationLabel: formatDuration(tour.duration_minutes),
    maxPeople: tour.max_people ?? null,
    maxPeopleLabel: formatPeople(tour.max_people),
    options: optionLabels.join(', '),
    optionLabels,
    transportLabels
  };
}

export function buildMemberIntegrityWarnings({ profiles = [], guideProfiles = [], travelerCount = 0 } = {}) {
  const profilesById = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
  const activeGuideProfiles = guideProfiles.filter((profile) => profile.status === 'active');
  const orphanGuideProfiles = activeGuideProfiles.filter((profile) => !profilesById[profile.user_id]);
  const unflaggedGuideProfiles = activeGuideProfiles.filter((profile) => {
    const memberProfile = profilesById[profile.user_id];
    return memberProfile && !memberProfile.is_guide;
  });
  const nonAdminGuideCount = activeGuideProfiles.filter((profile) => profilesById[profile.user_id]?.role !== 'admin').length;
  return [
    orphanGuideProfiles.length ? `${orphanGuideProfiles.length}개의 가이드 프로필이 회원 프로필과 연결되지 않았습니다.` : '',
    unflaggedGuideProfiles.length ? `${unflaggedGuideProfiles.length}명의 가이드 회원에 is_guide가 설정되어 있지 않습니다.` : '',
    nonAdminGuideCount > travelerCount ? '일반 가이드 수가 여행객/회원 수보다 많습니다.' : ''
  ].filter(Boolean);
}

export function buildMemberMessagePayload(member = {}) {
  return {
    target: member.name || member.email || '회원',
    title: '개별 안내',
    body: '관리자 메시지입니다.'
  };
}

export function buildAdminMemberMessageRequest({ adminId, target = {}, title, body }) {
  return {
    adminId,
    memberId: target.userId || target.id,
    title,
    body,
    logTarget: target.name || target.email || '회원'
  };
}

export async function fetchAdminMembers(client) {
  const profiles = await client.request('profiles', {
    query: '?select=id,email,display_name,role,is_guide,status,created_at'
  });
  const guideProfiles = await client.request('guide_profiles', {
    query: '?select=*,tours(id)'
  });
  const [travelerCount, guideCount] = await Promise.all([
    client.count('profiles', { query: '?role=neq.admin' }),
    client.count('guide_profiles', { query: '?status=eq.active' })
  ]);

  return {
    travelers: profiles.filter((profile) => profile.role !== 'admin').map(mapProfileToAdminMember),
    guides: guideProfiles.map(mapGuideProfileToAdminGuide),
    stats: {
      travelers: travelerCount,
      guides: guideCount
    },
    integrityWarnings: buildMemberIntegrityWarnings({ profiles, guideProfiles, travelerCount })
  };
}

export async function findOrCreateAdminConversation(client, { adminId, memberId, title = '운영팀 메시지' }) {
  const query = `?select=*&type=eq.admin&participant_id=eq.${encodeURIComponent(requireText(memberId, 'A member id is required.'))}&limit=1`;
  const existing = await client.request('conversations', { query });
  if (existing[0]) return existing[0];

  const created = await client.request('conversations', {
    method: 'POST',
    body: buildAdminConversationRow({ adminId, memberId, title })
  });
  return created[0] ?? null;
}

export async function sendAdminConversationMessage(client, { conversationId, senderId, body }) {
  const message = buildConversationMessageRow({ conversationId, senderId, body });
  const created = await client.request('conversation_messages', {
    method: 'POST',
    body: message
  });
  await client.request('conversations', {
    method: 'PATCH',
    query: `?id=eq.${encodeURIComponent(message.conversation_id)}`,
    body: { last_message: message.body, updated_at: new Date().toISOString() }
  });
  return created[0] ?? null;
}

export async function sendAdminMemberMessage(client, { adminId, memberId, title = '운영팀 메시지', body }) {
  const conversation = await findOrCreateAdminConversation(client, { adminId, memberId, title });
  const message = await sendAdminConversationMessage(client, {
    conversationId: conversation.id,
    senderId: adminId,
    body
  });
  return { conversation, message };
}

export async function fetchAdminConversations(client) {
  const rows = await client.request('conversations', {
    query: '?select=*,profiles!conversations_participant_id_fkey(display_name,email),conversation_messages(*)&type=eq.admin&order=updated_at.desc'
  });
  return rows.map(mapConversationToAdminThread);
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
