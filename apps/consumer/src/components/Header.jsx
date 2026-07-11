import { Bell, CalendarCheck, ClipboardCheck, Globe2, Heart, Mail, Menu, MessageCircle, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { alerts } from '../data/mockData.js';
import { useAppState } from '../state/AppContext.jsx';
import { useMessageBadge } from '../state/MessageBadgeContext.jsx';
import { isRegisteredGuideRole } from '../state/appStore.js';
import { formatUnreadBadge } from '../lib/messageBadge.js';
import { resolveAvatarUrl } from '../lib/supabaseAuth.js';

const languageRegions = [
  { code: 'ko', flag: '🇰🇷', language: '한국어', region: '대한민국', currency: 'KRW' },
  { code: 'en', flag: '🇬🇧', language: '영어', region: 'English', currency: 'USD', currencyOptions: ['USD', 'AUD', 'NZD'] },
  { code: 'zh-CN', flag: '🇨🇳', language: '중국어 간체', region: '简体中文', currency: 'CNY' },
  { code: 'zh-TW', flag: '🇹🇼', language: '중국어 번체', region: '繁體中文', currency: 'TWD' },
  { code: 'th', flag: '🇹🇭', language: '태국어', region: 'ไทย', currency: 'THB' },
  { code: 'ja', flag: '🇯🇵', language: '일본어', region: '日本語', currency: 'JPY' },
  { code: 'es', flag: '🇪🇸', language: '스페인어', region: 'Español', currency: 'EUR' },
  { code: 'vi', flag: '🇻🇳', language: '베트남어', region: 'Tiếng Việt', currency: 'VND' },
  { code: 'ms', flag: '🇲🇾', language: '말레이어', region: 'Bahasa Melayu', currency: 'MYR' },
  { code: 'fr', flag: '🇫🇷', language: '프랑스어', region: 'Français', currency: 'EUR' },
  { code: 'ru', flag: '🇷🇺', language: '러시아어', region: 'Русский', currency: 'RUB' },
  { code: 'mn', flag: '🇲🇳', language: '몽골어', region: 'Монгол хэл', currency: 'MNT' },
  { code: 'id', flag: '🇮🇩', language: '인도네시아어', region: 'Bahasa Indonesia', currency: 'IDR' },
  { code: 'de', flag: '🇩🇪', language: '독일어', region: 'Deutsch', currency: 'EUR' },
  { code: 'tr', flag: '🇹🇷', language: '터키어', region: 'Türkçe', currency: 'TRY' },
  { code: 'ar', flag: '🇸🇦', language: '아랍어', region: 'العربية', currency: 'AED' },
  { code: 'nl', flag: '🇳🇱', language: '네덜란드어', region: 'Nederlands', currency: 'EUR' },
  { code: 'gsw', flag: '🇨🇭', language: '스위스어', region: 'Schweizerdeutsch', currency: 'CHF' },
  { code: 'it', flag: '🇮🇹', language: '이탈리아어', region: 'Italiano', currency: 'EUR' }
];

const currencies = [
  { code: 'KRW', name: '한국 원', symbol: '₩' },
  { code: 'USD', name: '미국 달러', symbol: '$' },
  { code: 'EUR', name: '유로', symbol: '€' },
  { code: 'JPY', name: '일본 엔', symbol: '¥' },
  { code: 'CNY', name: '중국 위안', symbol: '¥' },
  { code: 'TWD', name: '대만 달러', symbol: 'NT$' },
  { code: 'GBP', name: '영국 파운드', symbol: '£' },
  { code: 'CAD', name: '캐나다 달러', symbol: '$' },
  { code: 'AUD', name: '호주 달러', symbol: '$' },
  { code: 'NZD', name: '뉴질랜드 달러', symbol: '$' },
  { code: 'SGD', name: '싱가포르 달러', symbol: '$' },
  { code: 'THB', name: '태국 바트', symbol: '฿' },
  { code: 'VND', name: '베트남 동', symbol: '₫' },
  { code: 'MYR', name: '말레이시아 링깃', symbol: 'RM' },
  { code: 'CHF', name: '스위스 프랑', symbol: 'CHF' },
  { code: 'RUB', name: '러시아 루블', symbol: '₽' },
  { code: 'MNT', name: '몽골 투그릭', symbol: '₮' },
  { code: 'IDR', name: '인도네시아 루피아', symbol: 'Rp' },
  { code: 'MXN', name: '멕시코 페소', symbol: '$' },
  { code: 'BRL', name: '브라질 레알', symbol: 'R$' },
  { code: 'AED', name: '아랍에미리트 디르함', symbol: 'د.إ' },
  { code: 'SAR', name: '사우디 리얄', symbol: '﷼' },
  { code: 'TRY', name: '터키 리라', symbol: '₺' },
  { code: 'HKD', name: '홍콩 달러', symbol: '$' },
  { code: 'INR', name: '인도 루피', symbol: '₹' },
  { code: 'PHP', name: '필리핀 페소', symbol: '₱' }
];

export function Header() {
  const { t, i18n } = useTranslation();
  const { state, dispatch } = useAppState();
  const { unreadCount } = useMessageBadge();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [lang, setLang] = useState(false);
  const [localeTab, setLocaleTab] = useState('language');
  const [notice, setNotice] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const noticeRef = useRef(null);
  const profileAvatarSrc = resolveAvatarUrl(null, state.auth.user?.avatar);

  useEffect(() => {
    if (!notice) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!noticeRef.current?.contains(event.target)) setNotice(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [notice]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profileAvatarSrc]);

  function goProtected(path) {
    if (!state.auth.isAuthenticated) navigate(`/login?redirect=${encodeURIComponent(path)}`);
    else navigate(path);
  }

  const showGuideRegistration = !state.auth.isAuthenticated || !isRegisteredGuideRole(state.auth.user?.role, state.auth.user?.isGuide);
  const messageBadge = formatUnreadBadge(unreadCount);
  const nav = (
    <>
      {showGuideRegistration && <button className="header-nav-item" onClick={() => goProtected('/register-guide')}>{t('nav.guide')}</button>}
      <Link className="header-nav-item" to="/policies">{t('nav.policies')}</Link>
      <button className="header-nav-item" onClick={() => goProtected('/support')}>{t('nav.support')}</button>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-7">
          <Link to="/" className="text-2xl font-black text-primary">[local way]</Link>
          <nav className="hidden h-11 items-center gap-5 text-zinc-700 lg:flex">{nav}</nav>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative" ref={noticeRef}>
            <button className={`icon-btn relative ${notice ? 'bg-orange-50 text-primary' : ''}`} onClick={() => setNotice(!notice)} aria-label="Notifications" aria-expanded={notice}>
              <Bell size={21} /><span className="absolute right-1 top-1 h-4 min-w-4 rounded-full bg-primary px-1 text-[10px] text-white">{alerts.length}</span>
            </button>
            {notice && <NotificationsPanel alerts={alerts} onClose={() => setNotice(false)} />}
          </div>
          <button className="icon-btn" onClick={() => goProtected('/bookmarks')} aria-label="Bookmarks"><Heart size={21} /></button>
          <button className="icon-btn relative" onClick={() => goProtected('/messages')} aria-label="Messages">
            <Mail size={21} />
            {messageBadge && <span className="message-unread-badge">{messageBadge}</span>}
          </button>
          <button className="icon-btn" onClick={() => setLang(true)} aria-label="Language and currency"><Globe2 size={21} /></button>
          {state.auth.isAuthenticated ? (
            <button className="ml-1 h-11 w-11 overflow-hidden rounded-full bg-primary text-cream" onClick={() => navigate('/mypage')} aria-label="Profile">
              {profileAvatarSrc && !avatarLoadFailed ? <img className="h-full w-full object-cover" src={profileAvatarSrc} alt="" onError={() => setAvatarLoadFailed(true)} /> : <UserRound className="mx-auto" />}
            </button>
          ) : (
            <button className="hidden h-11 rounded-full border border-zinc-300 px-5 font-bold sm:block" onClick={() => navigate('/login')}>{t('nav.login')}</button>
          )}
          <button className="icon-btn lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X /> : <Menu />}</button>
        </div>
      </div>
      {lang && (
        <LocaleModal
          activeTab={localeTab}
          setActiveTab={setLocaleTab}
          onClose={() => setLang(false)}
          currentLanguage={i18n.language}
          onLanguageSelect={(item) => {
            i18n.changeLanguage(item.code);
            dispatch({ type: 'SET_CURRENCY', payload: { currency: item.currency } });
          }}
          currentCurrency={state.currency}
          onCurrencySelect={(currency) => { dispatch({ type: 'SET_CURRENCY', payload: { currency } }); }}
        />
      )}
      {menu && <nav className="grid gap-1 border-t bg-white p-4 text-left font-semibold lg:hidden">{nav}<button onClick={() => navigate('/login')}>{t('nav.login')}</button></nav>}
    </header>
  );
}

function NotificationsPanel({ alerts: items, onClose }) {
  return (
    <section className="notifications-popover">
      <div className="notifications-arrow" />
      <header className="notifications-header">
        <div>
          <h2>Notifications</h2>
          <p>{items.length} unread updates</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close notifications"><X size={18} /></button>
      </header>
      <div className="notifications-list">
        {items.map((item) => <NotificationItem item={item} key={item.id} />)}
      </div>
      <button className="notifications-footer" type="button">View all notifications</button>
    </section>
  );
}

function NotificationItem({ item }) {
  const Icon = item.type === 'message' ? MessageCircle : item.type === 'guide' ? ClipboardCheck : CalendarCheck;
  return (
    <button className="notification-item" type="button">
      <span className={`notification-icon ${item.type}`}><Icon size={18} /></span>
      <span className="notification-copy">
        <b>{item.title}</b>
        <small>{item.text}</small>
      </span>
      <time>{item.time}</time>
    </button>
  );
}

function LocaleModal({ activeTab, setActiveTab, onClose, currentLanguage, onLanguageSelect, currentCurrency, onCurrencySelect }) {
  const selectedLanguage = languageRegions.find((item) => item.code === currentLanguage) ?? languageRegions.find((item) => item.code === 'en');
  const selectedCurrency = currencies.find((item) => item.code === currentCurrency) ?? currencies.find((item) => item.code === 'USD');

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4 py-6">
      <section className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
        <button className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full hover:bg-zinc-100" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
        <div className="border-b border-zinc-200 px-6 pb-0 pt-16 sm:px-8">
          <div className="mb-5 grid gap-3 rounded-2xl bg-zinc-50 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-zinc-500">현재 언어</p>
              <p className="mt-1 text-lg font-black">{selectedLanguage.flag} {selectedLanguage.language}</p>
              <p className="text-sm font-semibold text-zinc-500">{selectedLanguage.region}</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-zinc-500">현재 통화</p>
              <p className="mt-1 text-lg font-black">{selectedCurrency.code} · {selectedCurrency.symbol}</p>
              <p className="text-sm font-semibold text-zinc-500">{selectedCurrency.name}</p>
            </div>
          </div>
          <div className="flex gap-8">
            <button className={`locale-tab ${activeTab === 'language' ? 'active' : ''}`} onClick={() => setActiveTab('language')}>언어와 지역</button>
            <button className={`locale-tab ${activeTab === 'currency' ? 'active' : ''}`} onClick={() => setActiveTab('currency')}>통화</button>
          </div>
        </div>
        <div className="overflow-y-auto px-6 py-8 sm:px-8">
          {activeTab === 'language' ? (
            <LanguagePanel currentLanguage={currentLanguage} currentCurrency={currentCurrency} onSelect={onLanguageSelect} onCurrencySelect={onCurrencySelect} />
          ) : (
            <CurrencyPanel currentCurrency={currentCurrency} onSelect={onCurrencySelect} />
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

function LanguagePanel({ currentLanguage, currentCurrency, onSelect, onCurrencySelect }) {
  const selectedLanguage = languageRegions.find((item) => item.code === currentLanguage);
  const englishCurrencyOptions = currencies.filter((currency) => ['USD', 'AUD', 'NZD'].includes(currency.code));

  return (
    <div>
      <h2 className="mb-5 text-2xl font-black">언어와 지역을 선택하세요</h2>
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {languageRegions.map((item) => <LocaleChoice item={item} selected={currentLanguage === item.code} onClick={() => onSelect(item)} key={`${item.code}-${item.region}`} />)}
      </div>
      {selectedLanguage?.code === 'en' && (
        <section className="mt-8 rounded-2xl border border-zinc-200 p-4">
          <h3 className="text-base font-black">영어 통화 옵션</h3>
          <p className="mt-1 text-sm font-semibold text-zinc-500">영어 선택 시 USD가 기본이며, 호주/뉴질랜드 통화로 바로 바꿀 수 있습니다.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {englishCurrencyOptions.map((currency) => (
              <button className={`locale-choice ${currentCurrency === currency.code ? 'selected' : ''}`} onClick={() => onCurrencySelect(currency.code)} key={currency.code}>
                <span className="block font-bold">{currency.name}</span>
                <span className="block text-sm font-semibold text-zinc-500">{currency.code} - {currency.symbol}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function LocaleChoice({ item, selected, onClick }) {
  return (
    <button className={`locale-choice ${selected ? 'selected' : ''}`} onClick={onClick}>
      <span className="block font-bold">{item.flag ? `${item.flag} ` : ''}{item.language}</span>
      <span className="block text-sm font-semibold text-zinc-500">{item.region}{item.currency ? ` · ${item.currency}` : ''}</span>
    </button>
  );
}

function CurrencyPanel({ currentCurrency, onSelect }) {
  return (
    <div>
      <h2 className="mb-6 text-2xl font-black">통화를 선택하세요.</h2>
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
        {currencies.map((item) => (
          <button className={`locale-choice ${currentCurrency === item.code ? 'selected' : ''}`} onClick={() => onSelect(item.code)} key={item.code}>
            <span className="block font-bold">{item.name}</span>
            <span className="block text-sm font-semibold text-zinc-500">{item.code} - {item.symbol}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
