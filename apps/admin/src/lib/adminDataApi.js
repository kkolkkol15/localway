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

function preserveLineBreakText(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isRenderableImageUrl(value = '') {
  return /^(https?:|data:|blob:)/i.test(String(value));
}

function encodeStoragePath(path = '') {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function resolvePublicStorageImageUrl(bucket, storagePath = '', supabaseUrl = 'https://qrabzkcibqaslealvdar.supabase.co') {
  const path = String(storagePath || '').trim();
  if (!path || isRenderableImageUrl(path)) return path;
  const objectPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  return `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${encodeStoragePath(objectPath)}`;
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

function encodeFilterList(values) {
  return values.map((value) => `"${String(value).replaceAll('"', '\\"')}"`).join(',');
}

function normalizeGuideProfileDetail(profile = null) {
  if (!profile) return null;
  const [nativeLanguage = '', ...additionalLanguages] = profile.languages ?? [];
  const settlements = profile.settlements ?? profile.settlementRows ?? [];
  return {
    id: profile.id,
    userId: profile.user_id,
    name: profile.display_name || 'Guide',
    city: profile.city || '',
    nationality: profile.nationality || '',
    gender: profile.gender || '',
    birthYear: profile.birth_year || '',
    residenceYears: profile.residence_years ?? 0,
    nativeLanguage,
    additionalLanguages,
    intro: profile.intro || '',
    profileImagePath: profile.profile_image_path || '',
    status: profile.status || 'active',
    updatedAt: profile.updated_at || '',
    metadata: profile.metadata ?? {},
    tours: profile.tours?.length ?? 0,
    activeTours: (profile.tours ?? []).filter((tour) => tour?.status === 'active').length,
    settlements: settlements.length,
    pendingSettlements: settlements.filter((settlement) => settlement?.status === 'pending').length
  };
}

function latestByDate(items = [], keys = ['updated_at', 'created_at']) {
  return [...items].sort((a, b) => {
    const left = keys.map((key) => a?.[key]).find(Boolean) || '';
    const right = keys.map((key) => b?.[key]).find(Boolean) || '';
    return String(right).localeCompare(String(left));
  })[0] ?? null;
}

function mapReservationActivity(row = null) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.tours?.title || row.title || '예약',
    status: row.status || '',
    date: row.reserved_date || row.created_at || '',
    amount: row.amount ?? null,
    currency: row.currency || ''
  };
}

function mapReviewActivity(row = null) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.tours?.title || row.title || '후기',
    rating: row.rating ?? null,
    content: row.content || '',
    status: row.status || '',
    createdAt: row.created_at || ''
  };
}

function mapTicketActivity(row = null) {
  if (!row) return null;
  return {
    id: row.id,
    subject: row.subject || '문의',
    status: row.status || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function mapBookmarkActivity(row = null) {
  if (!row) return null;
  return {
    tourId: row.tour_id || '',
    title: row.tours?.title || '저장한 투어',
    createdAt: row.created_at || ''
  };
}

function mapConversationActivity(row = null) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title || (row.type === 'admin' ? '운영팀 메시지' : '대화'),
    lastMessage: row.last_message || '',
    updatedAt: row.updated_at || row.created_at || ''
  };
}

function buildActivitySummary(profile = {}) {
  const reservations = profile.reservations ?? [];
  const reviews = profile.reviews ?? [];
  const supportTickets = profile.supportTickets ?? profile.support_tickets ?? [];
  const bookmarks = profile.bookmarks ?? [];
  const conversations = profile.conversations ?? [];
  return {
    reservations: {
      total: reservations.length,
      latest: mapReservationActivity(latestByDate(reservations, ['reserved_date', 'updated_at', 'created_at']))
    },
    reviews: {
      total: reviews.length,
      latest: mapReviewActivity(latestByDate(reviews))
    },
    supportTickets: {
      total: supportTickets.length,
      latest: mapTicketActivity(latestByDate(supportTickets))
    },
    bookmarks: {
      total: bookmarks.length,
      latest: mapBookmarkActivity(latestByDate(bookmarks, ['created_at']))
    },
    conversations: {
      total: conversations.length,
      latest: mapConversationActivity(latestByDate(conversations))
    }
  };
}

