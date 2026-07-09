import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Ban, Check, Eye, Pause, Play, Plus, Send, Trash2 } from 'lucide-react';
import { DataTable } from '../components/DataTable.jsx';
import { Modal } from '../components/Modal.jsx';
import { useAdmin } from '../state/AdminContext.jsx';
import {
  approveGuideApplication,
  createGuideVerificationSignedUrl,
  createSupabaseRestClient,
  fetchPendingGuideApplications,
  getSupabaseAdminConfig,
  rejectGuideApplication
} from '../lib/guideApplicationsApi.js';
import {
  createNotice,
  createPlatformSetting,
  deleteNotice,
  fetchAdminMembers,
  fetchAdminReviews,
  fetchAdminTours,
  fetchNotices,
  fetchPlatformSettings,
  fetchSupportTickets,
  replyToSupportTicket,
  updateReviewStatus,
  updateTourStatus
} from '../lib/adminDataApi.js';

const money = (value) => `${value.toLocaleString('ko-KR')}원`;
const badgeClass = (value) => `badge ${['대기', '열림', '처리중', 'pending'].includes(value) ? 'warn' : ['벤', '거절', '삭제', 'rejected'].includes(value) ? 'danger' : 'ok'}`;
const statusLabel = (value) => ({ pending: '대기', approved: '승인', rejected: '거절' })[value] ?? value;
const fieldValue = (value) => Array.isArray(value) ? value.join(', ') : value || '-';

function StatusBadge({ value }) {
  return <span className={badgeClass(value)}>{statusLabel(value)}</span>;
}

function ActionButton({ icon: Icon, children, onClick, tone = 'ghost' }) {
  return <button className={`${tone}-button compact`} type="button" onClick={(event) => { event.stopPropagation(); onClick?.(); }}><Icon size={16} />{children}</button>;
}

function ReasonModal({ title, label = '사유', onSubmit, onClose, options }) {
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState(options?.[0] ?? '');
  return (
    <Modal title={title} onClose={onClose}>
      <form className="stack" onSubmit={(event) => { event.preventDefault(); onSubmit(reason || '관리자 처리', decision); onClose(); }}>
        {options && <label>처리 결과<select value={decision} onChange={(event) => setDecision(event.target.value)}>{options.map((item) => <option key={item}>{item}</option>)}</select></label>}
        <label>{label}<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="관리 메모를 입력하세요" /></label>
        <button className="primary-button" type="submit">처리하기</button>
      </form>
    </Modal>
  );
}

export function DashboardHome() {
  const { state } = useAdmin();
  return (
    <div className="page-grid">
      <section className="metric-grid">
        {state.metrics.map((item) => <article className="metric-card" key={item.label}><p>{item.label}</p><strong>{item.value}</strong><span>{item.delta}</span></article>)}
      </section>
      <section className="panel chart-panel">
        <h2>최근 7일간 일별 예약 수</h2>
        <ResponsiveContainer width="100%" height={260}><BarChart data={state.dailyBookings}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Bar dataKey="bookings" fill="#ea5c2a" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>
      </section>
      <section className="panel chart-panel">
        <h2>월별 매출 추이</h2>
        <ResponsiveContainer width="100%" height={260}><LineChart data={state.monthlyRevenue}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} /></LineChart></ResponsiveContainer>
      </section>
    </div>
  );
}

