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

export function resolvePublicStorageImageUrl(bucket, storagePath = '', supabaseUrl = 'https://qrabzkcibqaslealvdar.supabase.co') {
  const path = String(storagePath || '').trim();
  if (!path || isRenderableImageUrl(path)) return path;
  const objectPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  return `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${encodeStoragePath(objectPath)}`;
}

export const homepageTourSectionDefinitions = [
  { key: 'popular', size: 4 },
  { key: 'recommended', size: 4 },
  { key: 'nearby', size: 4 },
  { key: 'week', size: 4 }
];

export function mapGuideRecord(profile = {}) {
  const profileAvatarPath = profile.profiles?.avatar_path || profile.avatar_path || '';
  const fallbackImage = isRenderableImageUrl(profile.profile_image_path) ? profile.profile_image_path : '';
  return {
    id: profile.id,
    name: profile.display_name || 'Local guide',
    city: profile.city || '',
    languages: profile.languages ?? [],
    years: profile.residence_years ?? 0,
    rating: Number(profile.rating_avg ?? 0),
    reviews: Number(profile.review_count ?? 0),
    avatar: resolvePublicStorageImageUrl('avatars', profileAvatarPath) || fallbackImage
  };
}

export function mapTourRecord(record = {}) {
  const images = [...(record.tour_images ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const guide = mapGuideRecord(record.guide_profiles ?? record.guide ?? {});
  const imagePaths = images.map((image) => resolvePublicStorageImageUrl('tour-images', image.image_path));
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
    image: imagePaths[0] || guide.avatar || '',
    thumbnail: imagePaths[0] || guide.avatar || '',
    gallery: imagePaths,
    options: record.options ?? {},
    transport: record.transport ?? [],
    guide,
    rating: guide.rating,
    reviews: guide.reviews,
    reviewsList: record.reviews ?? []
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
    .select('*, guide_profiles!inner(*, profiles(avatar_path)), tour_images(*)')
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
    .select('*, guide_profiles(*, profiles(avatar_path)), tour_images(*), reviews(*)')
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
  const path = `${requireValue(userId, 'A profile id is required.')}/guide-profile-${Date.now()}-${cleanStorageFileName(file.name)}`;
  const { error } = await client.storage
    .from('guide-verification')
    .upload(path, file, { upsert: true });
  throwIfError(error);
  return path;
}

export async function updateGuideProfile(client, { guideProfileId, userId, displayName, payload, formElement, currentProfile = {} }) {
  const form = formElement ? new FormData(formElement) : null;
  const selectedPhoto = form?.get('profilePhoto');
  const uploadedPhotoPath = await uploadGuideProfilePhoto(client, { userId, file: selectedPhoto });
  const existingPhotoPath = currentProfile.profilePhotoUrl && !String(currentProfile.profilePhotoUrl).startsWith('data:')
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