function mapRequestedTourPayload(payload = {}) {
  const mainImagePath = payload.main_image_path || '';
  const descriptionText = preserveLineBreakText(payload.description);
  return {
    title: payload.title || '',
    city: payload.city || '',
    type: payload.type || '',
    description: compactText(payload.description),
    descriptionText,
    contentHtml: payload.content_html || '',
    detailText: htmlToText(payload.content_html) || compactText(descriptionText) || '상세 설명이 없습니다.',
    priceAmount: payload.price_amount ?? 0,
    currency: payload.currency || 'USD',
    priceLabel: formatPrice(payload.currency, payload.price_amount),
    paymentType: payload.payment_type || '',
    paymentTypeLabel: formatPaymentType(payload.payment_type),
    durationMinutes: payload.duration_minutes ?? null,
    durationLabel: formatDuration(payload.duration_minutes),
    maxPeople: payload.max_people ?? null,
    maxPeopleLabel: formatPeople(payload.max_people),
    mainImagePath,
    mainImageUrl: resolvePublicStorageImageUrl('tour-images', mainImagePath),
    optionLabels: normalizeList(payload.options),
    transportLabels: normalizeList(payload.transport)
  };
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
  const guideProfile = normalizeGuideProfileDetail(profile.guideProfile || profile.guide_profiles);
  const activity = buildActivitySummary(profile);
  return {
    id: profile.id,
    name: profile.display_name || profile.email || 'Member',
    email: profile.email || '',
    avatar: profile.avatar_path || '',
    role: profile.role || 'traveler',
    isGuide: Boolean(profile.is_guide),
    joinedAt: profile.created_at || '',
    updatedAt: profile.updated_at || '',
    status: profile.status || 'active',
    bookings: profile.reservations?.length ?? 0,
    metadata: profile.metadata ?? {},
    accountSettings: profile.accountSettings || profile.account_settings || null,
    activity,
    guideProfile
  };
}

export function mapGuideProfileToAdminGuide(profile = {}) {
  const detail = normalizeGuideProfileDetail(profile);
  return {
    id: detail?.id,
    userId: detail?.userId,
    name: detail?.name || 'Guide',
    city: detail?.city || '',
    rating: Number(profile.rating_avg ?? 0),
    tours: detail?.tours ?? 0,
    status: detail?.status || 'active',
    profile: detail?.intro || '',
    detail
  };
}

export function mapTourChangeRequestToAdminRow(request = {}) {
  return {
    id: request.id,
    status: request.status || '',
    createdAt: request.created_at || '',
    reviewedAt: request.reviewed_at || '',
    rejectionReason: request.rejection_reason || '',
    requested: mapRequestedTourPayload(request.payload ?? {})
  };
}