export function GuideApproval() {
  const { state, dispatch } = useAdmin();
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const config = getSupabaseAdminConfig();
  const client = useMemo(() => createSupabaseRestClient({ ...config, accessToken: state.auth.accessToken }), [config.url, config.publishableKey, state.auth.accessToken]);
  const rows = filter === 'all' ? state.guideApplications : state.guideApplications.filter((item) => item.status === filter);

  useEffect(() => {
    let active = true;
    dispatch({ type: 'LOAD_GUIDE_APPLICATIONS_START' });
    fetchPendingGuideApplications(client)
      .then((payload) => {
        if (active) dispatch({ type: 'LOAD_GUIDE_APPLICATIONS_SUCCESS', payload });
      })
      .catch((error) => {
        if (active) dispatch({ type: 'LOAD_GUIDE_APPLICATIONS_ERROR', payload: { message: error.message } });
      });
    return () => {
      active = false;
    };
  }, [client, dispatch]);

  async function approve(application) {
    try {
      const updated = await approveGuideApplication(client, application, state.auth.admin?.id);
      dispatch({ type: 'APPROVE_GUIDE', payload: { id: updated.id } });
    } catch (error) {
      dispatch({ type: 'LOAD_GUIDE_APPLICATIONS_ERROR', payload: { message: error.message } });
    }
  }

  async function reject(application, reason) {
    try {
      const updated = await rejectGuideApplication(client, application, reason, state.auth.admin?.id);
      dispatch({ type: 'REJECT_GUIDE', payload: { id: updated.id, reason } });
    } catch (error) {
      dispatch({ type: 'LOAD_GUIDE_APPLICATIONS_ERROR', payload: { message: error.message } });
    }
  }

  return (
    <>
      {!config.isConfigured && <section className="panel notice-panel"><h2>연결된 Supabase 설정이 없습니다</h2><p>실제 backend 데이터만 표시하도록 구성되어 있어 현재는 빈 상태로 표시됩니다.</p></section>}
      {state.dataStatus.guideApplications === 'error' && <section className="panel notice-panel"><h2>신청 데이터를 불러오지 못했습니다</h2><p>{state.dataStatus.guideApplicationsError}</p></section>}
      <DataTable rows={rows} searchPlaceholder="가이드 이름, 도시, 언어 검색" filters={<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="pending">대기</option><option value="all">전체</option><option value="approved">승인</option><option value="rejected">거절</option></select>} columns={[
        { key: 'submitted_at', label: '신청일', sortable: true, render: (row) => row.submitted_at ? new Date(row.submitted_at).toLocaleDateString('ko-KR') : '-' },
        { key: 'real_name', label: '가이드 이름', sortable: true },
        { key: 'city', label: '거주 도시', sortable: true },
        { key: 'nationality', label: '국적', sortable: true },
        { key: 'native_language', label: '모국어', sortable: true },
        { key: 'additional_languages', label: '추가 언어', sortable: true, render: (row) => fieldValue(row.additional_languages) },
        { key: 'status', label: '상태', sortable: true, render: (row) => <StatusBadge value={row.status} /> },
        { key: 'actions', label: '관리', render: (row) => <div className="row-actions"><ActionButton icon={Eye} onClick={() => setSelected(row)}>상세</ActionButton><ActionButton icon={Check} tone="primary" onClick={() => approve(row)}>승인</ActionButton><ActionButton icon={Ban} onClick={() => setRejecting(row)}>거절</ActionButton></div> }
      ]} />
      {selected && <GuideApplicationDetail application={selected} client={client} state={state} onClose={() => setSelected(null)} />}
      {rejecting && <ReasonModal title="가이드 신청 거절" onClose={() => setRejecting(null)} onSubmit={(reason) => reject(rejecting, reason)} />}
    </>
  );
}

