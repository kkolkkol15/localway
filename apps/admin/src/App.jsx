import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, CalendarCheck, ChartNoAxesCombined, CreditCard, Home, LogOut, Megaphone, Menu,
  MessageSquareText, PackageSearch, Settings, ShieldCheck, Star, Users
} from 'lucide-react';
import { useAdmin } from './state/AdminContext.jsx';
import { getSupabaseAdminConfig, signInAdminWithPassword } from './lib/guideApplicationsApi.js';
import { Toast } from './components/Toast.jsx';
import {
  DashboardHome, GuideApproval, MemberManagement, TourManagement, BookingPayments,
  SupportTickets, RevenueSettlements, ReviewManagement, NoticeManagement,
  GuideMessages, SystemSettings
} from './pages/AdminPages.jsx';

const menus = [
  { path: '/admin', label: '대시보드 홈', icon: Home },
  { path: '/admin/guides', label: '가이드 승인', icon: ShieldCheck },
  { path: '/admin/members', label: '회원 관리', icon: Users },
  { path: '/admin/tours', label: '투어 상품 관리', icon: PackageSearch },
  { path: '/admin/bookings', label: '예약/결제 관리', icon: CreditCard },
  { path: '/admin/tickets', label: '고객센터 티켓', icon: MessageSquareText },
  { path: '/admin/revenue', label: '매출/정산', icon: ChartNoAxesCombined },
  { path: '/admin/reviews', label: '후기 관리', icon: Star },
  { path: '/admin/notices', label: '공지사항 관리', icon: Megaphone },
  { path: '/admin/messages', label: '메시지 발송', icon: CalendarCheck },
  { path: '/admin/settings', label: '시스템 설정', icon: Settings }
];

function LoginPage() {
  const { state, dispatch } = useAdmin();
  const navigate = useNavigate();
  const loginConfig = getSupabaseAdminConfig();

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const session = await signInAdminWithPassword({
        email: form.get('username'),
        password: form.get('password')
      });
      dispatch({ type: 'LOGIN_SUCCESS', payload: session });
      navigate('/admin');
    } catch (error) {
      dispatch({ type: 'LOGIN_ERROR', payload: { message: error.message } });
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Local Way Admin</p>
        <h1>관리자 로그인</h1>
        <form onSubmit={submit}>
          <label>아이디<input name="username" autoComplete="username" placeholder="admin account email" /></label>
          <label>비밀번호<input name="password" type="password" autoComplete="current-password" /></label>
          {!loginConfig.isConfigured && <p className="form-error">Supabase 환경변수가 설정되어 있지 않습니다.</p>}
          {state.auth.error && <p className="form-error">{state.auth.error}</p>}
          <button className="primary-button" type="submit">로그인</button>
        </form>
      </section>
      <Toast />
    </main>
  );
}

function Protected({ children }) {
  const { state } = useAdmin();
  if (!state.auth.isAuthenticated) return <Navigate to="/admin/login" replace />;
  return children;
}

function AdminLayout() {
  const { state, dispatch } = useAdmin();
  const location = useLocation();
  const navigate = useNavigate();

  const current = menus.find((item) => item.path === location.pathname) ?? menus[0];

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">Local Way</div>
        <nav>
          {menus.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.path} className={location.pathname === item.path ? 'active' : ''} type="button" onClick={() => navigate(item.path)}>
                <Icon size={19} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">관리자 콘솔</p>
            <h1>{current.label}</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button" type="button" aria-label="알림"><Bell size={20} /></button>
            <span>{state.auth.admin?.name}</span>
            <button className="ghost-button" type="button" onClick={() => dispatch({ type: 'LOGOUT' })}>
              <LogOut size={17} /> 로그아웃
            </button>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route index element={<DashboardHome />} />
            <Route path="guides" element={<GuideApproval />} />
            <Route path="members" element={<MemberManagement />} />
            <Route path="tours" element={<TourManagement />} />
            <Route path="bookings" element={<BookingPayments />} />
            <Route path="tickets" element={<SupportTickets />} />
            <Route path="revenue" element={<RevenueSettlements />} />
            <Route path="reviews" element={<ReviewManagement />} />
            <Route path="notices" element={<NoticeManagement />} />
            <Route path="messages" element={<GuideMessages />} />
            <Route path="settings" element={<SystemSettings />} />
          </Routes>
        </main>
      </div>
      <nav className="mobile-tabs">
        {menus.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return <button key={item.path} className={location.pathname === item.path ? 'active' : ''} type="button" onClick={() => navigate(item.path)}><Icon size={19} /><span>{item.label.replace(' 관리', '')}</span></button>;
        })}
        <button type="button" onClick={() => navigate('/admin/settings')}><Menu size={19} /><span>더보기</span></button>
      </nav>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin/*" element={<Protected><AdminLayout /></Protected>} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