export function mapTourToAdminRow(tour = {}) {
  const images = [...(tour.tour_images ?? [])]
    .filter((image) => image?.image_path)
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const optionLabels = normalizeList(tour.options);
  const transportLabels = normalizeList(tour.transport);
  const descriptionText = preserveLineBreakText(tour.description);
  const detailText = htmlToText(tour.content_html) || compactText(descriptionText) || '상세 설명이 없습니다.';
  const priceLabel = formatPrice(tour.currency, tour.price_amount);
  const pendingChangeRequest = (tour.tour_change_requests ?? [])
    .filter((request) => request?.status === 'pending')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .map(mapTourChangeRequestToAdminRow)[0] ?? null;

  return {
    id: tour.id,
    title: tour.title,
    guide: tour.guide_profiles?.display_name || '',
    city: tour.city || '',
    type: tour.type || '',
    mainImagePath: images[0]?.image_path || '',
    thumbnail: resolvePublicStorageImageUrl('tour-images', images[0]?.image_path || ''),
    gallery: images.map((image) => resolvePublicStorageImageUrl('tour-images', image.image_path)),
    hasImage: Boolean(images[0]?.image_path),
    createdAt: tour.created_at || '',
    bookings: tour.reservations?.length ?? 0,
    status: tour.status || '',
    description: compactText(tour.description),
    descriptionText,
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
    transportLabels,
    reviewType: pendingChangeRequest ? 'edit' : 'new',
    pendingChangeRequest
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

const adminProfileColumns = 'id,email,display_name,avatar_path,role,is_guide,status,created_at,updated_at';

async function requestAdminProfiles(client, filters = '') {
  try {
    return await client.request('profiles', {
      query: `?select=${adminProfileColumns},metadata${filters}`
    });
  } catch {
    return client.request('profiles', {
      query: `?select=${adminProfileColumns}${filters}`
    });
  }
}

export async function fetchAdminMembers(client) {
  const profiles = await requestAdminProfiles(client);
  const fallbackTravelerCount = profiles.filter((profile) => profile.role !== 'admin').length;
  const [rawGuideProfiles, guideTours, travelerCount, guideCount] = await Promise.all([
    client.request('guide_profiles', {
      query: '?select=*'
    }).catch(() => []),
    client.request('tours', {
      query: '?select=id,guide_id,status'
    }).catch(() => []),
    client.count('profiles', { query: '?role=neq.admin' }).catch(() => fallbackTravelerCount),
    client.count('guide_profiles', { query: '?status=eq.active' }).catch(() => null)
  ]);
  const guideProfiles = rawGuideProfiles.map((profile) => ({
    ...profile,
    tours: guideTours.filter((tour) => tour.guide_id === profile.id)
  }));
  const fallbackGuideCount = guideProfiles.filter((profile) => profile.status === 'active').length;

  return {
    travelers: profiles.filter((profile) => profile.role !== 'admin').map(mapProfileToAdminMember),
    guides: guideProfiles.map(mapGuideProfileToAdminGuide),
    stats: {
      travelers: travelerCount,
      guides: guideCount ?? fallbackGuideCount
    },
    integrityWarnings: buildMemberIntegrityWarnings({ profiles, guideProfiles, travelerCount })
  };
}

export async function fetchAdminMemberDetail(client, memberId) {
  const encodedMemberId = encodeURIComponent(requireText(memberId, 'A member id is required.'));
  const [profiles, accountSettings, guideProfiles, reservations, reviews, supportTickets, bookmarks, conversations] = await Promise.all([
    requestAdminProfiles(client, `&id=eq.${encodedMemberId}`),
    client.request('account_settings', {
      query: `?select=*&profile_id=eq.${encodedMemberId}`
    }).catch(() => []),
    client.request('guide_profiles', {
      query: `?select=*&user_id=eq.${encodedMemberId}`
    }).catch(() => []),
    client.request('reservations', {
      query: `?select=id,reserved_date,people_count,amount,currency,status,created_at,updated_at,tours(title)&traveler_id=eq.${encodedMemberId}&order=reserved_date.desc`
    }).catch(() => []),
    client.request('reviews', {
      query: `?select=id,rating,content,status,created_at,updated_at,tours(title)&author_id=eq.${encodedMemberId}&order=created_at.desc`
    }).catch(() => []),
    client.request('support_tickets', {
      query: `?select=id,subject,status,created_at,updated_at&author_id=eq.${encodedMemberId}&order=created_at.desc`
    }).catch(() => []),
    client.request('bookmarks', {
      query: `?select=tour_id,created_at,tours(title)&profile_id=eq.${encodedMemberId}&order=created_at.desc`
    }).catch(() => []),
    client.request('conversations', {
      query: `?select=id,type,title,last_message,created_at,updated_at&or=(traveler_id.eq.${encodedMemberId},participant_id.eq.${encodedMemberId})&order=updated_at.desc`
    }).catch(() => [])
  ]);
  const profile = profiles[0];
  if (!profile) return null;
  const guideProfile = guideProfiles[0] ?? null;
  const [guideTours, settlements] = guideProfile?.id
    ? await Promise.all([
      client.request('tours', {
        query: `?select=id,status&guide_id=eq.${encodeURIComponent(guideProfile.id)}`
      }).catch(() => []),
      client.request('settlements', {
        query: `?select=id,amount,currency,cycle,status,created_at,updated_at&guide_id=eq.${encodeURIComponent(guideProfile.id)}&order=created_at.desc`
      }).catch(() => [])
    ])
    : [[], []];
  return mapProfileToAdminMember({
    ...profile,
    reservations,
    reviews,
    supportTickets,
    bookmarks,
    conversations,
    accountSettings: accountSettings[0] ?? null,
    guideProfile: guideProfile ? { ...guideProfile, tours: guideTours, settlements } : null
  });
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
  const tourIds = tours.map((tour) => tour.id).filter(Boolean);
  const changeRequests = tourIds.length
    ? await client.request('tour_change_requests', {
      query: `?select=id,tour_id,status,payload,created_at,reviewed_at,rejection_reason&tour_id=in.(${encodeFilterList(tourIds)})&order=created_at.desc`
    }).catch(() => [])
    : [];
  const requestsByTourId = changeRequests.reduce((groups, request) => {
    const tourId = request?.tour_id;
    if (!tourId) return groups;
    return { ...groups, [tourId]: [...(groups[tourId] ?? []), request] };
  }, {});
  return tours.map((tour) => mapTourToAdminRow({
    ...tour,
    tour_change_requests: requestsByTourId[tour.id] ?? []
  }));
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

export async function reviewTourChangeRequest(client, { requestId, decision, reason = '' }) {
  const updated = await client.request('rpc/review_tour_change_request', {
    method: 'POST',
    body: {
      p_request_id: requireText(requestId, 'A tour change request id is required.'),
      p_decision: requireText(decision, 'A review decision is required.'),
      p_reason: reason || ''
    }
  });
  return updated[0] ?? updated ?? null;
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