function GuideApplicationDetail({ application, client, state, onClose }) {
  const [imageUrls, setImageUrls] = useState({ profile: '', idDocument: '', error: '' });
  const guideProfile = state.guideProfilesByUserId[application.user_id];
  const tourDrafts = guideProfile ? state.tourDraftsByGuideId[guideProfile.id] ?? [] : [];
  const profileRows = [
    ['이름', application.real_name],
    ['국적', application.nationality],
    ['나이 대신 생년월일', application.birth_date],
    ['성별', application.gender],
    ['거주 도시', application.city],
    ['거주 기간', `${application.residence_years ?? 0}년`],
    ['모국어', application.native_language],
    ['추가 언어', application.additional_languages],
    ['소개', application.intro]
  ];

  useEffect(() => {
    let active = true;
    setImageUrls({ profile: '', idDocument: '', error: '' });
    Promise.all([
      createGuideVerificationSignedUrl(client, application.profile_image_path),
      createGuideVerificationSignedUrl(client, application.id_document_image_path)
    ])
      .then(([profile, idDocument]) => {
        if (active) setImageUrls({ profile, idDocument, error: '' });
      })
      .catch((error) => {
        if (active) setImageUrls({ profile: '', idDocument: '', error: error.message });
      });
    return () => {
      active = false;
    };
  }, [application.id, application.profile_image_path, application.id_document_image_path, client]);

  return (
    <Modal title="Pending Guide Application" onClose={onClose} wide>
      <div className="application-detail">
        <section className="panel flat-panel">
          <h3>Guide Profile</h3>
          <div className="verification-image-grid">
            <VerificationImage title="프로필 이미지" src={imageUrls.profile} path={application.profile_image_path} />
            <VerificationImage title="신분증 이미지" src={imageUrls.idDocument} path={application.id_document_image_path} />
          </div>
          {imageUrls.error && <p className="form-error">{imageUrls.error}</p>}
          <dl className="info-list">{profileRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{fieldValue(value)}</dd></div>)}</dl>
        </section>
        <section className="panel flat-panel">
          <h3>Tour Drafts</h3>
          {tourDrafts.length ? <div className="draft-list">{tourDrafts.map((draft) => <article key={draft.id}><b>{draft.title || 'Untitled tour draft'}</b><span>{draft.updated_at ? new Date(draft.updated_at).toLocaleString('ko-KR') : '-'}</span><p>{fieldValue(draft.payload?.description || draft.payload?.contentHtml)}</p></article>)}</div> : <p className="empty-text">저장된 투어 초안이 없습니다.</p>}
        </section>
      </div>
    </Modal>
  );
}

function VerificationImage({ title, src, path }) {
  return (
    <figure className="verification-image-card">
      <figcaption>{title}</figcaption>
      {src ? <img src={src} alt={title} /> : <div className="verification-image-empty">이미지를 불러오는 중입니다.</div>}
      <small>{path || '-'}</small>
    </figure>
  );
}

export function MemberManagement() {
  const { state, dispatch } = useAdmin();
  const [tab, setTab] = useState('travelers');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [remoteMembers, setRemoteMembers] = useState({ travelers: [], guides: [] });
  const config = getSupabaseAdminConfig();
  const client = useMemo(() => createSupabaseRestClient({ ...config, accessToken: state.auth.accessToken }), [config.url, config.publishableKey, state.auth.accessToken]);
  const isTraveler = tab === 'travelers';
  useEffect(() => {
    let active = true;
    fetchAdminMembers(client)
      .then((members) => { if (active) setRemoteMembers(members); })
      .catch(() => { if (active) setRemoteMembers({ travelers: [], guides: [] }); });
    return () => {
      active = false;
    };
  }, [client]);
  const rows = isTraveler ? (remoteMembers.travelers.length ? remoteMembers.travelers : state.travelers) : (remoteMembers.guides.length ? remoteMembers.guides : state.guides);
  const columns = isTraveler ? [
    { key: 'name', label: '이름', sortable: true }, { key: 'email', label: '이메일', sortable: true }, { key: 'joinedAt', label: '가입일', sortable: true },
    { key: 'bookings', label: '총 예약 수', sortable: true }, { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'actions', label: '관리', render: (row) => <div className="row-actions"><ActionButton icon={Eye} onClick={() => setSelected(row)}>상세</ActionButton><ActionButton icon={Ban} onClick={() => setAction({ type: row.status === '벤' ? 'UNBAN_TRAVELER' : 'BAN_TRAVELER', row })}>{row.status === '벤' ? '해제' : '벤'}</ActionButton></div> }
  ] : [
    { key: 'name', label: '이름', sortable: true }, { key: 'city', label: '거주 도시', sortable: true }, { key: 'rating', label: '평점', sortable: true }, { key: 'tours', label: '등록 투어 수', sortable: true },
    { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'actions', label: '관리', render: (row) => <div className="row-actions"><ActionButton icon={Eye} onClick={() => setSelected(row)}>상세</ActionButton><ActionButton icon={Ban} onClick={() => setAction({ type: 'BAN_GUIDE', row })}>벤</ActionButton><ActionButton icon={Pause} onClick={() => setAction({ type: 'SUSPEND_GUIDE', row })}>정지</ActionButton><ActionButton icon={Send} tone="primary" onClick={() => dispatch({ type: 'SEND_MESSAGE', payload: { target: row.name, title: '개별 안내', body: '관리자 메시지입니다.' } })}>메시지</ActionButton></div> }
  ];
  return (
    <>
      <div className="tabs"><button className={isTraveler ? 'active' : ''} onClick={() => setTab('travelers')}>여행객</button><button className={!isTraveler ? 'active' : ''} onClick={() => setTab('guides')}>가이드</button></div>
      <DataTable rows={rows} columns={columns} searchPlaceholder="회원 검색" />
      {selected && <Modal title="회원 상세" onClose={() => setSelected(null)} wide><div className="stack"><h3>{selected.name}</h3><p>{selected.profile ?? selected.email}</p><p>{selected.settlement ?? `예약 이력: ${selected.history?.join(', ')}`}</p><p>후기: {selected.reviews?.join(', ') ?? '등록 투어 리스트와 정산 정보를 확인할 수 있습니다.'}</p></div></Modal>}
      {action && <ReasonModal title="회원 상태 변경" label={action.type === 'SUSPEND_GUIDE' ? '정지 기간 또는 사유' : '사유'} onClose={() => setAction(null)} onSubmit={(reason) => dispatch({ type: action.type, payload: { id: action.row.id, reason, period: reason } })} />}
    </>
  );
}

