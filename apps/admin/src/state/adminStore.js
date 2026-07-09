const nowText = () => new Date().toLocaleString('ko-KR', { hour12: false });
const makeId = (prefix) => `${prefix}-${Date.now()}`;

export function createInitialState() {
  return {
    auth: { isAuthenticated: false, admin: null, accessToken: '', error: '' },
    toast: null,
    metrics: [],
    dailyBookings: [],
    monthlyRevenue: [],
    guideApplications: [],
    guideProfilesByUserId: {},
    guideProfilesById: {},
    tourDraftsByGuideId: {},
    travelers: [],
    guides: [],
    tours: [],
    reservations: [],
    refunds: [],
    tickets: [],
    settlements: [],
    reviews: [],
    notices: [],
    messageLogs: [],
    settings: { tourTypes: [], languages: [], options: [], admins: [] },
    dataStatus: { guideApplications: 'idle', guideApplicationsError: '' }
  };
}

const withToast = (state, message) => ({ ...state, toast: { id: Date.now(), message } });

const updateById = (items, id, patch) =>
  items.map((item) => (item.id === id ? { ...item, ...patch } : item));

export function adminReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return withToast(
        {
          ...state,
          auth: {
            isAuthenticated: true,
            error: '',
            admin: action.payload.user,
            accessToken: action.payload.accessToken
          }
        },
        '관리자로 로그인되었습니다.'
      );
    case 'LOGIN_ERROR':
      return { ...state, auth: { ...state.auth, isAuthenticated: false, admin: null, accessToken: '', error: action.payload.message } };
    case 'LOGOUT':
      return withToast({ ...state, auth: { isAuthenticated: false, admin: null, accessToken: '', error: '' } }, '로그아웃되었습니다.');
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    case 'LOAD_GUIDE_APPLICATIONS_START':
      return {
        ...state,
        dataStatus: { ...state.dataStatus, guideApplications: 'loading', guideApplicationsError: '' }
      };
    case 'LOAD_GUIDE_APPLICATIONS_SUCCESS':
      return {
        ...state,
        guideApplications: action.payload.applications,
        guideProfilesByUserId: action.payload.guideProfilesByUserId,
        guideProfilesById: action.payload.guideProfilesById,
        tourDraftsByGuideId: action.payload.tourDraftsByGuideId,
        dataStatus: { ...state.dataStatus, guideApplications: 'ready', guideApplicationsError: '' }
      };
    case 'LOAD_GUIDE_APPLICATIONS_ERROR':
      return {
        ...state,
        guideApplications: [],
        guideProfilesByUserId: {},
        guideProfilesById: {},
        tourDraftsByGuideId: {},
        dataStatus: { ...state.dataStatus, guideApplications: 'error', guideApplicationsError: action.payload.message }
      };
    case 'APPROVE_GUIDE':
      return withToast({ ...state, guideApplications: updateById(state.guideApplications, action.payload.id, { status: 'approved' }) }, '가이드가 승인되었습니다.');
    case 'REJECT_GUIDE':
      return withToast(
        { ...state, guideApplications: updateById(state.guideApplications, action.payload.id, { status: 'rejected', rejection_reason: action.payload.reason }) },
        '가이드 신청이 거절되었습니다.'
      );
    case 'BAN_TRAVELER':
      return withToast(
        { ...state, travelers: updateById(state.travelers, action.payload.id, { status: '벤', banHistory: [action.payload.reason] }) },
        '여행객 벤 처리가 완료되었습니다.'
      );
    case 'UNBAN_TRAVELER':
      return withToast({ ...state, travelers: updateById(state.travelers, action.payload.id, { status: '정상' }) }, '여행객 벤이 해제되었습니다.');
    case 'BAN_GUIDE':
      return withToast({ ...state, guides: updateById(state.guides, action.payload.id, { status: '벤', banReason: action.payload.reason }) }, '가이드 벤 처리가 완료되었습니다.');
    case 'SUSPEND_GUIDE':
      return withToast({ ...state, guides: updateById(state.guides, action.payload.id, { status: '일시정지', suspendPeriod: action.payload.period }) }, '가이드가 일시 정지되었습니다.');
    case 'PAUSE_TOUR':
      return withToast({ ...state, tours: updateById(state.tours, action.payload.id, { status: '일시정지', pauseReason: action.payload.reason }) }, '투어가 일시 정지되었습니다.');
    case 'RESUME_TOUR':
      return withToast({ ...state, tours: updateById(state.tours, action.payload.id, { status: '활성', pauseReason: '' }) }, '투어가 재개되었습니다.');
    case 'PROCESS_REFUND':
      return withToast(
        { ...state, refunds: updateById(state.refunds, action.payload.id, { status: action.payload.decision, decisionReason: action.payload.reason }) },
        '환불 요청 상태가 변경되었습니다.'
      );
    case 'ANSWER_TICKET':
      return withToast(
        { ...state, tickets: updateById(state.tickets, action.payload.id, { status: '완료', thread: [...(selectors.ticket(state, action.payload.id)?.thread ?? []), action.payload.body] }) },
        '답변이 전송되었습니다.'
      );
    case 'RUN_SETTLEMENT':
      return withToast(
        { ...state, settlements: state.settlements.map((item) => (action.payload.ids.includes(item.id) ? { ...item, status: '완료' } : item)) },
        '선택한 정산이 완료 처리되었습니다.'
      );
    case 'DELETE_REVIEW':
      return withToast({ ...state, reviews: updateById(state.reviews, action.payload.id, { status: '삭제', deleteReason: action.payload.reason }) }, '후기가 삭제 처리되었습니다.');
    case 'CREATE_NOTICE':
      return withToast(
        {
          ...state,
          notices: [{ id: makeId('notice'), createdAt: new Date().toISOString().slice(0, 10), ...action.payload }, ...state.notices]
        },
        '공지사항이 등록되었습니다.'
      );
    case 'DELETE_NOTICE':
      return withToast({ ...state, notices: state.notices.filter((item) => item.id !== action.payload.id) }, '공지사항이 삭제되었습니다.');
    case 'SEND_MESSAGE':
      return withToast(
        {
          ...state,
          messageLogs: [{ id: makeId('msg'), sentAt: nowText(), ...action.payload }, ...state.messageLogs]
        },
        '메시지가 발송되었습니다.'
      );
    case 'TOGGLE_SETTING':
      return withToast(
        {
          ...state,
          settings: {
            ...state.settings,
            [action.payload.group]: state.settings[action.payload.group].map((item) =>
              item.id === action.payload.id ? { ...item, active: !item.active } : item
            )
          }
        },
        '설정이 변경되었습니다.'
      );
    case 'ADD_SETTING':
      return withToast(
        {
          ...state,
          settings: {
            ...state.settings,
            [action.payload.group]: [{ id: makeId(action.payload.group), name: action.payload.name, active: true }, ...state.settings[action.payload.group]]
          }
        },
        '항목이 추가되었습니다.'
      );
    default:
      return state;
  }
}

export const selectors = {
  guideApplication: (state, id) => state.guideApplications.find((item) => item.id === id),
  traveler: (state, id) => state.travelers.find((item) => item.id === id),
  guide: (state, id) => state.guides.find((item) => item.id === id),
  tour: (state, id) => state.tours.find((item) => item.id === id),
  refund: (state, id) => state.refunds.find((item) => item.id === id),
  ticket: (state, id) => state.tickets.find((item) => item.id === id),
  settlement: (state, id) => state.settlements.find((item) => item.id === id)
};
