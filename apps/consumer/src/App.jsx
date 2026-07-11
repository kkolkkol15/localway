import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAppState } from './state/AppContext.jsx';
import { MessageBadgeProvider } from './state/MessageBadgeContext.jsx';
import { Header } from './components/Header.jsx';
import { Footer } from './components/Footer.jsx';
import { Toast } from './components/Toast.jsx';
import { fetchBookmarkIds } from './lib/customerApi.js';
import { createBrowserSupabaseClient, getSupabaseConfig } from './lib/supabaseAuth.js';
import {
  HomePage, SearchPage, TourDetailPage, PaymentPage, BookingSuccessPage, LoginPage,
  GuideRegistrationPage, MyPage, GuideModePage, GuideMyToursPage, GuidePaymentsPage, TourCreatePage, BookmarksPage,
  MessagesPage, PoliciesPage, SupportPage, MyBookingsPage, PastTripsPage,
  ReviewManagementPage, AccountSettingsPage, ViewProfilePage
} from './pages/Pages.jsx';

function ProtectedRoute({ children, guideOnly = false }) {
  const { state } = useAppState();
  const location = useLocation();
  if (!state.auth.isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  if (guideOnly && state.auth.user?.role !== 'guide' && !state.guideProfile?.id) {
    return <Navigate to="/register-guide" replace />;
  }
  return children;
}

export default function App() {
  const location = useLocation();
  const { state, dispatch } = useAppState();
  const isMessagesPage = location.pathname === '/messages';

  useEffect(() => {
    let active = true;
    async function syncBookmarks() {
      if (!state.auth.user?.id || !getSupabaseConfig().isConfigured) return;
      try {
        const client = await createBrowserSupabaseClient();
        const tourIds = await fetchBookmarkIds(client, state.auth.user.id);
        if (active) dispatch({ type: 'SET_BOOKMARKS', payload: { tourIds } });
      } catch {
        if (active) dispatch({ type: 'SET_BOOKMARKS', payload: { tourIds: [] } });
      }
    }
    syncBookmarks();
    return () => {
      active = false;
    };
  }, [dispatch, state.auth.user?.id]);

  return (
    <div className="flex min-h-screen flex-col bg-cream text-zinc-900">
      <MessageBadgeProvider>
        <Header />
        <div className="flex min-h-0 flex-1 flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/tour/:id" element={<TourDetailPage />} />
          <Route path="/payment" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
          <Route path="/booking/success" element={<ProtectedRoute><BookingSuccessPage /></ProtectedRoute>} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register-guide" element={<ProtectedRoute><GuideRegistrationPage /></ProtectedRoute>} />
          <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
          <Route path="/mypage/bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
          <Route path="/mypage/past-trips" element={<ProtectedRoute><PastTripsPage /></ProtectedRoute>} />
          <Route path="/mypage/reviews" element={<ProtectedRoute><ReviewManagementPage /></ProtectedRoute>} />
          <Route path="/mypage/settings" element={<ProtectedRoute><AccountSettingsPage /></ProtectedRoute>} />
          <Route path="/mypage/profile" element={<ProtectedRoute><ViewProfilePage /></ProtectedRoute>} />
          <Route path="/mypage/guide-mode" element={<ProtectedRoute><GuideModePage /></ProtectedRoute>} />
          <Route path="/mypage/guide-mode/tours" element={<ProtectedRoute guideOnly><GuideMyToursPage /></ProtectedRoute>} />
          <Route path="/mypage/guide-mode/payments" element={<ProtectedRoute><GuidePaymentsPage /></ProtectedRoute>} />
          <Route path="/mypage/guide-mode/new" element={<ProtectedRoute guideOnly><TourCreatePage /></ProtectedRoute>} />
          <Route path="/mypage/guide-mode/tours/:tourId/edit" element={<ProtectedRoute guideOnly><TourCreatePage /></ProtectedRoute>} />
          <Route path="/bookmarks" element={<ProtectedRoute><BookmarksPage /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
        {!isMessagesPage && <Footer />}
      </MessageBadgeProvider>
      <Toast />
    </div>
  );
}