export function TourManagement() {
  const { state, dispatch } = useAdmin();
  const [city, setCity] = useState('전체');
  const [selected, setSelected] = useState(null);
  const [pause, setPause] = useState(null);
  const [remoteTours, setRemoteTours] = useState([]);
  const config = getSupabaseAdminConfig();
  const client = useMemo(() => createSupabaseRestClient({ ...config, accessToken: state.auth.accessToken }), [config.url, config.publishableKey, state.auth.accessToken]);
  useEffect(() => {
    let active = true;
    fetchAdminTours(client)
      .then((items) => { if (active) setRemoteTours(items); })
      .catch(() => { if (active) setRemoteTours([]); });
    return () => {
      active = false;
    };
  }, [client]);
  const tourRows = remoteTours.length ? remoteTours : state.tours;
  const rows = city === '전체' ? tourRows : tourRows.filter((item) => item.city === city || item.type === city || item.status === city);
  const pauseTour = async (tour, reason) => {
    try {
      await updateTourStatus(client, { tourId: tour.id, status: 'paused' });
      setRemoteTours((items) => items.map((item) => item.id === tour.id ? { ...item, status: 'paused', pauseReason: reason } : item));
    } catch {}
    dispatch({ type: 'PAUSE_TOUR', payload: { id: tour.id, reason } });
  };
  const resumeTour = async (tour) => {
    try {
      await updateTourStatus(client, { tourId: tour.id, status: 'active' });
      setRemoteTours((items) => items.map((item) => item.id === tour.id ? { ...item, status: 'active', pauseReason: '' } : item));
    } catch {}
    dispatch({ type: 'RESUME_TOUR', payload: { id: tour.id } });
  };
  return (
    <>
      <DataTable rows={rows} searchPlaceholder="투어, 도시, 가이드 검색" filters={<select value={city} onChange={(event) => setCity(event.target.value)}>{['전체', '서울', '부산', '제주', '문화', '미식', '자연', '활성', '일시정지'].map((item) => <option key={item}>{item}</option>)}</select>} columns={[
        { key: 'thumbnail', label: '썸네일', render: (row) => <img className="thumb" src={row.thumbnail} alt="" /> }, { key: 'title', label: '제목', sortable: true }, { key: 'guide', label: '가이드', sortable: true }, { key: 'city', label: '도시', sortable: true },
        { key: 'createdAt', label: '등록일', sortable: true }, { key: 'bookings', label: '예약 건수', sortable: true }, { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> },
        { key: 'actions', label: '관리', render: (row) => <div className="row-actions"><ActionButton icon={Eye} onClick={() => setSelected(row)}>상세</ActionButton>{['활성', 'active'].includes(row.status) ? <ActionButton icon={Pause} onClick={() => setPause(row)}>정지</ActionButton> : <ActionButton icon={Play} tone="primary" onClick={() => resumeTour(row)}>재개</ActionButton>}</div> }
      ]} />
      {selected && <Modal title="투어 상세" onClose={() => setSelected(null)} wide><div className="detail-grid"><img src={selected.thumbnail} alt="" /><div><h3>{selected.title}</h3><p>{selected.description}</p><p>{selected.price} · {selected.options}</p></div></div></Modal>}
      {pause && <ReasonModal title="투어 일시 정지" onClose={() => setPause(null)} onSubmit={(reason) => pauseTour(pause, reason)} />}
    </>
  );
}

