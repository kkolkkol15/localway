import { tours } from '../data/mockData.js';
import { uniqueSortedDates } from '../lib/guideAvailability.js';

export function createDefaultAccountSettings() {
  return {
    preferences: {
      language: 'en',
      currency: 'USD',
      timezone: 'Asia/Seoul',
      distanceUnit: 'km'
    },
    notifications: {
      bookingEmail: true,
      bookingSms: true,
      messageEmail: true,
      messagePush: true,
      guideEmail: true,
      marketingEmail: false
    },
    privacy: {
      profileVisibility: 'public',
      showReviews: true,
      showLocation: true,
      allowDataPersonalization: true
    },
    security: {
      twoFactorEnabled: false,
      loginAlerts: true
    }
  };
}

export function createInitialState() {
  return {
    auth: { isAuthenticated: false, user: null, error: '' },
    bookmarks: [],
    bookings: [],
    conversations: [],
    guideProfile: null,
    guideUnavailableDates: [],
    drafts: [],
    inquiries: [],
    reviewsWritten: [],
    toast: null,
    currency: 'USD',
    accountSettings: createDefaultAccountSettings()
  };
}

export function isRegisteredGuideRole(role, isGuide = false) {
  return Boolean(isGuide) || ['guide', 'pending-guide'].includes(role);
}

