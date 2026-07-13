import { resolveGuideProfileImageUrl, uploadPublicAvatar } from './supabaseAuth.js';

function requireValue(value, message) {
  if (!String(value ?? '').trim()) throw new Error(message);
  return String(value).trim();
}

function throwIfError(error) {
  if (error) throw error;
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

function compactText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function htmlToText(value = '') {
  return compactText(String(value || '').replace(/<[^>]*>/g, ' '));
}

function formatPrice(currency = 'USD', amount = 0) {
  const value = Number(amount ?? 0);
  return `${currency || 'USD'} ${Number.isFinite(value) ? value.toLocaleString('ko-KR') : '0'}`;
}

function formatDuration(minutes = 0) {
  const value = Number(minutes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return '시간 미정';
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours && rest) return `${hours}시간 ${rest}분`;
  if (hours) return `${hours}시간`;
  return `${rest}분`;
}

function formatReviewDate(value = '') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR');
}

function formatOptionLabel(key = '') {
  return String(key)
    .replace(/^option_/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(compactText).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(compactText).filter(Boolean);
  if (value && typeof value === 'object') return Object.keys(value).filter((key) => value[key]).map(formatOptionLabel);
  return [];
}

export function resolvePublicStorageImageUrl(bucket, storagePath = '', supabaseUrl = 'https://qrabzkcibqaslealvdar.supabase.co') {
  const path = String(storagePath || '').trim();
  if (!path || isRenderableImageUrl(path)) return path;
  const objectPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  return `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${encodeStoragePath(objectPath)}`;
}

export function buildTourItinerarySteps(tour = {}) {
  const city = compactText(tour.city) || '진행 지역';
  const detailSource = tour.detailText || htmlToText(tour.contentHtml) || tour.description;
  const detailSentences = compactText(detailSource)
    .split(/(?<=[.!?。！？])\s+/)
    .map(compactText)
    .filter(Boolean);
  const flow = detailSentences.slice(0, 2).join(' ') || '가이드가 준비한 동선에 따라 현지의 분위기와 주요 경험을 차례로 둘러봅니다.';
  const transportLabels = Array.isArray(tour.transportLabels) ? tour.transportLabels.map(compactText).filter(Boolean) : [];
  const transport = transportLabels.length ? ` 주요 이동수단은 ${transportLabels.join(', ')}입니다.` : '';
  const duration = tour.durationLabel && tour.durationLabel !== '시간 미정' ? ` 전체 소요 시간은 ${tour.durationLabel}입니다.` : '';
  return [
    {
      title: '만남과 오리엔테이션',
      description: `${city}에서 가이드와 만나 일정, 이동 방식, 주의사항을 먼저 확인합니다.`
    },
    {
      title: '투어 진행',
      description: `${flow}${transport}`.trim()
    },
    {
      title: '마무리 안내',
      description: `마지막에는 현지 팁과 추가 질문을 나누며 일정을 정리합니다.${duration}`.trim()
    }
  ];
}

export function getPaginatedSearchResults(results = [], visibleCount = 12) {
  const list = Array.isArray(results) ? results : [];
  const count = Math.max(0, Number(visibleCount) || 0);
  const visibleResults = list.slice(0, Math.min(count, list.length));
  return {
    visibleResults,
    hasMore: visibleResults.length < list.length
  };
}

export const DEFAULT_SEARCH_FILTERS = {
  types: [],
  paymentTypes: [],
  languages: [],
  options: [],
  transport: [],
  priceMin: '',
  priceMax: '',
  ratingMin: 0,
  durationMin: '',
  durationMax: '',
  maxPeopleMin: '',
  guideYearsMin: 0
};

function readNumberFilter(value) {
  if (value === '' || value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function uniqueSorted(values = []) {
  return [...new Set(values.map(compactText).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function filterSearchTours(tours = [], { city = '', adults = 1, filters = DEFAULT_SEARCH_FILTERS } = {}) {
  const normalizedCity = compactText(city).toLowerCase();
  const requestedAdults = Math.max(1, Number(adults) || 1);
  const priceMin = readNumberFilter(filters.priceMin);
  const priceMax = readNumberFilter(filters.priceMax);
  const ratingMin = readNumberFilter(filters.ratingMin) ?? 0;
  const durationMin = readNumberFilter(filters.durationMin);
  const durationMax = readNumberFilter(filters.durationMax);
  const maxPeopleMin = Math.max(requestedAdults, readNumberFilter(filters.maxPeopleMin) ?? 0);
  const guideYearsMin = readNumberFilter(filters.guideYearsMin) ?? 0;

  return (Array.isArray(tours) ? tours : []).filter((tour) => {
    if (normalizedCity && compactText(tour.city).toLowerCase() !== normalizedCity) return false;
    if ((filters.types ?? []).length && !filters.types.includes(tour.type)) return false;
    if ((filters.paymentTypes ?? []).length && !filters.paymentTypes.includes(tour.paymentType)) return false;
    if ((filters.languages ?? []).length && !filters.languages.some((lang) => (tour.guide?.languages ?? []).includes(lang))) return false;
    if ((filters.transport ?? []).length && !filters.transport.some((item) => (tour.transport ?? []).includes(item))) return false;
    if ((filters.options ?? []).length && !filters.options.every((key) => Boolean(tour.options?.[key]))) return false;
    if (priceMin != null && Number(tour.price ?? 0) < priceMin) return false;
    if (priceMax != null && Number(tour.price ?? 0) > priceMax) return false;
    if (Number(tour.rating ?? 0) < ratingMin) return false;
    if (durationMin != null && Number(tour.durationMinutes ?? 0) < durationMin) return false;
    if (durationMax != null && Number(tour.durationMinutes ?? 0) > durationMax) return false;
    if (Number(tour.maxPeople ?? 0) < maxPeopleMin) return false;
    if (Number(tour.guide?.years ?? 0) < guideYearsMin) return false;
    return true;
  });
}

export function sortSearchTours(tours = [], sort = 'recommended') {
  const list = Array.isArray(tours) ? [...tours] : [];
  if (sort === 'price_asc' || sort === 'price') return list.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
  if (sort === 'price_desc') return list.sort((a, b) => Number(b.price ?? 0) - Number(a.price ?? 0));
  if (sort === 'rating_desc' || sort === 'rated') return list.sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
  return list;
}

export function getSearchFilterOptions(tours = []) {
  const list = Array.isArray(tours) ? tours : [];
  const prices = list.map((tour) => Number(tour.price ?? 0)).filter(Number.isFinite);
  return {
    types: uniqueSorted(list.map((tour) => tour.type)),
    paymentTypes: uniqueSorted(list.map((tour) => tour.paymentType)),
    languages: uniqueSorted(list.flatMap((tour) => tour.guide?.languages ?? [])),
    options: uniqueSorted(list.flatMap((tour) => Object.entries(tour.options ?? {}).filter(([, value]) => Boolean(value)).map(([key]) => key))),
    transport: uniqueSorted(list.flatMap((tour) => tour.transport ?? [])),
    priceRange: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0
    }
  };
}

export function buildTourDetailPath(tourOrId) {
  const id = typeof tourOrId === 'string' ? tourOrId : tourOrId?.id;
  const value = String(id || '').trim();
  return value ? `/tour/${encodeURIComponent(value)}` : '';
}

export const homepageTourSectionDefinitions = [
  { key: 'popular', size: 4 },
  { key: 'recommended', size: 4 },
  { key: 'nearby', size: 4 },
  { key: 'week', size: 4 }
];

export function mapGuideRecord(profile = {}) {
  const profileAvatarPath = profile.profiles?.avatar_path || profile.avatar_path || '';
  const fallbackImage = resolveGuideProfileImageUrl(null, profile.profile_image_path || '');
  return {
    id: profile.id,
    name: profile.display_name || 'Local guide',
    city: profile.city || '',
    languages: profile.languages ?? [],
    years: profile.residence_years ?? 0,
    intro: profile.intro || '',
    rating: Number(profile.rating_avg ?? 0),
    reviews: Number(profile.review_count ?? 0),
    avatar: resolvePublicStorageImageUrl('avatars', profileAvatarPath) || fallbackImage
  };
}

function mapReviewRecord(review = {}) {
  const profile = review.profiles ?? {};
  return {
    id: review.id,
    author: compactText(profile.display_name) || 'Local Way traveler',
    authorAvatar: resolvePublicStorageImageUrl('avatars', profile.avatar_path || ''),
    rating: Math.min(5, Math.max(1, Number(review.rating ?? 0) || 1)),
    createdAt: review.created_at || '',
    dateLabel: formatReviewDate(review.created_at),
    content: compactText(review.content)
  };
}

export function mapTourRecord(record = {}) {
  const images = [...(record.tour_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const guide = mapGuideRecord(record.guide_profiles ?? record.guide ?? {});
  const imagePaths = images.map((image) => resolvePublicStorageImageUrl('tour-images', image.image_path));
  const durationMinutes = Number(record.duration_minutes ?? 0);
  const maxPeople = Number(record.max_people ?? 1);
  const optionLabels = normalizeList(record.options);
  const transportLabels = normalizeList(record.transport);
  const detailText = htmlToText(record.content_html) || compactText(record.description) || '';
  const price = Number(record.price_amount ?? 0);
  const reviewsList = (record.reviews ?? [])
    .filter((review) => !review.status || review.status === 'visible')
    .map(mapReviewRecord)
    .filter((review) => review.content);
  const reviewTotal = reviewsList.reduce((total, review) => total + review.rating, 0);
  const reviewAverage = reviewsList.length ? Number((reviewTotal / reviewsList.length).toFixed(1)) : 0;
  return {
    id: record.id,
    title: record.title,
    city: record.city,
    type: record.type,
    description: compactText(record.description),
    contentHtml: record.content_html || '',
    detailText,
    price,
    priceLabel: formatPrice(record.currency, price),
    currency: record.currency || 'USD',
    paymentType: record.payment_type || 'pay_as_you_go',
    durationMinutes,
    durationLabel: formatDuration(durationMinutes),
    maxPeople,
    maxPeopleLabel: `최대 ${Number.isFinite(maxPeople) && maxPeople > 0 ? maxPeople : 1}명`,
    status: record.status,
    image: imagePaths[0] || '',
    thumbnail: imagePaths[0] || '',
    gallery: imagePaths,
    options: record.options ?? {},
    optionLabels,
    transport: record.transport ?? [],
    transportLabels,
    guide,
    rating: reviewAverage,
    reviews: reviewsList.length,
    reviewsList
  };
}

function shuffleTours(tours, random) {
  const shuffled = [...tours];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function buildHomepageTourSections(tours = [], {
  sectionDefinitions = homepageTourSectionDefinitions,
  random = Math.random
} = {}) {
  const approvedTours = tours.filter(Boolean);
  const sections = Object.fromEntries(sectionDefinitions.map((section) => [section.key, []]));
  if (!approvedTours.length) return sections;

  const shuffledTours = shuffleTours(approvedTours, random);
  const requestedCount = sectionDefinitions.reduce((total, section) => total + section.size, 0);

  if (shuffledTours.length >= requestedCount) {
    let cursor = 0;
    sectionDefinitions.forEach((section) => {
      sections[section.key] = shuffledTours.slice(cursor, cursor + section.size);
      cursor += section.size;
    });
    return sections;
  }

  let cursor = 0;
  sectionDefinitions.forEach((section) => {
    const sectionSize = Math.min(section.size, shuffledTours.length);
    const rotatedTours = [...shuffledTours.slice(cursor % shuffledTours.length), ...shuffledTours.slice(0, cursor % shuffledTours.length)];
    sections[section.key] = rotatedTours.slice(0, sectionSize);
    cursor += sectionSize;
  });
  return sections;
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

export function buildMemberProfilePatch({ email, displayName, avatarPath, metadata } = {}) {
  const patch = {
    email: requireValue(email, 'An email address is required.'),
    display_name: requireValue(displayName, 'A display name is required.')
  };
  if (avatarPath !== undefined) patch.avatar_path = avatarPath || null;
  if (metadata !== undefined) patch.metadata = metadata ?? {};
  return patch;
}

export function buildGuideProfilePatch(payload = {}, { displayName = '', profileImagePath = '' } = {}) {
  const nativeLanguage = requireValue(payload.nativeLanguage, 'A native language is required.');
  const additionalLanguages = Array.isArray(payload.additionalLanguages)
    ? payload.additionalLanguages
    : String(payload.additionalLanguagesText || '').split(',');
  const languages = [nativeLanguage, ...additionalLanguages.map((item) => String(item).trim()).filter(Boolean)];
  const birthYear = Number(payload.birthYear);

  return {
    display_name: requireValue(displayName, 'A guide display name is required.'),
    city: requireValue(payload.city, 'A guide city is required.'),
    languages,
    intro: requireValue(payload.intro, 'A guide introduction is required.'),
    profile_image_path: profileImagePath || payload.profileImagePath || payload.profilePhotoUrl || null,
    nationality: String(payload.nationality || '').trim() || null,
    gender: String(payload.gender || '').trim() || null,
    birth_year: Number.isFinite(birthYear) ? birthYear : null,
    residence_years: Number(payload.years || payload.residenceYears || 0),
    metadata: {
      birthMonth: String(payload.birthMonth || '').trim(),
      birthDay: String(payload.birthDay || '').trim(),
      languageLevels: payload.languageLevels ?? {},
      profilePhotoName: payload.profilePhotoName || ''
    }
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

export function mapConversationRecord(record = {}, currentUserId = '') {
  const title = record.title || (record.type === 'admin' ? '운영팀' : 'Conversation');
  const messages = [...(record.conversation_messages ?? [])]
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
    .map((message) => ({
      id: message.id,
      senderId: message.sender_id,
      from: message.sender_id === currentUserId ? 'me' : 'them',
      text: message.body,
      createdAt: message.created_at || ''
    }));
  return {
    id: record.id,
    type: record.type ?? 'travel',
    title,
    displayName: title,
    guideName: title,
    avatar: '',
    lastMessage: record.last_message || messages.at(-1)?.text || '',
    replyEnabled: record.reply_enabled !== false,
    messages
  };
}

export async function fetchActiveTours(client, { city = '', filters = {} } = {}) {
  let query = client
    .from('tours')
    .select('*, guide_profiles!inner(*, profiles(avatar_path)), tour_images(*), reviews(id, rating, content, created_at, status, profiles(display_name, avatar_path))')
    .eq('status', 'active')
    .eq('guide_profiles.status', 'active');
  if (city) query = query.ilike('city', city);
  if (filters.type) query = query.eq('type', filters.type);
  const { data, error } = await query.order('created_at', { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapTourRecord);
}

export async function fetchTourById(client, tourId) {
  const { data, error } = await client
    .from('tours')
    .select('*, guide_profiles(*, profiles(avatar_path)), tour_images(*), reviews(id, rating, content, created_at, status, profiles(display_name, avatar_path))')
    .eq('id', requireValue(tourId, 'A tour id is required.'))
    .eq('status', 'active')
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

export async function updateMemberProfile(client, { profileId, email, displayName, avatarPath, metadata }) {
  const patch = buildMemberProfilePatch({ email, displayName, avatarPath, metadata });
  const { data, error } = await client
    .from('profiles')
    .update(patch)
    .eq('id', requireValue(profileId, 'A profile id is required.'))
    .select()
    .single();
  throwIfError(error);
  return data;
}

function cleanStorageFileName(name = 'profile-photo') {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function uploadGuideProfilePhoto(client, { userId, file }) {
  if (!file?.size) return '';
  return uploadPublicAvatar(client, {
    userId: requireValue(userId, 'A profile id is required.'),
    file,
    prefix: 'guide-avatar',
    includeBucketPrefix: true
  });
}

export async function updateGuideProfile(client, { guideProfileId, userId, displayName, payload, formElement, currentProfile = {}, profilePhotoFile = null }) {
  const form = formElement ? new FormData(formElement) : null;
  const selectedPhoto = profilePhotoFile || form?.get('profilePhoto');
  const uploadedPhotoPath = await uploadGuideProfilePhoto(client, { userId, file: selectedPhoto });
  const existingPhotoPath = resolveGuideProfileImageUrl(null, currentProfile.profilePhotoUrl || '') && !String(currentProfile.profilePhotoUrl).startsWith('data:')
    ? currentProfile.profilePhotoUrl
    : '';
  const profileImagePath = uploadedPhotoPath || existingPhotoPath || '';
  const patch = buildGuideProfilePatch(payload, { displayName, profileImagePath });
  const { data, error } = await client
    .from('guide_profiles')
    .update(patch)
    .eq('id', requireValue(guideProfileId, 'A guide profile id is required.'))
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

export async function fetchBookmarkIds(client, profileId) {
  const { data, error } = await client
    .from('bookmarks')
    .select('tour_id')
    .eq('profile_id', requireValue(profileId, 'A profile id is required.'));
  throwIfError(error);
  return (data ?? []).map((item) => String(item.tour_id || '').trim()).filter(Boolean);
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
  return (data ?? []).map((conversation) => mapConversationRecord(conversation, profileId));
}

export async function sendConversationMessage(client, { conversationId, senderId, body }) {
  const row = buildConversationMessageRow({ conversationId, senderId, body });
  const { data, error } = await client.from('conversation_messages').insert(row).select().single();
  throwIfError(error);
  return data;
}