export function BookingPayments() {
  const { state, dispatch } = useAdmin();
  const [tab, setTab] = useState('bookings');
  const [selected, setSelected] = useState(null);
  const [refund, setRefund] = useState(null);
  return (
    <>
      <div className="tabs"><button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}>예약 내역</button><button className={tab === 'refunds' ? 'active' : ''} onClick={() => setTab('refunds')}>환불 요청</button></div>
      {tab === 'bookings' ? <DataTable rows={state.reservations} searchPlaceholder="예약 검색" columns={[
        { key: 'id', label: '예약 ID', sortable: true }, { key: 'traveler', label: '여행객', sortable: true }, { key: 'guide', label: '가이드', sortable: true }, { key: 'tour', label: '투어명', sortable: true }, { key: 'date', label: '날짜', sortable: true }, { key: 'amount', label: '금액', render: (row) => money(row.amount) }, { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> }, { key: 'actions', label: '관리', render: (row) => <ActionButton icon={Eye} onClick={() => setSelected(row)}>상세</ActionButton> }
      ]} /> : <DataTable rows={state.refunds} searchPlaceholder="환불 검색" columns={[
        { key: 'reservationId', label: '예약 ID', sortable: true }, { key: 'requester', label: '요청자', sortable: true }, { key: 'reason', label: '사유', sortable: true }, { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> }, { key: 'actions', label: '처리', render: (row) => <ActionButton icon={Check} tone="primary" onClick={() => setRefund(row)}>처리</ActionButton> }
      ]} />}
      {selected && <Modal title="예약 상세" onClose={() => setSelected(null)}><div className="stack"><p>{selected.tour}</p><p>{selected.traveler} / {selected.guide}</p><p>채팅: {selected.chat.join(' · ')}</p></div></Modal>}
      {refund && <ReasonModal title="환불 처리" options={['완료', '거절', '처리중']} onClose={() => setRefund(null)} onSubmit={(reason, decision) => dispatch({ type: 'PROCESS_REFUND', payload: { id: refund.id, decision, reason } })} />}
    </>
  );
}

export function SupportTickets() {
  const { state, dispatch } = useAdmin();
  const [remoteTickets, setRemoteTickets] = useState([]);
  const [selected, setSelected] = useState(state.tickets[0]);
  const [body, setBody] = useState('');
  const config = getSupabaseAdminConfig();
  const client = useMemo(() => createSupabaseRestClient({ ...config, accessToken: state.auth.accessToken }), [config.url, config.publishableKey, state.auth.accessToken]);
  useEffect(() => {
    let active = true;
    fetchSupportTickets(client)
      .then((items) => {
        if (!active) return;
        const rows = items.map((item) => ({
          ...item,
          title: item.subject,
          author: item.profiles?.display_name || item.profiles?.email || '-',
          createdAt: item.created_at,
          thread: [item.description, item.admin_reply].filter(Boolean)
        }));
        setRemoteTickets(rows);
        setSelected((current) => current ?? rows[0]);
      })
      .catch(() => { if (active) setRemoteTickets([]); });
    return () => {
      active = false;
    };
  }, [client]);
  const rows = remoteTickets.length ? remoteTickets : state.tickets;
  const answerTicket = async () => {
    if (!selected) return;
    const reply = body || '확인 후 처리 완료했습니다.';
    try {
      await replyToSupportTicket(client, { ticketId: selected.id, reply });
      setRemoteTickets((items) => items.map((item) => item.id === selected.id ? { ...item, status: 'closed', admin_reply: reply, thread: [...(item.thread ?? []), reply] } : item));
    } catch {}
    dispatch({ type: 'ANSWER_TICKET', payload: { id: selected.id, body: reply } });
    setBody('');
  };
  return (
    <div className="split-view">
      <DataTable rows={rows} searchPlaceholder="티켓 검색" onRowClick={setSelected} columns={[
        { key: 'id', label: '티켓 번호', sortable: true }, { key: 'title', label: '제목', sortable: true }, { key: 'author', label: '작성자', sortable: true }, { key: 'createdAt', label: '등록일', sortable: true }, { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> }
      ]} />
      {selected && <aside className="conversation panel"><h2>{selected.title}</h2>{(selected.thread ?? []).map((line, index) => <p key={index}>{line}</p>)}<textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="답변 입력" /><button className="primary-button" onClick={answerTicket}>전송</button></aside>}
    </div>
  );
}