export function formatRoleLabel(role = 'traveler') {
  if (role === 'pending-guide') return 'Pending guide';
  return String(role || 'traveler')
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function serializePersistentState(state) {
  return {
    ...state,
    auth: { isAuthenticated: false, user: null, error: '' },
    toast: null
  };
}

export function serializeSessionState(state) {
  return {
    auth: state.auth,
    toast: null
  };
}

export function restorePersistentState(savedState, fallback = createInitialState(), sessionState = null) {
  const parsed = typeof savedState === 'string' ? JSON.parse(savedState) : savedState;
  const parsedSession = typeof sessionState === 'string' ? JSON.parse(sessionState) : sessionState;
  return {
    ...fallback,
    ...parsed,
    auth: parsedSession?.auth ?? { isAuthenticated: false, user: null, error: '' },
    toast: null
  };
}

export function getLatestGuideRegistrationDraft(state) {
  return state.drafts.find((draft) => draft.type === 'guide-registration') ?? null;
}

export function getGuideTourDrafts(state) {
  return (state.drafts ?? []).filter((draft) => draft.type === 'tour-draft');
}

const toast = (state, message) => ({ ...state, toast: { id: Date.now(), message } });

export function appReducer(state, action) {
  switch (action.type) {
    case 'EMAIL_AUTH_SUCCESS':
      return toast(
        {
          ...state,
          auth: {
            isAuthenticated: true,
            error: '',
            user: {
              id: action.payload.user.id,
              email: action.payload.user.email,
              name: action.payload.user.displayName ?? action.payload.user.name,
              avatar: action.payload.user.avatar ?? '',
              role: action.payload.user.role ?? 'traveler',
              isGuide: Boolean(action.payload.user.isGuide)
            }
          },
          guideProfile: action.payload.guideProfile ?? state.guideProfile
        },
        'Logged in'
      );
    case 'AUTH_ERROR':
      return { ...state, auth: { isAuthenticated: false, user: null, error: action.payload.message } };
    case 'LOGOUT':
      return toast({ ...state, auth: { isAuthenticated: false, user: null, error: '' }, bookmarks: [] }, 'Logged out');
    case 'UPDATE_USER_PROFILE':
      return toast(
        {
          ...state,
          auth: {
            ...state.auth,
            user: {
              ...state.auth.user,
              ...action.payload,
              avatar: action.payload.avatar || state.auth.user?.avatar || ''
            }
          }
        },
        'Profile updated'
      );
    case 'UPDATE_GUIDE_PROFILE':
      return toast(
        {
          ...state,
          auth: {
            ...state.auth,
            user: {
              ...state.auth.user,
              avatar: action.payload.profilePhotoUrl || state.auth.user?.avatar || ''
            }
          },
          guideProfile: {
            ...(state.guideProfile ?? {}),
            ...action.payload,
            status: state.guideProfile?.status ?? 'pending'
          }
        },
        'Guide profile updated'
      );
    case 'SET_GUIDE_PROFILE':
      return {
        ...state,
        guideProfile: action.payload.guideProfile ?? null
      };
    case 'ADD_GUIDE_UNAVAILABLE_DATES':
      return toast(
        {
          ...state,
          guideUnavailableDates: uniqueSortedDates([
            ...(state.guideUnavailableDates ?? []),
            ...(action.payload.dates ?? [])
          ])
        },
        'Unavailable dates saved'
      );
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    case 'SET_CURRENCY':
      return toast({ ...state, currency: action.payload.currency }, `Currency changed to ${action.payload.currency}`);
    case 'UPDATE_ACCOUNT_SETTINGS': {
      const current = state.accountSettings ?? createDefaultAccountSettings();
      const nextSettings = {
        preferences: { ...current.preferences, ...(action.payload.preferences ?? {}) },
        notifications: { ...current.notifications, ...(action.payload.notifications ?? {}) },
        privacy: { ...current.privacy, ...(action.payload.privacy ?? {}) },
        security: { ...current.security, ...(action.payload.security ?? {}) }
      };
      return toast(
        {
          ...state,
          accountSettings: nextSettings,
          currency: nextSettings.preferences.currency ?? state.currency
        },
        'Account settings saved'
      );
    }
    case 'TOGGLE_BOOKMARK': {
      const exists = state.bookmarks.includes(action.payload.tourId);
      return toast(
        { ...state, bookmarks: exists ? state.bookmarks.filter((id) => id !== action.payload.tourId) : [...state.bookmarks, action.payload.tourId] },
        exists ? 'Removed from saved tours' : 'Saved to bookmarks'
      );
    }
    case 'SET_BOOKMARKS': {
      const tourIds = [];
      (action.payload.tourIds ?? []).forEach((id) => {
        const value = String(id || '').trim();
        if (value && !tourIds.includes(value)) tourIds.push(value);
      });
      return { ...state, bookmarks: tourIds };
    }
    case 'PAY_NOW': {
      const tour = tours.find((item) => item.id === action.payload.tourId);
      const booking = {
        id: `mock${state.bookings.length + 123}`,
        ...action.payload,
        amount: tour?.price ?? 0,
        status: 'reserved'
      };
      const conversation = {
        id: `conv-${tour?.guide.id ?? 'guide'}`,
        type: 'travel',
        guideId: tour?.guide.id,
        guideName: tour?.guide.name ?? 'Guide',
        avatar: tour?.guide.avatar,
        lastMessage: 'A chat with your guide has been opened.',
        messages: [
          { from: 'guide', text: 'A chat with your guide has been opened. Welcome to Local Way!' },
          { from: 'me', text: 'Thanks, looking forward to it.' }
        ]
      };
      return toast({ ...state, bookings: [booking, ...state.bookings], conversations: [conversation, ...state.conversations] }, 'Payment simulation complete');
    }
    case 'SEND_MESSAGE':
      return {
        ...state,
        conversations: state.conversations.map((conv) =>
          conv.id === action.payload.conversationId
            ? { ...conv, lastMessage: action.payload.text, messages: [...conv.messages, { from: 'me', text: action.payload.text }] }
            : conv
        )
      };
    case 'SUBMIT_GUIDE_APPLICATION':
      return toast(
        {
          ...state,
          auth: {
            ...state.auth,
            user: {
              ...state.auth.user,
              role: 'pending-guide',
              avatar: action.payload.profilePhotoUrl || state.auth.user?.avatar || ''
            }
          },
          guideProfile: { ...action.payload, status: 'pending' }
        },
        'Pending admin approval'
      );
    case 'SAVE_GUIDE_DRAFT':
      return toast(
        {
          ...state,
          drafts: [
            { id: action.payload.id ?? `draft-${Date.now()}`, savedAt: new Date().toISOString(), ...action.payload },
            ...state.drafts.filter((draft) => (
              action.payload.type === 'tour-draft'
                ? draft.id !== action.payload.id
                : draft.type !== action.payload.type
            ))
          ]
        },
        'Draft saved'
      );
    case 'PUBLISH_TOUR': {
      const publishedDraftId = action.payload.draftId ?? action.payload.id;
      return toast({ ...state, drafts: state.drafts.filter((draft) => draft.id !== publishedDraftId) }, 'Tour published');
    }
    case 'SUBMIT_SUPPORT':
      return toast({ ...state, inquiries: [{ id: `inq-${Date.now()}`, status: 'Open', ...action.payload }, ...state.inquiries] }, 'Request submitted');
    default:
      return state;
  }
}

export const selectors = {
  guideProfile: (state) => state.guideProfile,
  guideUnavailableDates: (state) => state.guideUnavailableDates ?? [],
  guideRegistrationDraft: getLatestGuideRegistrationDraft,
  guideTourDrafts: getGuideTourDrafts,
  guideTourDraft: (state, id) => getGuideTourDrafts(state).find((draft) => draft.id === id),
  bookmarkedTours: (state) => tours.filter((tour) => state.bookmarks.includes(tour.id)),
  tour: (id) => tours.find((tour) => tour.id === id)
};