export function RevenueSettlements() {
  const { state, dispatch } = useAdmin();
  const [checked, setChecked] = useState([]);
  const pending = state.settlements.filter((item) => item.status !== '완료');
  const done = state.settlements.filter((item) => item.status === '완료');
  const totalRevenue = state.reservations.reduce((sum, item) => sum + (item.amount || 0), 0);
  const unsettled = pending.reduce((sum, item) => sum + item.amount, 0);
  return (
    <div className="page-grid">
      <section className="metric-grid"><article className="metric-card"><p>총 매출</p><strong>{money(totalRevenue)}</strong></article><article className="metric-card"><p>순수익</p><strong>{money(0)}</strong></article><article className="metric-card"><p>미정산 금액</p><strong>{money(unsettled)}</strong></article></section>
      <DataTable rows={pending} actions={<button className="primary-button compact" onClick={() => dispatch({ type: 'RUN_SETTLEMENT', payload: { ids: checked } })}>선택 정산 실행</button>} columns={[
        { key: 'check', label: '선택', render: (row) => <input type="checkbox" checked={checked.includes(row.id)} onChange={(event) => setChecked((prev) => event.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id))} /> },
        { key: 'guide', label: '가이드', sortable: true }, { key: 'amount', label: '정산 예정 금액', render: (row) => money(row.amount) }, { key: 'cycle', label: '정산 주기', sortable: true }, { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> }
      ]} />
      <DataTable rows={done} searchPlaceholder="정산 완료 검색" columns={[{ key: 'guide', label: '가이드', sortable: true }, { key: 'amount', label: '정산 완료 금액', render: (row) => money(row.amount) }, { key: 'cycle', label: '주기' }, { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> }]} />
    </div>
  );
}

export function ReviewManagement() {
  const { state, dispatch } = useAdmin();
  const [mode, setMode] = useState('전체');
  const [target, setTarget] = useState(null);
  const [remoteReviews, setRemoteReviews] = useState([]);
  const config = getSupabaseAdminConfig();
  const client = useMemo(() => createSupabaseRestClient({ ...config, accessToken: state.auth.accessToken }), [config.url, config.publishableKey, state.auth.accessToken]);
  useEffect(() => {
    let active = true;
    fetchAdminReviews(client)
      .then((items) => {
        if (!active) return;
        setRemoteReviews(items.map((item) => ({
          ...item,
          content: item.content,
          author: item.profiles?.display_name || '-',
          tour: item.tours?.title || '-',
          reports: item.reports ?? 0
        })));
      })
      .catch(() => { if (active) setRemoteReviews([]); });
    return () => {
      active = false;
    };
  }, [client]);
  const reviewRows = remoteReviews.length ? remoteReviews : state.reviews;
  const rows = useMemo(() => {
    if (mode === '신고') return reviewRows.filter((item) => item.reports > 0);
    if (mode === '낮은별점') return [...reviewRows].sort((a, b) => a.rating - b.rating);
    return reviewRows;
  }, [mode, reviewRows]);
  const deleteReview = async (review, reason) => {
    try {
      await updateReviewStatus(client, { reviewId: review.id, status: 'deleted' });
      setRemoteReviews((items) => items.map((item) => item.id === review.id ? { ...item, status: 'deleted', deleteReason: reason } : item));
    } catch {}
    dispatch({ type: 'DELETE_REVIEW', payload: { id: review.id, reason } });
  };
  return (
    <>
      <DataTable rows={rows} filters={<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="전체">전체</option><option value="신고">신고된 후기만</option><option value="낮은별점">별점 낮은 순</option></select>} columns={[
        { key: 'rating', label: '별점', sortable: true, render: (row) => `${row.rating}점` }, { key: 'content', label: '내용 일부', sortable: true }, { key: 'author', label: '작성자', sortable: true }, { key: 'tour', label: '대상 투어', sortable: true }, { key: 'reports', label: '신고 수', sortable: true }, { key: 'status', label: '상태', render: (row) => <StatusBadge value={row.status} /> }, { key: 'actions', label: '관리', render: (row) => <ActionButton icon={Trash2} onClick={() => setTarget(row)}>삭제</ActionButton> }
      ]} />
      {target && <ReasonModal title="후기 삭제" onClose={() => setTarget(null)} onSubmit={(reason) => deleteReview(target, reason)} />}
    </>
  );
}

export function NoticeManagement() {
  const { state, dispatch } = useAdmin();
  const [open, setOpen] = useState(false);
  const [remoteNotices, setRemoteNotices] = useState([]);
  const config = getSupabaseAdminConfig();
  const client = useMemo(() => createSupabaseRestClient({ ...config, accessToken: state.auth.accessToken }), [config.url, config.publishableKey, state.auth.accessToken]);
  useEffect(() => {
    let active = true;
    fetchNotices(client)
      .then((items) => {
        if (active) setRemoteNotices(items.map((item) => ({ ...item, createdAt: item.created_at, isPublic: item.is_public })));
      })
      .catch(() => { if (active) setRemoteNotices([]); });
    return () => {
      active = false;
    };
  }, [client]);
  const rows = remoteNotices.length ? remoteNotices : state.notices;
  const removeNotice = async (notice) => {
    try {
      await deleteNotice(client, notice.id);
      setRemoteNotices((items) => items.filter((item) => item.id !== notice.id));
    } catch {}
    dispatch({ type: 'DELETE_NOTICE', payload: { id: notice.id } });
  };
  return (
    <>
      <DataTable rows={rows} actions={<button className="primary-button compact" onClick={() => setOpen(true)}><Plus size={16} />새 공지 작성</button>} columns={[
        { key: 'title', label: '제목', sortable: true }, { key: 'createdAt', label: '작성일', sortable: true }, { key: 'isPublic', label: '공개 여부', render: (row) => row.isPublic ? '공개' : '비공개' }, { key: 'actions', label: '관리', render: (row) => <ActionButton icon={Trash2} onClick={() => removeNotice(row)}>삭제</ActionButton> }
      ]} />
      {open && <NoticeForm client={client} adminId={state.auth.admin?.id} onCreated={(notice) => setRemoteNotices((items) => [{ ...notice, createdAt: notice.created_at, isPublic: notice.is_public }, ...items])} onClose={() => setOpen(false)} />}
    </>
  );
}

function NoticeForm({ client, adminId, onCreated, onClose }) {
  const { dispatch } = useAdmin();
  return <Modal title="새 공지 작성" onClose={onClose}><form className="stack" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const payload = { title: form.get('title'), content: form.get('content'), isPublic: form.get('isPublic') === 'on' }; try { const notice = await createNotice(client, { adminId, payload }); if (notice) onCreated?.(notice); } catch {} dispatch({ type: 'CREATE_NOTICE', payload }); onClose(); }}><label>제목<input name="title" required /></label><label>내용<textarea name="content" required /></label><label className="check-line"><input name="isPublic" type="checkbox" defaultChecked /> 공개</label><button className="primary-button">등록</button></form></Modal>;
}

export function GuideMessages() {
  const { state, dispatch } = useAdmin();
  return (
    <div className="page-grid">
      <section className="panel">
        <h2>메시지 발송</h2>
        <form className="stack" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); dispatch({ type: 'SEND_MESSAGE', payload: { target: form.get('target'), title: form.get('title'), body: form.get('body') } }); event.currentTarget.reset(); }}>
          <label>수신 대상<select name="target"><option>전체 가이드</option>{state.guides.map((guide) => <option key={guide.id}>{guide.name}</option>)}</select></label>
          <label>제목<input name="title" required /></label>
          <label>내용<textarea name="body" required /></label>
          <button className="primary-button" type="submit"><Send size={17} />발송</button>
        </form>
      </section>
      <DataTable rows={state.messageLogs} searchPlaceholder="발송 로그 검색" columns={[{ key: 'sentAt', label: '발송일', sortable: true }, { key: 'target', label: '대상', sortable: true }, { key: 'title', label: '제목', sortable: true }, { key: 'body', label: '내용' }]} />
    </div>
  );
}

export function SystemSettings() {
  const { state, dispatch } = useAdmin();
  const [remoteSettings, setRemoteSettings] = useState({ tourTypes: [], languages: [], options: [], admins: [] });
  const config = getSupabaseAdminConfig();
  const client = useMemo(() => createSupabaseRestClient({ ...config, accessToken: state.auth.accessToken }), [config.url, config.publishableKey, state.auth.accessToken]);
  useEffect(() => {
    let active = true;
    fetchPlatformSettings(client)
      .then((items) => {
        if (!active) return;
        const grouped = { tourTypes: [], languages: [], options: [], admins: [] };
        items.forEach((item) => {
          const key = item.group_key === 'tour_types' ? 'tourTypes' : item.group_key;
          if (grouped[key]) grouped[key].push({ id: item.id, name: item.name, active: item.active });
        });
        setRemoteSettings(grouped);
      })
      .catch(() => { if (active) setRemoteSettings({ tourTypes: [], languages: [], options: [], admins: [] }); });
    return () => {
      active = false;
    };
  }, [client]);
  const groups = [
    ['tourTypes', '투어 유형'],
    ['languages', '언어 목록'],
    ['options', '옵션 항목']
  ];
  const settings = Object.values(remoteSettings).some((items) => items.length) ? remoteSettings : state.settings;
  return (
    <div className="settings-grid">
      {groups.map(([key, label]) => <SettingPanel key={key} group={key} label={label} items={settings[key]} dispatch={dispatch} client={client} onCreated={(item) => setRemoteSettings((current) => ({ ...current, [key]: [{ id: item.id, name: item.name, active: item.active }, ...(current[key] ?? [])] }))} />)}
      <section className="panel"><h2>관리자 계정</h2>{settings.admins.map((admin) => <div className="setting-row" key={admin.id}><span>{admin.name}</span><b>{admin.role}</b></div>)}<button className="ghost-button compact"><Plus size={16} />계정 추가</button></section>
    </div>
  );
}

function SettingPanel({ group, label, items, dispatch, client, onCreated }) {
  const [name, setName] = useState('');
  const groupKey = group === 'tourTypes' ? 'tour_types' : group;
  return (
    <section className="panel">
      <h2>{label}</h2>
      {items.map((item) => <div className="setting-row" key={item.id}><span>{item.name}</span><button className="ghost-button compact" onClick={() => dispatch({ type: 'TOGGLE_SETTING', payload: { group, id: item.id } })}>{item.active ? '활성' : '비활성'}</button></div>)}
      <form className="inline-form" onSubmit={async (event) => { event.preventDefault(); if (name.trim()) { try { const created = await createPlatformSetting(client, { group: groupKey, name }); if (created) onCreated?.(created); } catch {} dispatch({ type: 'ADD_SETTING', payload: { group, name } }); } setName(''); }}>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={`${label} 추가`} />
        <button className="primary-button compact" type="submit"><Plus size={16} />추가</button>
      </form>
    </section>
  );
}
