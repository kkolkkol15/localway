import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Bell, Bold, CalendarDays, Camera, Check, ChevronRight, CreditCard, DollarSign, Globe2, Heart, ImagePlus, Italic, List, LockKeyhole, MessageCircle, Package, Search, Send, Share2, ShieldCheck, SlidersHorizontal, SmilePlus, Star, Table2, Trash2, Type, Upload, UserRound, Video, WalletCards } from 'lucide-react';
import { cities, faqs, languages, tourTypes, tours, transports } from '../data/mockData.js';
import { useAppState } from '../state/AppContext.jsx';
import { formatRoleLabel, isRegisteredGuideRole, selectors } from '../state/appStore.js';
import { Modal, SkeletonGrid, TourCard } from '../components/UI.jsx';
import { validateGuideProfilePhoto } from '../lib/guidePhoto.js';
import { expandDateRange, getCalendarUnavailableSelection, saveGuideUnavailableDates } from '../lib/guideAvailability.js';
import { getGuideModeOverview, getGuideModeSections } from '../lib/guideMode.js';
import { saveGuideTourDraft } from '../lib/guideTourDrafts.js';
import { publishGuideTour } from '../lib/guideTours.js';
import { submitGuideApplication } from '../lib/guideApplications.js';
import { createSupportTicket, fetchAccountSettings, fetchActiveTours, fetchBookmarks, fetchConversations, fetchSupportTickets, fetchTourById, sendConversationMessage, toggleBookmark, upsertAccountSettings } from '../lib/customerApi.js';
import { agreementSections, buildGuideInfoDetails, clampHourlyPrice, formatHourlyPrice, getPricingMode, hourlyPriceRange, majorCurrencyOptions, pricingModes, tourOptionGroups } from '../lib/tourCreateForm.js';
import { buildSignupDisplayName, createBrowserSupabaseClient, fetchActiveGuideProfile, getAuthErrorMessage, getSupabaseConfig, signInWithEmail, signUpWithEmail } from '../lib/supabaseAuth.js';

const today = new Date().toISOString().slice(0, 10);
const messageCategories = [
  { id: 'all', label: '전체' },
  { id: 'travel', label: '여행' },
  { id: 'guiding', label: '가이딩' },
  { id: 'support', label: '지원' }
];
const mockConversations = [
  {
    id: 'mock-guiding-application',
    type: 'guiding',
    guideName: 'Guide Team',
    avatar: 'https://picsum.photos/seed/local-way-message-guiding/120/120',
    lastMessage: '가이드 프로필 보완 안내를 확인해주세요.',
    messages: [
      { from: 'guide', text: '가이드 지원서의 자기소개를 조금 더 자세히 작성해주세요.' },
      { from: 'me', text: '오늘 중으로 수정하겠습니다.' }
    ]
  },
  {
    id: 'mock-support-refund',
    type: 'support',
    guideName: 'Customer Support',
    avatar: 'https://picsum.photos/seed/local-way-message-support/120/120',
    lastMessage: '환불 정책 문의에 대한 답변이 등록되었습니다.',
    messages: [
      { from: 'guide', text: '문의주신 예약은 무료 취소 기간 내에 있습니다.' },
      { from: 'me', text: '확인 감사합니다.' }
    ]
  },
  {
    id: 'mock-travel-seoul',
    type: 'travel',
    guideName: 'Minji',
    avatar: 'https://picsum.photos/seed/local-way-message-travel/120/120',
    lastMessage: '내일 북촌 투어 만나는 장소를 보내드렸어요.',
    messages: [
      { from: 'guide', text: '내일 북촌 투어는 안국역 2번 출구에서 시작합니다.' },
      { from: 'me', text: '좋아요. 10분 전에 도착할게요.' }
    ]
  }
];
const guideLanguageOptions = [
  '아프리칸스어', '알바니아어', '암하라어', '아랍어', '아르메니아어', '아제르바이잔어', '바스크어', '벨라루스어', '벵골어', '보스니아어',
  '불가리아어', '카탈로니아어', '세부아노어', '중국어(간체)', '중국어(번체)', '코르시카어', '크로아티아어', '체코어', '덴마크어', '네덜란드어',
  '영어', '에스페란토', '에스토니아어', '필리핀어', '핀란드어', '프랑스어', '프리지아어', '갈리시아어', '조지아어', '독일어',
  '그리스어', '구자라트어', '아이티 크레올어', '하우사어', '하와이어', '히브리어', '힌디어', '몽족어', '헝가리어', '아이슬란드어',
  '이그보어', '인도네시아어', '아일랜드어', '이탈리아어', '일본어', '자와어', '칸나다어', '카자흐어', '크메르어', '한국어',
  '쿠르드어(쿠르만지)', '키르기스어', '라오어', '라틴어', '라트비아어', '리투아니아어', '룩셈부르크어', '마케도니아어', '말라가시어', '말레이어',
  '말라얄람어', '몰타어', '마오리어', '마라티어', '몽골어', '미얀마어(버마어)', '네팔어', '노르웨이어', '파슈토어', '페르시아어',
  '폴란드어', '포르투갈어', '펀자브어', '루마니아어', '러시아어', '사모아어', '스코틀랜드 게일어', '세르비아어', '쇼나어', '신드어',
  '신할라어', '슬로바키아어', '슬로베니아어', '소말리어', '남부 소토어', '스페인어', '순다어', '스와힐리어', '스웨덴어', '타지크어',
  '타밀어', '타타르어', '텔루구어', '태국어', '터키어', '투르크멘어', '우크라이나어', '우르두어', '위구르어', '우즈베크어',
  '베트남어', '웨일즈어', '코사어', '요루바어', '줄루어', '치체와어(니안자어)', '디베히어(몰디브어)', '에웨어', '간다어', '크리올어(시에라리온)',
  '링갈라어', '루바어', '룬디어', '키냐르완다어', '세페디어(북부 소토어)', '츠와나어', '벤다어', '코모로어', '콘월어', '아삼어',
  '아바르어', '바시키르어', '체첸어', '추바시어', '다르긴어', '카라차이-발카르어', '쿠미크어', '레즈긴어', '오세트어', '야쿠트어',
  '타트어', '투바어', '우드무르트어'
];
const nationalityOptions = [
  '가나', '가봉', '가이아나', '감비아', '과테말라', '그레나다', '그리스', '기니', '기니비사우', '나미비아',
  '나우루', '나이지리아', '남수단', '남아프리카 공화국', '네덜란드', '네팔', '노르웨이', '뉴질랜드', '니제르', '니카라과',
  '대한민국', '덴마크', '도미니카 공화국', '도미니카 연방', '독일', '동티모르', '라오스', '라이베리아', '라트비아', '러시아',
  '레바논', '레소토', '루마니아', '룩셈부르크', '르완다', '리비아', '리투아니아', '리히텐슈타인', '마다가스카르', '마셜 제도',
  '말라위', '말레이시아', '말리', '멕시코', '모나코', '모로코', '모리셔스', '모리타니', '모잠비크', '몬테네그로',
  '몰도바', '몰디브', '몰타', '몽골', '미국', '미얀마', '미크로네시아 연방', '바누아투', '바레인', '바베이도스',
  '바하마', '방글라데시', '베냉', '베네수엘라', '베트남', '벨기에', '벨라루스', '벨리즈', '보스니아 헤르체고비나', '보츠와나',
  '볼리비아', '부룬디', '부르키나파소', '부탄', '북마케도니아', '불가리아', '브라질', '브루나이', '사모아', '사우디아라비아',
  '산마리노', '상투메 프린시페', '세네갈', '세르비아', '세이셸', '세인트루시아', '세인트빈센트 그레나딘', '세인트키츠 네비스', '소말리아', '솔로몬 제도',
  '수단', '수리남', '스리랑카', '스위스', '스웨덴', '스페인', '슬로바키아', '슬로베니아', '시리아', '시에라리온',
  '싱가포르', '아랍에미리트', '아르메니아', '아르헨티나', '아이슬란드', '아이티', '아일랜드', '아제르바이잔', '아프가니스탄', '안도라',
  '알바니아', '알제리', '앙골라', '앤티가 바부다', '에리트레아', '에스와티니', '에스토니아', '에콰도르', '에티오피아', '엘살바도르',
  '영국', '예멘', '오만', '오스트레일리아', '오스트리아', '온두라스', '요르단', '우간다', '우루과이', '우즈베키스탄',
  '우크라이나', '이라크', '이란', '이스라엘', '이집트', '이탈리아', '인도', '인도네시아', '일본', '자메이카',
  '잠비아', '적도 기니', '조선민주주의인민공화국 (북한)', '조지아', '중앙아프리카 공화국', '지부티', '짐바브웨', '차드', '체코', '칠레',
  '카메룬', '카보베르데', '카자흐스탄', '카타르', '캄보디아', '캐나다', '케냐', '코모로', '코스타리카', '코트디부아르',
  '콜롬비아', '콩고 공화국', '콩고 민주 공화국', '쿠바', '쿠웨이트', '크로아티아', '키르기스스탄', '키리바시', '키프로스', '타지키스탄',
  '탄자니아', '태국', '튀르키예', '토고', '통가', '투르크메니스탄', '투발루', '트리니다드 토바고', '파나마', '파라과이',
  '파키스탄', '파푸아뉴기니', '팔라우', '페루', '포르투갈', '폴란드', '프랑스', '피지', '핀란드', '필리핀',
  '헝가리', '바티칸 시국', '팔레스타인', '대만'
];

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [remoteTours, setRemoteTours] = useState(tours);
  const [city, setCity] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [guestOpen, setGuestOpen] = useState(false);
  const guestCount = adults + children + infants;
  useEffect(() => {
    let active = true;
    async function loadTours() {
      try {
        const client = await createBrowserSupabaseClient();
        const items = await fetchActiveTours(client);
        if (active && items.length) setRemoteTours(items);
      } catch {
        if (active) setRemoteTours(tours);
      }
    }
    loadTours();
    return () => {
      active = false;
    };
  }, []);
  const tourSections = [
    { title: t('home.popular'), items: remoteTours, duration: '42s' },
    { title: 'Recommended tours', items: [...remoteTours.slice(1), remoteTours[0]].filter(Boolean), duration: '44s' },
    { title: 'nearby tours', items: [...remoteTours.slice(2), ...remoteTours.slice(0, 2)], duration: '46s' },
    { title: 'tours available this week', items: [...remoteTours.slice(3), ...remoteTours.slice(0, 3)], duration: '48s' }
  ];

  return (
    <main>
      <section className="border-b border-zinc-200 bg-cream px-4 pb-8 pt-8 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-[900px]">
            <div className="relative grid rounded-full border border-zinc-200 bg-white shadow-[0_8px_28px_rgba(0,0,0,0.12)] md:grid-cols-[1.15fr_0.9fr_0.9fr_76px]">
              <label className="main-search-cell rounded-l-full">
                <span className="main-search-label">Where</span>
                <input
                  className="main-search-input"
                  list="cities"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder={t('home.where')}
                />
                <datalist id="cities">{cities.map((item) => <option key={item}>{item}</option>)}</datalist>
              </label>

              <label className="main-search-cell">
                <span className="main-search-label">When</span>
                <input
                  className="main-search-input"
                  type="date"
                  value={travelDate}
                  onChange={(event) => setTravelDate(event.target.value)}
                  min={today}
                  aria-label="Tour date"
                />
              </label>

              <button className="main-search-cell text-left" type="button" onClick={() => setGuestOpen((open) => !open)}>
                <span className="main-search-label">Who</span>
                <span className="block text-sm font-semibold text-zinc-500">{guestCount > 1 ? `게스트 ${guestCount}명` : '게스트 추가'}</span>
              </button>

              <div className="flex items-center justify-center p-2">
                <button
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white transition hover:scale-105"
                  aria-label="Search"
                  onClick={() => navigate(`/search?city=${encodeURIComponent(city)}&adults=${adults}&children=${children}&date=${travelDate}`)}
                >
                  <Search size={23} />
                </button>
              </div>

              {guestOpen && (
                <div className="absolute right-0 top-[calc(100%+14px)] z-20 w-full max-w-[530px] rounded-[34px] bg-white px-10 py-8 text-left text-zinc-900 shadow-[0_10px_30px_rgba(0,0,0,0.14)]">
                  <GuestRow title="성인" subtitle="13세 이상" value={adults} setValue={setAdults} min={1} />
                  <GuestRow title="어린이" subtitle="2~12세" value={children} setValue={setChildren} />
                  <GuestRow title="유아" subtitle="2세 미만" value={infants} setValue={setInfants} last />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {tourSections.map((section, index) => (
          <TourCarouselSection
            key={section.title}
            title={section.title}
            tours={section.items}
            duration={section.duration}
            className={index > 0 ? 'mt-12' : ''}
            onTourClick={(tourId) => navigate(`/tour/${tourId}`)}
          />
        ))}
      </div>
    </main>
  );
}

function TourCarouselSection({ title, tours: sectionTours, duration, className = '', onTourClick }) {
  return (
    <section className={className}>
      <h2 className="mb-5 text-3xl font-black">{title}</h2>
      <div className="popular-carousel" style={{ '--carousel-duration': duration }} aria-label={title}>
        <div className="popular-carousel-track">
          {[...sectionTours, ...sectionTours].map((tour, index) => (
            <div className="popular-tour-slide" key={`${title}-${tour.id}-${index}`} aria-hidden={index >= sectionTours.length}>
              <TourCard tour={tour} onClick={() => onTourClick(tour.id)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GuestRow({ title, subtitle, value, setValue, min = 0, last = false }) {
  return (
    <div className={`flex min-h-[114px] items-center justify-between gap-6 ${last ? '' : 'border-b border-zinc-200'}`}>
      <div>
        <p className="text-xl font-bold text-zinc-900">{title}</p>
        <p className="mt-1 text-base font-semibold text-zinc-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <button
          className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-2xl font-semibold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={value <= min}
          onClick={() => setValue(Math.max(min, value - 1))}
          aria-label={`${title} 감소`}
        >
          -
        </button>
        <span className="w-5 text-center text-xl font-medium">{value}</span>
        <button
          className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-2xl font-semibold text-zinc-900"
          type="button"
          onClick={() => setValue(value + 1)}
          aria-label={`${title} 증가`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function SearchPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [searchTours, setSearchTours] = useState(tours);
  const [filters, setFilters] = useState({ types: [], languages: [], priceMin: 0, priceMax: 500, years: 3, toggles: {}, transport: [] });
  const city = params.get('city') || '';
  const adults = params.get('adults') || '1';

  useEffect(() => {
    let active = true;
    async function loadTours() {
      try {
        const client = await createBrowserSupabaseClient();
        const items = await fetchActiveTours(client, { city });
        if (active) setSearchTours(items.length ? items : []);
      } catch {
        if (active) setSearchTours(tours);
      }
    }
    loadTours();
    return () => {
      active = false;
    };
  }, [city]);

  const results = useMemo(() => {
    let list = city ? searchTours.filter((tour) => tour.city.toLowerCase() === city.toLowerCase()) : searchTours;
    if (filters.types.length) list = list.filter((tour) => filters.types.includes(tour.type));
    list = list.filter((tour) => tour.price >= filters.priceMin && tour.price <= filters.priceMax && tour.guide.years >= filters.years);
    if (filters.languages.length) list = list.filter((tour) => filters.languages.some((lang) => tour.guide.languages.includes(lang)));
    Object.entries(filters.toggles).forEach(([key, on]) => { if (on) list = list.filter((tour) => tour.options?.[key]); });
    if (filters.transport.length) list = list.filter((tour) => filters.transport.some((item) => (tour.transport ?? []).includes(item)));
    if (sort === 'rated') list = [...list].sort((a, b) => b.rating - a.rating);
    if (sort === 'price') list = [...list].sort((a, b) => a.price - b.price);
    return list;
  }, [city, filters, searchTours, sort]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black">{city || 'All cities'} · {adults} adults</h1>
        <div className="flex gap-2">
          <select className="h-11 rounded-full border px-4" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="rated">Highest Rated</option><option value="price">Lowest Price</option></select>
          <button className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 font-black text-white" onClick={() => setOpen(true)}><SlidersHorizontal size={18} /> Filter</button>
        </div>
      </div>
      {!results.length ? <section className="rounded-card bg-white p-10 text-center shadow-soft"><h2 className="text-2xl font-black">We are recruiting guides in {city || 'this city'}</h2><p className="mt-2 text-zinc-600">Know this city like home? Local Way would love to meet you.</p></section> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{results.map((tour) => <TourCard key={tour.id} tour={tour} onClick={() => navigate(`/tour/${tour.id}`)} />)}</div>}
      {open && <FilterModal filters={filters} setFilters={setFilters} onClose={() => setOpen(false)} />}
    </main>
  );
}

function FilterModal({ filters, setFilters, onClose }) {
  const updateArray = (key, value) => setFilters((prev) => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter((item) => item !== value) : [...prev[key], value] }));
  return (
    <Modal title="Filter" onClose={onClose}>
      <div className="grid gap-5">
        <CheckGroup title="Tour type" items={tourTypes} selected={filters.types} onToggle={(item) => updateArray('types', item)} />
        <div><h3 className="font-black">Payment type</h3><div className="mt-2 grid gap-2"><label><input type="radio" name="pay" /> Pay as you go (hourly, min $5)</label><label><input type="radio" name="pay" /> Package Price (min $20)</label></div></div>
        <div><h3 className="font-black">Price range</h3><div className="mt-2 grid grid-cols-2 gap-3"><input type="number" value={filters.priceMin} onChange={(e) => setFilters({ ...filters, priceMin: Number(e.target.value) })} /><input type="number" value={filters.priceMax} onChange={(e) => setFilters({ ...filters, priceMax: Number(e.target.value) })} /></div><input type="range" min="0" max="500" value={filters.priceMax} onChange={(e) => setFilters({ ...filters, priceMax: Number(e.target.value) })} /></div>
        <div><h3 className="font-black">Guide residence duration: {filters.years}yr+</h3><input type="range" min="3" max="20" value={filters.years} onChange={(e) => setFilters({ ...filters, years: Number(e.target.value) })} /></div>
        <CheckGroup title="Guide language" chip items={languages} selected={filters.languages} onToggle={(item) => updateArray('languages', item)} />
        <CheckGroup title="Transport" items={transports} selected={filters.transport} onToggle={(item) => updateArray('transport', item)} />
        <div><h3 className="font-black">Options</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(optionLabels).map(([key, label]) => <label className="flex items-center justify-between rounded-card bg-white p-3" key={key}>{label}<input type="checkbox" checked={!!filters.toggles[key]} onChange={(e) => setFilters({ ...filters, toggles: { ...filters.toggles, [key]: e.target.checked } })} /></label>)}</div></div>
        <div className="flex gap-3"><button className="h-12 rounded-full border px-6 font-black" onClick={() => setFilters({ types: [], languages: [], priceMin: 0, priceMax: 500, years: 3, toggles: {}, transport: [] })}>Reset</button><button className="h-12 rounded-full bg-primary px-6 font-black text-white" onClick={onClose}>Apply</button></div>
      </div>
    </Modal>
  );
}

function CheckGroup({ title, items, selected, onToggle, chip }) {
  return <div><h3 className="font-black">{title}</h3><div className={`mt-2 flex flex-wrap gap-2 ${chip ? '' : 'grid sm:grid-cols-2'}`}>{items.map((item) => <button className={`min-h-11 rounded-full border px-4 font-bold ${selected.includes(item) ? 'border-primary bg-orange-50 text-primary' : 'bg-white'}`} key={item} onClick={() => onToggle(item)}>{item}</button>)}</div></div>;
}

export function TourDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const [remoteTour, setRemoteTour] = useState(null);
  const tour = remoteTour ?? tours.find((item) => item.id === id) ?? tours[0];
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('10:00');
  const saved = state.bookmarks.includes(tour.id);

  useEffect(() => {
    let active = true;
    async function loadTour() {
      try {
        const client = await createBrowserSupabaseClient();
        const item = await fetchTourById(client, id);
        if (active) setRemoteTour(item);
      } catch {
        if (active) setRemoteTour(null);
      }
    }
    if (id) loadTour();
    return () => {
      active = false;
    };
  }, [id]);

  function reserve() {
    if (!state.auth.isAuthenticated) navigate(`/login?redirect=${encodeURIComponent(`/tour/${tour.id}`)}`);
    else navigate(`/payment?tourId=${tour.id}&date=${date}&time=${time}`);
  }

  async function toggleSavedTour() {
    if (!state.auth.isAuthenticated) {
      navigate(`/login?redirect=/tour/${tour.id}`);
      return;
    }
    try {
      const client = await createBrowserSupabaseClient();
      await toggleBookmark(client, { profileId: state.auth.user?.id, tourId: tour.id, currentlySaved: saved });
    } catch {
      // Keep the local bookmark behavior as a fallback if the backend call fails.
    }
    dispatch({ type: 'TOGGLE_BOOKMARK', payload: { tourId: tour.id } });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-3 overflow-hidden rounded-card md:grid-cols-3">{tour.gallery.map((src) => <img className="h-72 w-full object-cover" src={src} alt="" loading="lazy" key={src} />)}</div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="flex items-start justify-between gap-3"><div><h1 className="text-4xl font-black">{tour.title}</h1><p className="mt-2 text-zinc-600">{tour.description}</p></div><button className="icon-btn bg-white" onClick={toggleSavedTour}><Heart className={saved ? 'fill-primary text-primary' : ''} /></button></div>
          <div className="mt-6 flex items-center gap-4 rounded-card bg-white p-4 shadow-soft"><img className="h-16 w-16 rounded-full object-cover" src={tour.guide.avatar} alt="" /><div><b>{tour.guide.name}</b><p className="text-sm text-zinc-600">{tour.guide.years} years in {tour.guide.city} · {tour.guide.languages.join(', ')}</p></div></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">{Object.entries(tour.options).map(([key, value]) => <div className="rounded-card bg-white p-4 shadow-soft" key={key}><Check className={value ? 'text-primary' : 'text-zinc-300'} /><b>{optionLabels[key]}</b></div>)}</div>
          <Reviews tour={tour} />
        </section>
        <aside className="sticky top-24 h-fit rounded-card bg-white p-5 shadow-soft">
          <p className="text-2xl font-black">${tour.price} <span className="text-sm text-zinc-500">/ person</span></p>
          <label className="mt-4 block font-bold">Date<input className="mt-2" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <div className="mt-4 grid grid-cols-2 gap-2">{['10:00', '14:00'].map((slot) => <button className={`h-11 rounded-full border font-bold ${time === slot ? 'border-primary bg-orange-50 text-primary' : ''}`} onClick={() => setTime(slot)} key={slot}>{slot}</button>)}</div>
          <button className="mt-5 h-12 w-full rounded-full bg-primary font-black text-white" onClick={reserve}>Reserve</button>
          <button className="mt-3 h-11 w-full rounded-full border font-bold" onClick={() => navigator.share?.({ title: tour.title, url: location.href })}><Share2 size={17} /> Share</button>
        </aside>
      </div>
    </main>
  );
}

function Reviews({ tour }) {
  return <section className="mt-8"><h2 className="text-2xl font-black">Reviews · ⭐ {tour.rating}</h2>{tour.reviewsList.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{tour.reviewsList.map((review) => <article className="rounded-card bg-white p-4 shadow-soft" key={review.id}><b>{review.author}</b><p>{'★'.repeat(review.rating)}</p><p>{review.text}</p></article>)}</div> : <p className="mt-3 rounded-card bg-white p-5 shadow-soft">No reviews yet</p>}<div className="mt-4 grid gap-2">{[5, 4, 3, 2, 1].map((star) => <div className="flex items-center gap-2" key={star}><span className="w-8">{star}★</span><div className="h-2 flex-1 rounded-full bg-zinc-200"><div className="h-2 rounded-full bg-primary" style={{ width: `${star * 16}%` }} /></div></div>)}</div></section>;
}

export function PaymentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { dispatch } = useAppState();
  const tour = tours.find((item) => item.id === params.get('tourId')) ?? tours[0];
  const date = params.get('date') ?? today;
  const time = params.get('time') ?? '10:00';
  return <main className="mx-auto max-w-3xl px-4 py-10"><section className="rounded-card bg-white p-6 shadow-soft"><h1 className="text-3xl font-black">Order summary</h1><p className="mt-4 font-bold">{tour.title}</p><p>{date} · {time}</p><p>Guests: 1 adult</p><div className="my-5 rounded-card bg-orange-50 p-4 font-bold text-primary">Payment gateway integration pending - this is a simulation</div><p>Tour ${tour.price} + service ${Math.round(tour.price * 0.1)}</p><button className="mt-5 h-12 w-full rounded-full bg-primary font-black text-white" onClick={() => { dispatch({ type: 'PAY_NOW', payload: { tourId: tour.id, date, time, guests: 1 } }); navigate('/booking/success?bookingId=mock123'); }}>Pay Now</button></section></main>;
}

export function BookingSuccessPage() {
  return <main className="grid min-h-[70vh] place-items-center px-4"><section className="max-w-xl rounded-card bg-white p-8 text-center shadow-soft"><h1 className="text-4xl font-black">You are all set!</h1><p className="mt-3 text-zinc-600">A chat with your guide has been opened.</p><Link className="mt-6 inline-flex h-12 items-center rounded-full bg-primary px-6 font-black text-white" to="/messages">Go to Messages</Link></section></main>;
}

export function LoginPage() {
  const { state, dispatch } = useAppState();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirect = params.get('redirect') || '/';
  const [mode, setMode] = useState('login');
  const [formError, setFormError] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const supabaseConfig = getSupabaseConfig();
  const isSignup = mode === 'signup';
  const submitEmailAuth = async (event) => {
    event.preventDefault();
    setFormError('');
    setFormNotice('');
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    const firstName = String(form.get('firstName') || '');
    const lastName = String(form.get('lastName') || '');

    try {
      if (isSignup && password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      const displayName = isSignup ? buildSignupDisplayName(firstName, lastName) : '';
      const client = await createBrowserSupabaseClient();
      const result = isSignup
        ? await signUpWithEmail(client, { email, password, displayName })
        : await signInWithEmail(client, { email, password });

      if (result.requiresEmailConfirmation) {
        setMode('login');
        setFormNotice('Confirmation email sent. Please check your inbox, confirm your email, then log in.');
        return;
      }

      dispatch({ type: 'EMAIL_AUTH_SUCCESS', payload: { user: result.user, guideProfile: result.guideProfile } });
      navigate(redirect);
    } catch (error) {
      const message = getAuthErrorMessage(error);
      setFormError(message);
      dispatch({ type: 'AUTH_ERROR', payload: { message } });
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="grid min-h-[75vh] place-items-center px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-card bg-white p-6 shadow-soft">
        <h1 className="text-3xl font-black">{isSignup ? 'Create account' : 'Login'}</h1>
        <div className="mt-5 grid grid-cols-2 rounded-full bg-zinc-100 p-1">
          <button className={`h-11 rounded-full font-black ${!isSignup ? 'bg-white shadow-soft' : 'text-zinc-500'}`} type="button" onClick={() => setMode('login')}>Login</button>
          <button className={`h-11 rounded-full font-black ${isSignup ? 'bg-white shadow-soft' : 'text-zinc-500'}`} type="button" onClick={() => setMode('signup')}>Sign up</button>
        </div>

        <form className="mt-5 grid w-full max-w-full gap-3 overflow-hidden" onSubmit={submitEmailAuth}>
          {isSignup && (
            <div className="auth-name-grid">
              <label className="auth-field font-bold">First name<input className="h-12 rounded-card border px-4 font-semibold" name="firstName" placeholder="Mina" autoComplete="given-name" required /></label>
              <label className="auth-field font-bold">Last name<input className="h-12 rounded-card border px-4 font-semibold" name="lastName" placeholder="Kim" autoComplete="family-name" required /></label>
            </div>
          )}
          <label className="auth-field font-bold">Email<input className="h-12 rounded-card border px-4 font-semibold" name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
          <label className="auth-field font-bold">Password<input className="h-12 rounded-card border px-4 font-semibold" name="password" type="password" minLength={6} placeholder="6+ characters" autoComplete={isSignup ? 'new-password' : 'current-password'} required /></label>
          {isSignup && <label className="auth-field font-bold">Confirm password<input className="h-12 rounded-card border px-4 font-semibold" name="confirmPassword" type="password" minLength={6} placeholder="Repeat password" autoComplete="new-password" required /></label>}
          {!supabaseConfig.isConfigured && <p className="rounded-card bg-orange-50 p-3 text-sm font-semibold text-primary">Supabase environment values are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to use real email auth.</p>}
          {formNotice && <p className="rounded-card bg-orange-50 p-3 text-sm font-semibold text-primary">{formNotice}</p>}
          {(formError || state.auth.error) && <p className="rounded-card bg-red-50 p-3 text-sm font-semibold text-red-700">{formError || state.auth.error}</p>}
          <button className="h-12 rounded-full bg-primary px-6 font-black text-white disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={busy || !supabaseConfig.isConfigured}>
            {busy ? 'Please wait...' : isSignup ? 'Sign up with email' : 'Login with email'}
          </button>
        </form>
      </section>
    </main>
  );
}

export function GuideRegistrationPage() {
  const { state, dispatch } = useAppState();
  const navigate = useNavigate();
  const draft = selectors.guideRegistrationDraft(state);
  const [agree, setAgree] = useState(draft?.agreements ?? [false, false, false]);
  const [draftNotice, setDraftNotice] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  if (['pending-guide', 'guide'].includes(state.auth.user?.role)) return <Navigate to="/mypage/guide-mode" replace />;
  const canSubmit = agree.every(Boolean);
  const saveDraft = (formElement) => {
    const payload = buildGuideApplicationPayload(formElement, { agreements: agree, draftId: draft?.id });
    dispatch({ type: 'SAVE_GUIDE_DRAFT', payload });
    setDraftNotice('Draft saved. 다시 들어와도 입력값이 유지됩니다.');
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="guide-form-stack">
        <h1 className="text-3xl font-black">Guide Registration</h1>
        {draftNotice && <p className="mt-4 rounded-card bg-indigo-50 p-3 text-sm font-bold text-indigo-700">{draftNotice}</p>}
        <form
          className="mt-6 grid gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const formElement = e.currentTarget;
            const payload = buildGuideApplicationPayload(formElement, { agreements: agree });
            setSubmitBusy(true);
            setDraftNotice('');
            try {
              if (getSupabaseConfig().isConfigured) {
                const client = await createBrowserSupabaseClient();
                const application = await submitGuideApplication(client, {
                  payload,
                  formElement,
                  user: state.auth.user
                });
                dispatch({ type: 'SUBMIT_GUIDE_APPLICATION', payload: { ...payload, applicationId: application.id } });
              } else {
                dispatch({ type: 'SUBMIT_GUIDE_APPLICATION', payload });
              }
              navigate('/mypage');
            } catch (error) {
              setDraftNotice(getAuthErrorMessage(error));
            } finally {
              setSubmitBusy(false);
            }
          }}
        >
          {['Guide Terms of Service', 'Code of Conduct', 'Privacy Consent'].map((title, index) => (
            <section className="guide-card" key={title}>
              <h2 className="font-black">{title}</h2>
              <div className="mt-2 h-24 overflow-auto rounded-lg bg-zinc-50 p-3 text-sm text-zinc-500">Blank scrollable consent text for {title}.</div>
              <label className="mt-3 flex items-center gap-2 font-bold">
                <input type="checkbox" checked={agree[index]} onChange={(e) => setAgree((prev) => prev.map((v, i) => i === index ? e.target.checked : v))} />
                I agree
              </label>
            </section>
          ))}
          <GuideFormFields draft={draft} />
          <div className="flex flex-wrap gap-3">
            <button type="button" className="h-12 rounded-full border px-6 font-black" onClick={(event) => saveDraft(event.currentTarget.form)}>Save Draft</button>
            <button className={`h-12 rounded-full bg-primary px-6 font-black text-white ${canSubmit && !submitBusy ? '' : 'pointer-events-none opacity-40'}`}>{submitBusy ? 'Submitting...' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </main>
  );
}

function buildGuideApplicationPayload(formElement, { agreements, draftId } = {}) {
  const form = new FormData(formElement);
  const profilePhoto = form.get('profilePhoto');
  return {
    id: draftId,
    type: 'guide-registration',
    agreements,
    nationality: form.get('nationality') ?? '',
    birthYear: form.get('birthYear') ?? '',
    birthMonth: form.get('birthMonth') ?? '',
    birthDay: form.get('birthDay') ?? '',
    city: form.get('city') ?? '',
    years: form.get('years') ?? '',
    gender: form.get('gender') ?? '',
    nativeLanguage: form.get('nativeLanguage') ?? '',
    additionalLanguages: form.getAll('additionalLanguages'),
    languageLevels: Object.fromEntries([...form.entries()].filter(([key]) => key.startsWith('level-'))),
    intro: form.get('intro') ?? '',
    profilePhotoName: profilePhoto?.name || form.get('savedProfilePhotoName') || '',
    profilePhotoUrl: form.get('profilePhotoUrl') || '',
    idDocumentImageName: form.get('idDocumentImage')?.name || form.get('savedIdDocumentImageName') || ''
  };
}

function GuideFormFields({ draft }) {
  const [nationality, setNationality] = useState(draft?.nationality ?? '');
  const [gender, setGender] = useState(draft?.gender ?? 'Female');
  const [nativeLanguage, setNativeLanguage] = useState(draft?.nativeLanguage ?? '');
  const [additionalLanguage, setAdditionalLanguage] = useState('');
  const [languageTags, setLanguageTags] = useState(() => buildInitialLanguageTags(draft));
  const years = Array.from({ length: 70 }, (_, index) => String(new Date().getFullYear() - 18 - index));
  const months = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
  const days = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));
  const handleNativeLanguageChange = (nextLanguage) => {
    setLanguageTags((tags) => syncNativeLanguageTag(tags, nativeLanguage, nextLanguage));
    setNativeLanguage(nextLanguage);
  };
  const addLanguage = () => {
    if (!guideLanguageOptions.includes(additionalLanguage) || languageTags.some((tag) => tag.language === additionalLanguage)) return;
    setLanguageTags((tags) => [...tags, { language: additionalLanguage, level: 'Beginner' }]);
    setAdditionalLanguage('');
  };

  return (
    <section className="guide-card grid gap-6">
      <DropArea label="Profile photo" name="profilePhoto" savedFileName={draft?.profilePhotoName} savedPhotoUrl={draft?.profilePhotoUrl} />
      <DropArea label="ID document image" name="idDocumentImage" savedFileName={draft?.idDocumentImageName} savedHiddenName="savedIdDocumentImageName" />

      <SearchableInput
        label="Nationality"
        name="nationality"
        options={nationalityOptions}
        placeholder="Search nationality"
        value={nationality}
        onChange={setNationality}
        restrictToOptions
      />

      <div>
        <span className="guide-field-label">Date of Birth</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <select className="guide-chip-select" name="birthYear" aria-label="Year" defaultValue={draft?.birthYear ?? ''}>
            <option>Year (YYYY)</option>
            {years.map((year) => <option key={year}>{year}</option>)}
          </select>
          <select className="guide-chip-select" name="birthMonth" aria-label="Month" defaultValue={draft?.birthMonth ?? ''}>
            <option>Month (MM)</option>
            {months.map((month) => <option key={month}>{month}</option>)}
          </select>
          <select className="guide-chip-select" name="birthDay" aria-label="Day" defaultValue={draft?.birthDay ?? ''}>
            <option>Day (DD)</option>
            {days.map((day) => <option key={day}>{day}</option>)}
          </select>
        </div>
      </div>

      <label className="guide-field-label">City of residence<input className="guide-input mt-2" name="city" placeholder="Seoul" required defaultValue={draft?.city ?? ''} /></label>

      <label className="guide-field-label">Residence years<input className="guide-input mt-2" name="years" type="number" min="0" placeholder="5" defaultValue={draft?.years ?? ''} /></label>

      <div>
        <span className="guide-field-label">Gender</span>
        <input type="hidden" name="gender" value={gender} />
        <div className="mt-2 flex flex-wrap gap-2">
          {['Female', 'Male', 'Non-binary'].map((item) => (
            <button
              className={`guide-gender-pill ${gender === item ? 'selected' : ''}`}
              type="button"
              onClick={() => setGender(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <SearchableInput
        label="Native language"
        name="nativeLanguage"
        options={guideLanguageOptions}
        placeholder="Search native language"
        value={nativeLanguage}
        onChange={handleNativeLanguageChange}
        restrictToOptions
      />

      <div>
        <span className="guide-field-label">Additional languages</span>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
          <SearchInputOnly
            name="additionalLanguageSearch"
            options={guideLanguageOptions}
            placeholder="Search additional language"
            value={additionalLanguage}
            onChange={setAdditionalLanguage}
            restrictToOptions
          />
          <button
            className="h-12 rounded-full bg-indigo-600 px-6 font-black text-white shadow-[0_8px_18px_rgba(79,70,229,0.22)] disabled:cursor-not-allowed disabled:opacity-40"
            type="button"
            disabled={!guideLanguageOptions.includes(additionalLanguage) || languageTags.some((tag) => tag.language === additionalLanguage)}
            onClick={addLanguage}
          >
            Add
          </button>
        </div>
        <div className="mt-3 grid gap-2">
          {languageTags.map((tag) => (
            <div className="guide-language-tag" key={tag.language}>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-white hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-30"
                type="button"
                aria-label={`Remove ${tag.language}`}
                disabled={tag.language === nativeLanguage && tag.level === 'Native'}
                onClick={() => setLanguageTags((tags) => tags.filter((item) => item.language !== tag.language))}
              >
                ×
              </button>
              <input type="hidden" name="additionalLanguages" value={tag.language} />
              {tag.language === nativeLanguage && tag.level === 'Native' && <input type="hidden" name={`level-${tag.language}`} value="Native" />}
              <span className="font-black text-zinc-800">{tag.language}</span>
              <select
                className="guide-level-select"
                name={`level-${tag.language}`}
                value={tag.level}
                disabled={tag.language === nativeLanguage && tag.level === 'Native'}
                onChange={(event) => setLanguageTags((tags) => tags.map((item) => item.language === tag.language ? { ...item, level: event.target.value } : item))}
              >
                {['Beginner', 'Conversational', 'Semi-professional', 'Native'].map((level) => <option key={level}>{level}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <label className="guide-field-label">Self-introduction<textarea className="guide-input mt-2 min-h-[180px]" name="intro" placeholder="Tell travelers about your local style, favorite routes, and hosting approach." defaultValue={draft?.intro ?? ''} /></label>
    </section>
  );
}

function buildInitialLanguageTags(draft) {
  const savedTags = draft?.additionalLanguages?.map((language) => ({
    language,
    level: draft.languageLevels?.[`level-${language}`] ?? 'Beginner'
  })) ?? [];
  return syncNativeLanguageTag(savedTags, '', draft?.nativeLanguage ?? '');
}

function syncNativeLanguageTag(tags, previousNativeLanguage, nextNativeLanguage) {
  const withoutPreviousNative = previousNativeLanguage
    ? tags.filter((tag) => !(tag.language === previousNativeLanguage && tag.level === 'Native'))
    : tags;
  if (!guideLanguageOptions.includes(nextNativeLanguage)) return withoutPreviousNative;

  return [
    { language: nextNativeLanguage, level: 'Native' },
    ...withoutPreviousNative.filter((tag) => tag.language !== nextNativeLanguage)
  ];
}

function DropArea({ label, name, savedFileName = '', savedPhotoUrl = '', savedHiddenName = 'savedProfilePhotoName' }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(savedPhotoUrl);
  const [photoUrl, setPhotoUrl] = useState(savedPhotoUrl);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const clearSelection = () => {
    setFile(null);
    setError('');
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPhotoUrl('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const assignFileToInput = (nextFile) => {
    if (!inputRef.current) return;
    if (typeof DataTransfer === 'undefined') return;
    const transfer = new DataTransfer();
    transfer.items.add(nextFile);
    inputRef.current.files = transfer.files;
  };

  const selectFile = (nextFile) => {
    const result = validateGuideProfilePhoto(nextFile);
    if (!result.ok) {
      clearSelection();
      setError(result.error);
      return;
    }

    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setPhotoUrl('');
    setError('');
    assignFileToInput(nextFile);
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result || ''));
    reader.onerror = () => setError('Could not read this image. Please try another file.');
    reader.readAsDataURL(nextFile);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div>
      <label
        className={`guide-photo-dropzone ${isDragging ? 'is-dragging' : ''} ${previewUrl ? 'has-preview' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          className="sr-only"
          name={name}
          type="file"
          accept="image/*"
          required={!photoUrl}
          onChange={(event) => selectFile(event.target.files?.[0])}
        />
        <input type="hidden" name={savedHiddenName} value={savedFileName} />
        {name === 'profilePhoto' && <input type="hidden" name="profilePhotoUrl" value={photoUrl} />}
        {previewUrl ? (
          <>
            <img className="guide-photo-preview" src={previewUrl} alt="Selected profile preview" />
            <span className="guide-photo-copy">
              <b>{file?.name || savedFileName || label}</b>
              <small>{file ? `${formatFileSize(file.size)} selected` : 'Saved profile photo'}</small>
            </span>
          </>
        ) : (
          <>
            <span className="guide-photo-icon"><Upload size={28} /></span>
            <span className="guide-photo-copy">
              <b>{label}</b>
              <small>{savedFileName ? `Saved draft: ${savedFileName}` : 'Click or drag to upload'}</small>
              <em>Image file, up to 5MB</em>
            </span>
          </>
        )}
      </label>
      <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2">
        {error ? <p className="text-sm font-bold text-red-600">{error}</p> : <p className="text-sm font-semibold text-zinc-500">얼굴이 잘 보이는 프로필 사진을 올려주세요.</p>}
        {file && <button className="h-8 rounded-full border border-zinc-200 px-4 text-sm font-black text-zinc-600" type="button" onClick={clearSelection}>Remove</button>}
      </div>
    </div>
  );
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function SearchableInput({ label, name, options, placeholder, value, onChange, restrictToOptions }) {
  return (
    <label className="guide-field-label">
      {label}
      <SearchInputOnly name={name} options={options} placeholder={placeholder} value={value} onChange={onChange} restrictToOptions={restrictToOptions} />
    </label>
  );
}

function SearchInputOnly({ name, options, placeholder, value, onChange, restrictToOptions = false }) {
  const listId = `${name}-options`;
  const isControlled = value !== undefined && typeof onChange === 'function';
  const handleBlur = (event) => {
    if (restrictToOptions && event.target.value && !options.includes(event.target.value)) onChange?.('');
  };

  return (
    <span className="relative mt-2 block">
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={18} />
      <input
        className="guide-input w-full pl-11"
        name={name}
        list={listId}
        placeholder={placeholder}
        {...(isControlled ? { value, onChange: (event) => onChange(event.target.value) } : {})}
        onBlur={handleBlur}
        aria-describedby={restrictToOptions ? `${name}-hint` : undefined}
      />
      <datalist id={listId}>{options.map((option) => <option value={option} key={option} />)}</datalist>
      {restrictToOptions && <span className="mt-1 block text-xs font-semibold text-zinc-500" id={`${name}-hint`}>목록에 있는 언어만 입력할 수 있습니다.</span>}
    </span>
  );
}

export function MyPage() {
  const { state, dispatch } = useAppState();
  const navigate = useNavigate();
  const registeredGuide = isRegisteredGuideRole(state.auth.user.role);
  const menu = [
    { label: 'My Bookings', path: '/mypage/bookings', description: 'Upcoming reservations and trip chats', Icon: CalendarDays, tone: 'orange' },
    { label: 'Past Trips', path: '/mypage/past-trips', description: 'Completed travel history in one place', Icon: Check, tone: 'green' },
    { label: 'Review Management', path: '/mypage/reviews', description: 'Write, edit, and track your reviews', Icon: MessageCircle, tone: 'blue' },
    { label: 'Local Guide Mode', path: registeredGuide ? '/mypage/guide-mode' : '/register-guide', description: 'Manage guide profile, tours, and drafts', Icon: Star, tone: 'indigo' },
    !registeredGuide && { label: 'Become a Guide', path: '/register-guide', description: 'Apply to host local experiences', Icon: Heart, tone: 'rose' },
    { label: 'Account Settings', path: '/mypage/settings', description: 'Profile, contact, and guide details', Icon: SlidersHorizontal, tone: 'zinc' },
    { label: 'View Profile', path: '/mypage/profile', description: 'Preview what others can see', Icon: Camera, tone: 'yellow' }
  ].filter(Boolean);
  const roleLabel = formatRoleLabel(state.auth.user.role);
  const logout = () => {
    dispatch({ type: 'LOGOUT' });
    navigate('/');
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <section className="mypage-hero">
        <div className="mypage-identity">
          <ProfileAvatar src={state.auth.user.avatar} className="h-20 w-20 shrink-0 text-primary" />
          <div className="min-w-0">
            <span className="mypage-kicker">My Page</span>
            <h1>{state.auth.user.name}</h1>
            <div className="mypage-meta-row">
              <span className="mypage-role-badge">{roleLabel}</span>
              {state.auth.user.email && <span className="mypage-email">{state.auth.user.email}</span>}
            </div>
          </div>
        </div>
        <button className="mypage-logout" type="button" onClick={logout}>
          Log out
        </button>
      </section>
      <div className="mypage-action-grid">
        {menu.map(({ label, path, description, Icon, tone }) => (
          <Link className="mypage-action-card" to={path} key={label}>
            <span className={`mypage-action-icon ${tone}`}>
              <Icon size={22} strokeWidth={2.4} />
            </span>
            <span className="mypage-action-copy">
              <b>{label}</b>
              <small>{description}</small>
            </span>
            <ChevronRight className="mypage-action-arrow" size={22} />
          </Link>
        ))}
      </div>
    </main>
  );
}

export function MyBookingsPage() {
  const { state } = useAppState();
  return <SimpleMyPagePanel title="My Bookings" items={state.bookings.map((booking) => `${booking.id} · ${booking.date} · ${booking.status}`)} empty="Enjoy your travels!" />;
}

export function PastTripsPage() {
  const { state } = useAppState();
  return <SimpleMyPagePanel title="Past Trips" items={state.bookings.filter((booking) => booking.status === 'completed').map((booking) => `${booking.id} · ${booking.date}`)} empty="Past trips will appear here." />;
}

export function ReviewManagementPage() {
  const { state } = useAppState();
  return <SimpleMyPagePanel title="Review Management" items={state.reviewsWritten.map((review) => review.title || review.id)} empty="Reviews you write will appear here." />;
}

export function ViewProfilePage() {
  const { state } = useAppState();
  return <ProfileSummaryPanel user={state.auth.user} guideProfile={state.guideProfile} />;
}

export function AccountSettingsPage() {
  const { state, dispatch } = useAppState();
  const [searchParams, setSearchParams] = useSearchParams();
  const legacyMode = searchParams.get('mode');
  const requestedSection = searchParams.get('section') || (legacyMode === 'guide' ? 'guide-profile' : 'personal-info');
  const requestedEdit = searchParams.get('edit') === '1';
  const [activeSection, setActiveSection] = useState(requestedSection);
  const [isEditing, setIsEditing] = useState(requestedEdit);
  const [profileNotice, setProfileNotice] = useState('');
  const memberNameParts = splitDisplayName(state.auth.user.name);
  const accountSettings = state.accountSettings ?? {};
  const settingsSections = getAccountSettingsSections({ user: state.auth.user, guideProfile: state.guideProfile });
  useEffect(() => {
    setActiveSection(requestedSection);
    setIsEditing(requestedEdit);
  }, [requestedSection, requestedEdit]);
  useEffect(() => {
    let active = true;
    async function loadAccountSettings() {
      if (!state.auth.user?.id || !getSupabaseConfig().isConfigured) return;
      try {
        const client = await createBrowserSupabaseClient();
        const row = await fetchAccountSettings(client, state.auth.user.id);
        if (active && row) {
          dispatch({
            type: 'UPDATE_ACCOUNT_SETTINGS',
            payload: {
              preferences: row.preferences,
              notifications: row.notifications,
              privacy: row.privacy,
              security: row.security
            }
          });
        }
      } catch {
        // Local settings remain available if account settings have not been created yet.
      }
    }
    loadAccountSettings();
    return () => {
      active = false;
    };
  }, [dispatch, state.auth.user?.id]);
  const openSettingsSection = (section, editing = false) => {
    setSearchParams(editing ? { section, edit: '1' } : { section });
  };
  const saveAccountSettings = (payload, message = '설정이 저장됐습니다.') => {
    dispatch({ type: 'UPDATE_ACCOUNT_SETTINGS', payload });
    if (state.auth.user?.id && getSupabaseConfig().isConfigured) {
      createBrowserSupabaseClient()
        .then((client) => upsertAccountSettings(client, {
          profileId: state.auth.user.id,
          settings: {
            ...(state.accountSettings ?? {}),
            ...payload
          }
        }))
        .catch(() => {});
    }
    setProfileNotice(message);
  };
  const saveNotificationSettings = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    saveAccountSettings({
      notifications: {
        bookingEmail: form.has('bookingEmail'),
        bookingSms: form.has('bookingSms'),
        messageEmail: form.has('messageEmail'),
        messagePush: form.has('messagePush'),
        guideEmail: form.has('guideEmail'),
        marketingEmail: form.has('marketingEmail')
      }
    }, '알림 설정이 저장됐습니다.');
  };
  const savePreferenceSettings = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    saveAccountSettings({
      preferences: {
        language: form.get('language'),
        currency: form.get('currency'),
        timezone: form.get('timezone'),
        distanceUnit: form.get('distanceUnit')
      }
    }, '표시 설정이 저장됐습니다.');
  };
  const savePrivacySettings = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    saveAccountSettings({
      privacy: {
        profileVisibility: form.get('profileVisibility'),
        showReviews: form.has('showReviews'),
        showLocation: form.has('showLocation'),
        allowDataPersonalization: form.has('allowDataPersonalization')
      }
    }, '개인정보 설정이 저장됐습니다.');
  };
  const saveSecuritySettings = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    saveAccountSettings({
      security: {
        twoFactorEnabled: form.has('twoFactorEnabled'),
        loginAlerts: form.has('loginAlerts')
      }
    }, '보안 설정이 저장됐습니다.');
  };
  const saveMemberProfile = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get('firstName') || '').trim();
    const lastName = String(form.get('lastName') || '').trim();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    if (password && password !== confirmPassword) {
      setProfileNotice('비밀번호가 일치하지 않습니다.');
      return;
    }
    try {
      const name = buildSignupDisplayName(firstName, lastName);
      const authUpdates = {};
      if (email && email !== state.auth.user.email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      if (getSupabaseConfig().isConfigured && Object.keys(authUpdates).length > 0) {
        const client = await createBrowserSupabaseClient();
        const { error } = await client.auth.updateUser(authUpdates);
        if (error) throw error;
      }
      dispatch({
        type: 'UPDATE_USER_PROFILE',
        payload: {
          name,
          email,
          avatar: state.auth.user.avatar
        }
      });
      setProfileNotice('일반 회원 프로필이 저장됐습니다.');
      openSettingsSection('personal-info', false);
    } catch (error) {
      setProfileNotice(getAuthErrorMessage(error));
    }
  };
  const saveGuideProfile = (event) => {
    event.preventDefault();
    const { type: _draftType, ...payload } = buildGuideApplicationPayload(event.currentTarget);
    dispatch({
      type: 'UPDATE_GUIDE_PROFILE',
      payload: {
        ...payload,
        id: state.guideProfile?.id,
        profilePhotoUrl: payload.profilePhotoUrl || state.guideProfile?.profilePhotoUrl || state.auth.user.avatar,
        profilePhotoName: payload.profilePhotoName || state.guideProfile?.profilePhotoName || ''
      }
    });
    setProfileNotice('가이드 프로필이 저장됐습니다.');
    openSettingsSection('guide-profile', false);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <section className="settings-page-shell">
        <div className="settings-page-header">
          <div>
            <h1>Account Settings</h1>
            <p>{state.auth.user.email || 'Manage your Local Way account'}</p>
          </div>
          <Link className="settings-back-link" to="/mypage">Back to My Page</Link>
        </div>
        {profileNotice && <p className="mt-4 rounded-card bg-orange-50 p-3 text-sm font-bold text-primary">{profileNotice}</p>}
        <div className="settings-layout">
          <aside className="settings-nav" aria-label="Account settings sections">
            {settingsSections.map(({ id, label, description, Icon }) => (
              <button className={`settings-nav-item ${activeSection === id ? 'active' : ''}`} type="button" onClick={() => openSettingsSection(id, false)} key={id}>
                <Icon size={20} />
                <span>
                  <b>{label}</b>
                  <small>{description}</small>
                </span>
              </button>
            ))}
          </aside>
          <section className="settings-content-panel">
            <SettingsSectionHeader
              section={settingsSections.find((section) => section.id === activeSection) ?? settingsSections[0]}
              canEdit={['personal-info', 'guide-profile'].includes(activeSection)}
              isEditing={isEditing}
              onEdit={() => openSettingsSection(activeSection, !isEditing)}
            />
            {activeSection === 'personal-info' && (!isEditing ? (
              <AccountSettingsReadOnly user={state.auth.user} guideProfile={state.guideProfile} mode="member" />
            ) : (
              <form className="settings-auth-form mt-5" onSubmit={saveMemberProfile}>
                <div className="auth-name-grid">
                  <label className="guide-field-label">First name<input className="guide-input mt-2" name="firstName" defaultValue={memberNameParts.firstName} autoComplete="given-name" required /></label>
                  <label className="guide-field-label">Last name<input className="guide-input mt-2" name="lastName" defaultValue={memberNameParts.lastName} autoComplete="family-name" required /></label>
                </div>
                <label className="guide-field-label">Email<input className="guide-input mt-2" name="email" type="email" defaultValue={state.auth.user.email || ''} autoComplete="email" required /></label>
                <label className="guide-field-label">Password<input className="guide-input mt-2" name="password" type="password" minLength={6} placeholder="Leave blank to keep current password" autoComplete="new-password" /></label>
                <label className="guide-field-label">Confirm password<input className="guide-input mt-2" name="confirmPassword" type="password" minLength={6} placeholder="Repeat password" autoComplete="new-password" /></label>
                <button className="settings-save-button">Save member profile</button>
              </form>
            ))}
            {activeSection === 'login-security' && (
              <form className="settings-form-stack" onSubmit={saveSecuritySettings}>
                <SettingsToggle name="twoFactorEnabled" title="Two-step verification" description="Require an additional check when signing in." defaultChecked={accountSettings.security?.twoFactorEnabled} />
                <SettingsToggle name="loginAlerts" title="Login alerts" description="Notify me when a new device signs in." defaultChecked={accountSettings.security?.loginAlerts} />
                <SettingsInfoRows rows={[['Password', 'Managed in Personal information edit'], ['Recovery email', state.auth.user.email || '-'], ['Signed-in devices', 'Current browser session']]} />
                <button className="settings-save-button">Save security settings</button>
              </form>
            )}
            {activeSection === 'payments' && <SettingsInfoRows rows={[['Payment methods', 'No saved payment method'], ['Payment history', `${state.bookings.length} booking records`], ['Refunds', 'No refund requests'], ['Default currency', state.currency]]} />}
            {activeSection === 'payouts' && <SettingsInfoRows rows={[['Payout method', 'Not added'], ['Payout history', 'No payouts yet'], ['Service fee', 'Platform fee rules will appear here'], ['Tax information', 'Not submitted']]} />}
            {activeSection === 'notifications' && (
              <form className="settings-form-stack" onSubmit={saveNotificationSettings}>
                <SettingsToggle name="bookingEmail" title="Booking emails" description="Reservation confirmations, changes, and cancellations." defaultChecked={accountSettings.notifications?.bookingEmail} />
                <SettingsToggle name="bookingSms" title="Booking SMS" description="Time-sensitive reservation messages." defaultChecked={accountSettings.notifications?.bookingSms} />
                <SettingsToggle name="messageEmail" title="Message emails" description="Traveler and guide message summaries." defaultChecked={accountSettings.notifications?.messageEmail} />
                <SettingsToggle name="messagePush" title="Push notifications" description="Real-time message and trip reminders." defaultChecked={accountSettings.notifications?.messagePush} />
                <SettingsToggle name="guideEmail" title="Guide activity emails" description="Application, draft, and tour activity updates." defaultChecked={accountSettings.notifications?.guideEmail} />
                <SettingsToggle name="marketingEmail" title="Marketing emails" description="Offers, city guides, and product news." defaultChecked={accountSettings.notifications?.marketingEmail} />
                <button className="settings-save-button">Save notification settings</button>
              </form>
            )}
            {activeSection === 'privacy' && (
              <form className="settings-form-stack" onSubmit={savePrivacySettings}>
                <label className="guide-field-label">Profile visibility<select className="guide-input mt-2" name="profileVisibility" defaultValue={accountSettings.privacy?.profileVisibility ?? 'public'}><option value="public">Public</option><option value="verified">Verified members only</option><option value="private">Private</option></select></label>
                <SettingsToggle name="showReviews" title="Show reviews" description="Display reviews connected to your profile." defaultChecked={accountSettings.privacy?.showReviews} />
                <SettingsToggle name="showLocation" title="Show location" description="Display your country or guide city where relevant." defaultChecked={accountSettings.privacy?.showLocation} />
                <SettingsToggle name="allowDataPersonalization" title="Personalized recommendations" description="Use account activity to improve search and tour suggestions." defaultChecked={accountSettings.privacy?.allowDataPersonalization} />
                <button className="settings-save-button">Save privacy settings</button>
              </form>
            )}
            {activeSection === 'verification' && <SettingsInfoRows rows={[['Email', state.auth.user.email ? 'Verified account email' : 'Not added'], ['Phone', state.auth.user.phone ? 'Added' : 'Not added'], ['Identity verification', state.guideProfile ? 'Required for guide approval' : 'Not started'], ['Guide status', formatRoleLabel(state.auth.user.role)] ]} />}
            {activeSection === 'preferences' && (
              <form className="settings-form-grid" onSubmit={savePreferenceSettings}>
                <label className="guide-field-label">Language<select className="guide-input mt-2" name="language" defaultValue={accountSettings.preferences?.language ?? 'en'}><option value="en">English</option><option value="ko">Korean</option><option value="ja">Japanese</option><option value="zh">Chinese</option></select></label>
                <label className="guide-field-label">Currency<select className="guide-input mt-2" name="currency" defaultValue={accountSettings.preferences?.currency ?? state.currency}>{majorCurrencyOptions.map((currency) => <option value={currency.code} key={currency.code}>{currency.label}</option>)}</select></label>
                <label className="guide-field-label">Time zone<select className="guide-input mt-2" name="timezone" defaultValue={accountSettings.preferences?.timezone ?? 'Asia/Seoul'}><option value="Asia/Seoul">Asia/Seoul</option><option value="America/New_York">America/New_York</option><option value="Europe/London">Europe/London</option><option value="Europe/Paris">Europe/Paris</option><option value="Asia/Tokyo">Asia/Tokyo</option></select></label>
                <label className="guide-field-label">Distance unit<select className="guide-input mt-2" name="distanceUnit" defaultValue={accountSettings.preferences?.distanceUnit ?? 'km'}><option value="km">Kilometers</option><option value="mi">Miles</option></select></label>
                <button className="settings-save-button">Save preferences</button>
              </form>
            )}
            {activeSection === 'guide-profile' && (!isEditing ? (
              <AccountSettingsReadOnly user={state.auth.user} guideProfile={state.guideProfile} mode="guide" />
            ) : (
              <form className="mt-5 grid gap-5" onSubmit={saveGuideProfile}>
                <GuideFormFields draft={state.guideProfile} />
                <button className="settings-save-button">Save guide profile</button>
              </form>
            ))}
            {activeSection === 'account-management' && (
              <div className="settings-form-stack">
                <SettingsInfoRows rows={[['Session', 'Browser session is kept only until the browser is closed'], ['Account data', 'Download and deletion controls will use verified account ownership'], ['Support', 'Account help and dispute requests']]} />
                <button className="settings-danger-button" type="button" disabled><Trash2 size={18} /> Delete account</button>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function getAccountSettingsSections({ user, guideProfile }) {
  const showGuideItems = isRegisteredGuideRole(user?.role) || Boolean(guideProfile);
  return [
    { id: 'personal-info', label: 'Personal information', description: 'Name, email, profile', Icon: UserRound },
    { id: 'login-security', label: 'Login & security', description: 'Password, alerts, sessions', Icon: LockKeyhole },
    { id: 'payments', label: 'Payments', description: 'Methods, history, refunds', Icon: CreditCard },
    ...(showGuideItems ? [{ id: 'payouts', label: 'Payouts', description: 'Receiving, fees, tax', Icon: WalletCards }] : []),
    { id: 'notifications', label: 'Notifications', description: 'Email, SMS, push', Icon: Bell },
    { id: 'privacy', label: 'Privacy', description: 'Visibility and data use', Icon: ShieldCheck },
    { id: 'verification', label: 'Verification', description: 'Identity and guide status', Icon: BadgeCheck },
    { id: 'preferences', label: 'Preferences', description: 'Language, currency, units', Icon: Globe2 },
    ...(showGuideItems ? [{ id: 'guide-profile', label: 'Guide profile', description: 'Application form details', Icon: SlidersHorizontal }] : []),
    { id: 'account-management', label: 'Account management', description: 'Session, export, delete', Icon: Trash2 }
  ];
}

function SettingsSectionHeader({ section, canEdit, isEditing, onEdit }) {
  return (
    <div className="settings-section-header">
      <div>
        <h2>{section.label}</h2>
        <p>{section.description}</p>
      </div>
      {canEdit && (
        <button className="settings-edit-button" type="button" onClick={onEdit}>
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      )}
    </div>
  );
}

function SettingsToggle({ name, title, description, defaultChecked }) {
  return (
    <label className="settings-toggle-row">
      <span>
        <b>{title}</b>
        <small>{description}</small>
      </span>
      <input type="checkbox" name={name} defaultChecked={Boolean(defaultChecked)} />
    </label>
  );
}

function SettingsInfoRows({ rows }) {
  return (
    <div className="settings-info-rows">
      {rows.map(([label, value]) => (
        <div className="settings-info-row" key={label}>
          <span>{label}</span>
          <b>{value || '-'}</b>
        </div>
      ))}
    </div>
  );
}

function AccountSettingsReadOnly({ user, guideProfile, mode }) {
  if (mode === 'guide') {
    if (!guideProfile) {
      return (
        <div className="settings-read-panel">
          <p>가이드 프로필이 아직 없습니다.</p>
        </div>
      );
    }

    return (
      <div className="settings-read-panel">
        <div className="settings-read-identity">
          <ProfileAvatar src={guideProfile.profilePhotoUrl || user.avatar} className="h-20 w-20 text-primary" />
          <div>
            <b>{user.name || 'Unnamed member'}</b>
            <span>{guideProfile.city || '-'}</span>
          </div>
        </div>
        <div className="profile-info-list mt-4">
          <ProfileInfoRow label="Nationality" value={guideProfile.nationality} />
          <ProfileInfoRow label="Residence years" value={guideProfile.years} />
          <ProfileInfoRow label="Gender" value={guideProfile.gender} />
          <ProfileInfoRow label="Native language" value={guideProfile.nativeLanguage} />
          <ProfileInfoRow label="Additional languages" value={(guideProfile.additionalLanguages || []).join(', ')} />
          <ProfileInfoRow label="Guide introduction" value={guideProfile.intro} />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-read-panel">
      <div className="settings-read-identity">
        <ProfileAvatar src={user.avatar} className="h-20 w-20 text-primary" />
        <div>
          <b>{user.name || 'Unnamed member'}</b>
          <span>{user.email || '-'}</span>
        </div>
      </div>
      <div className="profile-info-list mt-4">
        <ProfileInfoRow label="Phone" value={user.phone} />
        <ProfileInfoRow label="Country" value={user.country} />
        <ProfileInfoRow label="Bio" value={user.bio} />
      </div>
    </div>
  );
}

function SimpleMyPagePanel({ title, items, empty }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <section className="rounded-card bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black">{title}</h1>
          <Link className="h-10 rounded-full border px-4 py-2 text-sm font-black text-zinc-600" to="/mypage">Back to My Page</Link>
        </div>
        {items.length ? items.map((item) => <p className="mt-3 rounded-lg bg-zinc-50 p-3 font-semibold" key={item}>{item}</p>) : <p className="mt-3 text-zinc-500">{empty}</p>}
      </section>
    </main>
  );
}

function ProfileSummaryPanel({ user, guideProfile }) {
  const memberDetails = [
    ['Email', user.email],
    ['Phone', user.phone],
    ['Country', user.country]
  ];
  const guideDetails = guideProfile ? [
    ['Status', guideProfile.status],
    ['City', guideProfile.city],
    ['Nationality', guideProfile.nationality],
    ['Residence', guideProfile.years ? `${guideProfile.years} years` : ''],
    ['Native language', guideProfile.nativeLanguage],
    ['Languages', guideProfile.additionalLanguages?.join(', ')]
  ] : [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <section className="profile-hero">
        <div className="profile-hero-main">
          <ProfileAvatar src={user.avatar} className="h-28 w-28 text-primary" />
          <div className="min-w-0">
            <span className="profile-role-badge">{formatRoleLabel(user.role)}</span>
            <h1>{user.name || 'Unnamed member'}</h1>
            {user.bio && <p>{user.bio}</p>}
          </div>
        </div>
        <div className="profile-hero-actions">
          <Link className="profile-secondary-link" to="/mypage">Back</Link>
          <Link className="profile-primary-link" to="/mypage/settings?section=personal-info&edit=1">Edit profile</Link>
        </div>
      </section>

      <div className="profile-detail-grid">
        <section className="profile-panel">
          <div className="profile-panel-header">
            <h2>Member Profile</h2>
            <span>Account</span>
          </div>
          <div className="profile-info-list">
            {memberDetails.map(([label, value]) => <ProfileInfoRow label={label} value={value} key={label} />)}
          </div>
        </section>

        <section className="profile-panel">
          <div className="profile-panel-header">
            <h2>Guide Profile</h2>
            {guideProfile ? <Link to="/mypage/settings?section=guide-profile&edit=1">Edit guide</Link> : <span>Not applied</span>}
          </div>
          {guideProfile ? (
            <>
              <div className="profile-guide-card">
                <ProfileAvatar src={guideProfile.profilePhotoUrl || user.avatar} className="h-16 w-16 text-primary" />
                <div>
                  <b>{guideProfile.city || 'City not added'}</b>
                  {guideProfile.intro && <p>{guideProfile.intro}</p>}
                </div>
              </div>
              <div className="profile-info-list mt-4">
                {guideDetails.map(([label, value]) => <ProfileInfoRow label={label} value={value} key={label} />)}
              </div>
            </>
          ) : (
            <div className="profile-empty-state">
              <p>가이드 프로필이 아직 없습니다.</p>
              <Link to="/register-guide">Become a guide</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ProfileInfoRow({ label, value }) {
  return (
    <div className="profile-info-row">
      <span>{label}</span>
      <b className={value ? '' : 'empty'}>{value || '-'}</b>
    </div>
  );
}

function MyPageGuidePanel({ user, guideProfile, bookings, drafts }) {
  if (!guideProfile) {
    return (
      <section className="mt-6 rounded-card bg-white p-5 shadow-soft">
        <h2 className="text-xl font-black">Local Guide Mode</h2>
        <p className="mt-3 text-zinc-500">가이드 신청 후 이 영역에서 가이드 정보를 관리할 수 있습니다.</p>
        <Link className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 font-black text-white" to="/register-guide">Register as guide</Link>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-card bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <ProfileAvatar src={guideProfile.profilePhotoUrl || user.avatar} className="h-16 w-16 text-primary" />
          <div>
            <h2 className="text-xl font-black">Local Guide Mode</h2>
            <p className="text-sm font-semibold text-zinc-500">{user.name} · {guideProfile.city || 'Profile city'}</p>
          </div>
        </div>
        <Link className="h-11 rounded-full bg-primary px-5 py-2.5 font-black text-white" to="/mypage/guide-mode/new">New Tour</Link>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Panel title="Upcoming Bookings" items={bookings.map((booking) => `${booking.date} ${booking.time}`)} />
        <Panel title="Saved Drafts" items={drafts.map((draft) => draft.title || draft.type || draft.id)} />
      </div>
    </section>
  );
}

function GuideProfileEditor({ profile, fallbackAvatar, onSubmit }) {
  if (!profile) {
    return (
      <div className="mt-5 rounded-card bg-zinc-50 p-5">
        <p className="font-bold text-zinc-700">가이드 프로필이 아직 없습니다. 먼저 가이드 신청서를 작성해주세요.</p>
        <Link className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 font-black text-white" to="/register-guide">Register as guide</Link>
      </div>
    );
  }

  return (
    <form className="profile-edit-grid mt-5" onSubmit={onSubmit}>
      <ProfilePhotoEditor name="profilePhotoUrl" fileNameName="profilePhotoName" src={profile.profilePhotoUrl || fallbackAvatar} label="Guide photo" />
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="guide-field-label">Nationality<input className="guide-input mt-2" name="nationality" defaultValue={profile.nationality || ''} list="mypage-nationality-options" /></label>
          <label className="guide-field-label">City<input className="guide-input mt-2" name="city" defaultValue={profile.city || ''} placeholder="Seoul" /></label>
        </div>
        <datalist id="mypage-nationality-options">{nationalityOptions.map((option) => <option value={option} key={option} />)}</datalist>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="guide-field-label">Birth year<input className="guide-input mt-2" name="birthYear" defaultValue={profile.birthYear || ''} placeholder="1995" /></label>
          <label className="guide-field-label">Birth month<input className="guide-input mt-2" name="birthMonth" defaultValue={profile.birthMonth || ''} placeholder="07" /></label>
          <label className="guide-field-label">Birth day<input className="guide-input mt-2" name="birthDay" defaultValue={profile.birthDay || ''} placeholder="05" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="guide-field-label">Residence years<input className="guide-input mt-2" name="years" type="number" min="0" defaultValue={profile.years || ''} /></label>
          <label className="guide-field-label">Gender<input className="guide-input mt-2" name="gender" defaultValue={profile.gender || ''} /></label>
          <label className="guide-field-label">Native language<input className="guide-input mt-2" name="nativeLanguage" defaultValue={profile.nativeLanguage || ''} list="mypage-language-options" /></label>
        </div>
        <datalist id="mypage-language-options">{guideLanguageOptions.map((option) => <option value={option} key={option} />)}</datalist>
        <label className="guide-field-label">Additional languages<input className="guide-input mt-2" name="additionalLanguagesText" defaultValue={(profile.additionalLanguages || []).join(', ')} placeholder="English, Japanese" /></label>
        <label className="guide-field-label">Guide introduction<textarea className="guide-input mt-2 min-h-32" name="intro" defaultValue={profile.intro || ''} /></label>
        <button className="h-12 rounded-full bg-primary px-6 font-black text-white">Save guide profile</button>
      </div>
    </form>
  );
}

function ProfilePhotoEditor({ name, fileNameName, src, label }) {
  const [preview, setPreview] = useState(src || '');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const handleFile = (event) => {
    const file = event.target.files?.[0];
    const result = validateGuideProfilePhoto(file);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(String(reader.result || ''));
      setFileName(file.name);
      setError('');
    };
    reader.onerror = () => setError('Could not read this image. Please try another file.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="profile-photo-editor">
      <ProfileAvatar src={preview} className="h-28 w-28 text-primary" />
      <b>{label}</b>
      <label className="inline-flex h-10 cursor-pointer items-center rounded-full border border-zinc-300 px-4 text-sm font-black text-zinc-700 hover:border-primary hover:text-primary">
        Change photo
        <input className="sr-only" type="file" accept="image/*" onChange={handleFile} />
      </label>
      <input type="hidden" name={name} value={preview} />
      {fileNameName && <input type="hidden" name={fileNameName} value={fileName} />}
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
    </div>
  );
}

function splitCsv(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function splitDisplayName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1)
  };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatCalendarDate(date) {
  return date.toISOString().slice(0, 10);
}

function getCalendarCells(monthDate) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = addDays(firstDay, -firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function GuideAvailabilityCalendar({ selectedDates, startDate, endDate, onSelect, monthDate, setMonthDate }) {
  const cells = useMemo(() => getCalendarCells(monthDate), [monthDate]);
  const selectedSet = useMemo(() => new Set(selectedDates), [selectedDates]);
  const previewDates = useMemo(() => {
    if (!startDate) return [];
    try {
      return expandDateRange(startDate, endDate || startDate);
    } catch {
      return [];
    }
  }, [endDate, startDate]);
  const previewSet = useMemo(() => new Set(previewDates), [previewDates]);
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="availability-calendar">
      <div className="availability-calendar-header">
        <button type="button" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} aria-label="Previous month">‹</button>
        <b>{monthLabel}</b>
        <button type="button" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} aria-label="Next month">›</button>
      </div>
      <div className="availability-weekdays">
        {weekdays.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="availability-days">
        {cells.map((date) => {
          const value = formatCalendarDate(date);
          const outsideMonth = date.getMonth() !== monthDate.getMonth();
          const disabled = value < today;
          const isSaved = selectedSet.has(value);
          const isPreview = previewSet.has(value);
          return (
            <button
              className={`availability-day ${outsideMonth ? 'outside' : ''} ${isSaved ? 'saved' : ''} ${isPreview ? 'preview' : ''}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(value)}
              key={value}
            >
              <span>{date.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GuideModePage() {
  const { state, dispatch } = useAppState();
  const guideAvatar = state.guideProfile?.profilePhotoUrl || state.auth.user?.avatar;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${today}T00:00:00`));
  const [availabilityNotice, setAvailabilityNotice] = useState('');
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const unavailableDates = selectors.guideUnavailableDates(state);
  const tourDrafts = selectors.guideTourDrafts(state);
  const guideOverview = getGuideModeOverview({
    bookings: state.bookings,
    drafts: tourDrafts,
    unavailableDates,
    reviewsWritten: state.reviewsWritten
  });
  const guideSections = getGuideModeSections();
  const pendingDates = useMemo(() => {
    if (!startDate) return [];
    try {
      return expandDateRange(startDate, endDate || startDate);
    } catch {
      return [];
    }
  }, [endDate, startDate]);

  useEffect(() => {
    let cancelled = false;
    if (state.guideProfile?.id || !state.auth.user?.id || !getSupabaseConfig().isConfigured) return undefined;

    async function syncGuideProfile() {
      try {
        const client = await createBrowserSupabaseClient();
        const guideProfile = await fetchActiveGuideProfile(client, state.auth.user.id);
        if (!cancelled && guideProfile?.id) {
          dispatch({ type: 'SET_GUIDE_PROFILE', payload: { guideProfile } });
        }
      } catch {
        // Guide mode can still render local/pending state if the profile is not approved yet.
      }
    }

    syncGuideProfile();
    return () => {
      cancelled = true;
    };
  }, [dispatch, state.auth.user?.id, state.guideProfile?.id]);

  const selectCalendarDate = (date) => {
    const nextSelection = getCalendarUnavailableSelection({ startDate, endDate }, date);
    setStartDate(nextSelection.startDate);
    setEndDate(nextSelection.endDate);
  };
  const saveUnavailableDates = async () => {
    if (!pendingDates.length) return;
    setAvailabilityBusy(true);
    setAvailabilityNotice('');

    try {
      if (getSupabaseConfig().isConfigured) {
        const client = await createBrowserSupabaseClient();
        await saveGuideUnavailableDates(client, {
          guideProfileId: state.guideProfile?.id,
          userId: state.auth.user?.id,
          dates: pendingDates
        });
        setAvailabilityNotice('Unavailable dates were recorded in the database.');
      } else {
        setAvailabilityNotice('Unavailable dates were saved locally. Configure Supabase to record them in the database.');
      }
      dispatch({ type: 'ADD_GUIDE_UNAVAILABLE_DATES', payload: { dates: pendingDates } });
      setStartDate('');
      setEndDate('');
    } catch (error) {
      setAvailabilityNotice(getAuthErrorMessage(error));
    } finally {
      setAvailabilityBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="guide-mode-header">
        <div className="flex items-center gap-4">
          <ProfileAvatar src={guideAvatar} className="h-16 w-16 text-primary" />
          <div>
            <h1 className="text-3xl font-black">Local Guide Mode</h1>
            <p className="text-sm font-semibold text-zinc-500">{state.auth.user?.name} · {state.guideProfile?.city || 'Profile city'}</p>
          </div>
        </div>
        <div className="guide-mode-header-actions">
          <Link className="guide-mode-secondary-action" to="/mypage/settings?section=guide-profile&edit=1">Guide profile</Link>
          <Link className="guide-mode-primary-action" to="/mypage/guide-mode/new">New Tour</Link>
        </div>
      </div>
      <div className="guide-overview-grid">
        <GuideOverviewMetric label="Upcoming trips" value={guideOverview.upcomingTrips} detail="Reserved bookings" />
        <GuideOverviewMetric label="Saved drafts" value={guideOverview.savedDrafts} detail="Tours in progress" />
        <GuideOverviewMetric label="Blocked dates" value={guideOverview.unavailableDates} detail="Unavailable calendar days" />
        <GuideOverviewMetric label="Earnings" value={`$${guideOverview.estimatedEarnings}`} detail="Completed bookings" />
      </div>
      <section className="guide-workbench">
        <div className="guide-section-heading">
          <h2>Guide operations</h2>
          <span>{guideSections.length} tools</span>
        </div>
        <div className="guide-action-grid">
          {guideSections.map((section) => (
            <GuideModeActionCard section={section} overview={guideOverview} key={section.id} />
          ))}
        </div>
      </section>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel title="Upcoming Bookings" items={state.bookings.map((b) => `${b.date} ${b.time}`)} />
        <GuideDraftsPanel drafts={tourDrafts} />
      </div>
      <section className="availability-panel">
        <div className="availability-panel-header">
          <div>
            <h2>Guide calendar</h2>
            <p>Select unavailable dates on the calendar.</p>
          </div>
        </div>
        <div className="availability-layout">
          <GuideAvailabilityCalendar
            selectedDates={unavailableDates}
            startDate={startDate}
            endDate={endDate}
            onSelect={selectCalendarDate}
            monthDate={calendarMonth}
            setMonthDate={setCalendarMonth}
          />
          <div className="availability-controls">
            <div className="availability-summary">
              <b>{pendingDates.length ? `${pendingDates.length} day${pendingDates.length === 1 ? '' : 's'} selected` : 'No dates selected'}</b>
              {pendingDates.length ? <small>{pendingDates[0]}{pendingDates.length > 1 ? ` - ${pendingDates[pendingDates.length - 1]}` : ''}</small> : <small>Click a date, then optionally click another date for a continuous range.</small>}
            </div>
            <button className="availability-save" type="button" onClick={saveUnavailableDates} disabled={availabilityBusy || !pendingDates.length}>
              {availabilityBusy ? 'Saving...' : 'Mark unavailable'}
            </button>
            {availabilityNotice && <p className="availability-notice">{availabilityNotice}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

const guideModeActionMeta = {
  'my-tours': { Icon: Package, value: '0', href: null },
  'create-tour': { Icon: Upload, value: '+', href: '/mypage/guide-mode/new' },
  'saved-drafts': { Icon: List, valueKey: 'savedDrafts', href: null },
  calendar: { Icon: CalendarDays, valueKey: 'unavailableDates', href: null },
  'booking-requests': { Icon: Check, valueKey: 'upcomingTrips', href: null },
  messages: { Icon: MessageCircle, value: '0', href: '/messages' },
  reviews: { Icon: Star, valueKey: 'reviews', href: '/mypage/reviews' },
  earnings: { Icon: DollarSign, valueKey: 'estimatedEarnings', href: '/mypage/guide-mode/payments' },
  'payments-payouts': { Icon: WalletCards, value: 'Setup', href: '/mypage/guide-mode/payments' },
  'guide-profile': { Icon: UserRound, value: 'Edit', href: '/mypage/settings?section=guide-profile&edit=1' },
  performance: { Icon: SlidersHorizontal, value: 'New', href: null },
  'policy-center': { Icon: ShieldCheck, value: 'Review', href: '/policies' },
  support: { Icon: Send, value: 'Open', href: '/support' },
  donation: { Icon: Heart, value: 'Off', href: null }
};

function GuideOverviewMetric({ label, value, detail }) {
  return (
    <article className="guide-overview-card">
      <span>{label}</span>
      <b>{value}</b>
      <small>{detail}</small>
    </article>
  );
}

function GuideModeActionCard({ section, overview }) {
  const meta = guideModeActionMeta[section.id] ?? { Icon: ChevronRight, value: '', href: null };
  const Icon = meta.Icon;
  const rawValue = meta.valueKey ? overview[meta.valueKey] : meta.value;
  const value = section.id === 'earnings' ? `$${rawValue || 0}` : rawValue;
  const content = (
    <>
      <span className="guide-action-icon"><Icon size={20} /></span>
      <span className="guide-action-copy">
        <b>{section.label}</b>
        <small>{section.description}</small>
      </span>
      <span className="guide-action-value">{value}</span>
    </>
  );

  if (meta.href) {
    return <Link className="guide-action-card" to={meta.href}>{content}</Link>;
  }

  return <button className="guide-action-card" type="button">{content}</button>;
}

function Panel({ title, items }) {
  return <section className="rounded-card bg-white p-5 shadow-soft"><h2 className="text-xl font-black">{title}</h2>{items.length ? items.map((item) => <p className="mt-3 rounded-lg bg-zinc-50 p-3" key={item}>{item}</p>) : <p className="mt-3 text-zinc-500">No items yet</p>}</section>;
}

export function GuidePaymentsPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">결제 및 대금수령</h1>
        </div>
        <Link className="h-10 rounded-full border px-4 py-2 text-sm font-black text-zinc-600" to="/mypage/guide-mode">Back</Link>
      </div>
      <section className="guide-payment-overview">
        {['대금수령방법', '대금수령 내역', '서비스 수수료'].map((title) => (
          <article key={title}>
            <h2>{title}</h2>
          </article>
        ))}
      </section>
    </main>
  );
}

function GuideDraftsPanel({ drafts }) {
  return (
    <section className="rounded-card bg-white p-5 shadow-soft">
      <h2 className="text-xl font-black">Saved Drafts</h2>
      {drafts.length ? (
        <div className="mt-3 grid gap-3">
          {drafts.map((draft) => (
            <Link className="guide-draft-link" to={`/mypage/guide-mode/new?draftId=${encodeURIComponent(draft.id)}`} key={draft.id}>
              <b>{draft.title || 'Untitled tour draft'}</b>
              <span>{draft.savedAt ? new Date(draft.savedAt).toLocaleString() : 'Saved draft'}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-zinc-500">No items yet</p>
      )}
    </section>
  );
}

export function TourCreatePage() {
  const { state, dispatch } = useAppState();
  const [searchParams] = useSearchParams();
  const draftIdFromUrl = searchParams.get('draftId');
  const draft = draftIdFromUrl ? selectors.guideTourDraft(state, draftIdFromUrl) : null;
  const [draftId] = useState(() => draft?.id ?? `tour-draft-${Date.now()}`);
  const [agree, setAgree] = useState(draft?.agreements ?? [false, false, false]);
  const [pricingMode, setPricingMode] = useState(draft?.paymentType ?? 'pay_as_you_go');
  const [hourlyPrice, setHourlyPrice] = useState(draft?.hourlyPrice ? clampHourlyPrice(draft.hourlyPrice) : hourlyPriceRange.defaultValue);
  const [editorHtml, setEditorHtml] = useState(draft?.contentHtml ?? '');
  const [draftNotice, setDraftNotice] = useState('');
  const [draftBusy, setDraftBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const guideAvatar = state.guideProfile?.profilePhotoUrl || state.auth.user?.avatar;
  const activePricing = getPricingMode(pricingMode);
  const guideInfoDetails = buildGuideInfoDetails(state.guideProfile);
  const updateHourlyPrice = (value) => setHourlyPrice(clampHourlyPrice(value));
  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = buildTourDraftPayload(event.currentTarget, { agreements: agree, contentHtml: editorHtml, draftId });
    setPublishBusy(true);
    setDraftNotice('');
    try {
      if (getSupabaseConfig().isConfigured) {
        const client = await createBrowserSupabaseClient();
        await publishGuideTour(client, {
          payload,
          guideProfileId: state.guideProfile?.id,
          fallbackCity: state.guideProfile?.city
        });
        setDraftNotice('Tour submitted for review.');
      } else {
        setDraftNotice('Tour published locally.');
      }
      dispatch({ type: 'PUBLISH_TOUR', payload });
    } catch (error) {
      setDraftNotice(getAuthErrorMessage(error));
    } finally {
      setPublishBusy(false);
    }
  };
  const saveTourDraft = async (formElement) => {
    const payload = buildTourDraftPayload(formElement, { agreements: agree, contentHtml: editorHtml, draftId });
    setDraftBusy(true);
    setDraftNotice('');
    try {
      if (getSupabaseConfig().isConfigured) {
        const client = await createBrowserSupabaseClient();
        await saveGuideTourDraft(client, {
          draftId,
          guideProfileId: state.guideProfile?.id,
          userId: state.auth.user?.id,
          payload
        });
        setDraftNotice('Draft saved.');
      } else {
        setDraftNotice('Draft saved locally.');
      }
      dispatch({ type: 'SAVE_GUIDE_DRAFT', payload });
    } catch (error) {
      setDraftNotice(getAuthErrorMessage(error));
    } finally {
      setDraftBusy(false);
    }
  };

  return (
    <main className="tour-create-shell">
      <div className="tour-create-heading">
        <div>
          <span>Create Tour</span>
          <h1>New guide product</h1>
        </div>
        <Link className="tour-create-back" to="/mypage/guide-mode">Back to guide mode</Link>
      </div>

      <form className="tour-create-form" onSubmit={handleSubmit}>
        <section className="tour-guide-strip">
          <ProfileAvatar src={guideAvatar} className="h-14 w-14 text-primary" />
          <div className="tour-guide-info-body">
            <div className="tour-guide-info-heading">
              <div>
                <b>Guide info</b>
                <p>{state.auth.user.name} · {state.guideProfile?.city || 'Profile city'}</p>
              </div>
            </div>
            {guideInfoDetails.length ? (
              <dl className="tour-guide-info-grid">
                {guideInfoDetails.map((detail) => (
                  <div className={detail.label === 'Guide introduction' ? 'wide' : ''} key={detail.label}>
                    <dt>{detail.label}</dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>

        <section className="tour-form-section">
          <div className="tour-section-title">
            <span>01</span>
            <h2>Product basics</h2>
          </div>
          <div className="tour-basic-grid">
            <label className="tour-field">Title<input name="title" placeholder="Evening market walk in Seoul" defaultValue={draft?.title ?? ''} required /></label>
            <label className="tour-field">Tour type<select name="type" defaultValue={draft?.typeValue ?? tourTypes[0]}>{tourTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="tour-field">City<input name="city" placeholder="Seoul" defaultValue={draft?.city ?? state.guideProfile?.city ?? ''} required /></label>
            <label className="tour-field">Duration minutes<input name="durationMinutes" type="number" min="30" step="15" defaultValue={draft?.durationMinutes ?? 60} required /></label>
            <label className="tour-field">Max people<input name="maxPeople" type="number" min="1" step="1" defaultValue={draft?.maxPeople ?? 1} required /></label>
            <label className="tour-field wide">Short description<textarea name="description" placeholder="Describe what travelers will experience." defaultValue={draft?.description ?? ''} required /></label>
          </div>
        </section>

        <section className="tour-form-section">
          <div className="tour-section-title">
            <span>02</span>
            <h2>Pricing</h2>
          </div>
          <div className="pricing-mode-grid">
            {pricingModes.map((mode) => (
              <button className={`pricing-mode-button ${pricingMode === mode.id ? 'active' : ''}`} type="button" onClick={() => setPricingMode(mode.id)} key={mode.id}>
                {mode.id === 'pay_as_you_go' ? <DollarSign size={20} /> : <Package size={20} />}
                <span>
                  <b>{mode.label}</b>
                  <small>{mode.helper}</small>
                </span>
              </button>
            ))}
          </div>
          <input type="hidden" name="paymentType" value={pricingMode} />
          <div className="tour-price-row">
            {pricingMode === 'pay_as_you_go' ? (
              <div className="price-range-control">
                <div className="price-range-header">
                  <span>Hourly price range</span>
                  <b>{formatHourlyPrice(hourlyPrice)} / hour</b>
                </div>
                <input
                  aria-label="Hourly price range"
                  type="range"
                  min={hourlyPriceRange.min}
                  max={hourlyPriceRange.max}
                  step="1"
                  value={hourlyPrice}
                  onChange={(event) => updateHourlyPrice(event.target.value)}
                />
                <div className="price-range-footer">
                  <span>$1</span>
                  <span>$100+</span>
                </div>
                <div className="price-side-stack">
                  <label className="tour-field compact">Hourly price<input name="hourlyPrice" type="number" min={hourlyPriceRange.min} max={hourlyPriceRange.max} step="1" value={hourlyPrice} onChange={(event) => updateHourlyPrice(event.target.value)} required /></label>
                  <label className="tour-field compact">Currency<select name="currency" defaultValue={draft?.currency ?? 'USD'}>{majorCurrencyOptions.map((currency) => <option value={currency.code} key={currency.code}>{currency.label}</option>)}</select></label>
                </div>
              </div>
            ) : (
              <div className="price-package-grid">
                <label className="tour-field">{activePricing.priceLabel}<input name={activePricing.fieldName} type="number" min="0" step="1" placeholder="0" defaultValue={draft?.packagePrice ?? ''} required /></label>
                <label className="tour-field">Currency<select name="currency" defaultValue={draft?.currency ?? 'USD'}>{majorCurrencyOptions.map((currency) => <option value={currency.code} key={currency.code}>{currency.label}</option>)}</select></label>
              </div>
            )}
          </div>
        </section>

        <section className="tour-form-section">
          <div className="tour-section-title">
            <span>03</span>
            <h2>Options</h2>
          </div>
          <div className="tour-option-grid">
            {tourOptionGroups.map((option) => (
              <div className="tour-option-row" key={option.id}>
                <input id={`tour-option-${option.id}`} name={`option_${option.id}`} type="checkbox" value="yes" defaultChecked={draft?.[`option_${option.id}`] === 'yes'} />
                <div className="tour-option-copy">
                  <b>{option.label}</b>
                  <small>{option.description}</small>
                </div>
                {option.allowsPrice && <input className="tour-option-price" name={`option_${option.id}_price`} type="number" min="0" step="1" placeholder="Optional price" defaultValue={draft?.[`option_${option.id}_price`] ?? ''} aria-label={`${option.label} optional price`} />}
              </div>
            ))}
          </div>
        </section>

        <section className="tour-form-section">
          <div className="tour-section-title">
            <span>04</span>
            <h2>Tour content</h2>
          </div>
          <div className="mini-editor">
            <div className="mini-editor-toolbar" aria-label="Editor toolbar">
              {[['Bold', Bold], ['Italic', Italic], ['Text size', Type], ['List', List], ['Table', Table2], ['Emoji', SmilePlus], ['Photo', ImagePlus], ['Short video', Video]].map(([label, Icon]) => (
                <button type="button" aria-label={label} title={label} key={label}><Icon size={17} /></button>
              ))}
              <label className="mini-editor-upload" title="Add photo">
                <ImagePlus size={17} />
                <input type="file" accept="image/*" name="contentImages" multiple />
              </label>
              <label className="mini-editor-upload" title="Add short video">
                <Video size={17} />
                <input type="file" accept="video/*" name="contentVideos" multiple />
              </label>
            </div>
            <div
              className="mini-editor-surface"
              contentEditable
              suppressContentEditableWarning
              onInput={(event) => setEditorHtml(event.currentTarget.innerHTML)}
              data-placeholder="Add tour text, photos, emojis, tables, and short videos around 30 seconds."
              dangerouslySetInnerHTML={{ __html: editorHtml }}
            />
            <input type="hidden" name="contentHtml" value={editorHtml} />
          </div>
        </section>

        <section className="tour-form-section">
          <div className="tour-section-title">
            <span>05</span>
            <h2>Terms placeholders</h2>
          </div>
          <div className="agreement-stack">
            {agreementSections.map((section, index) => (
              <section className="agreement-policy" key={section.id}>
                <h3>{section.title}</h3>
                <div className="agreement-document" tabIndex="0">
                  <p><b>Effective date:</b> {section.effectiveDate}</p>
                  <p>{section.placeholderText}</p>
                  <p>This placeholder keeps the final policy space visible now, so the actual legal text can be inserted later without changing the form layout.</p>
                </div>
                <label className="agreement-consent">
                  <input
                    type="checkbox"
                    checked={agree[index]}
                    onChange={(event) => setAgree((prev) => prev.map((value, idx) => idx === index ? event.target.checked : value))}
                  />
                  <span>{section.consentText}</span>
                </label>
              </section>
            ))}
          </div>
        </section>

        <input type="hidden" name="draftId" value={draftId} />
        <div className="tour-create-actions">
          {draftNotice && <p className="tour-draft-notice">{draftNotice}</p>}
          <button type="button" className="tour-secondary-action" onClick={(event) => saveTourDraft(event.currentTarget.form)} disabled={draftBusy}>{draftBusy ? 'Saving...' : 'Save draft'}</button>
          <button className="tour-primary-action" disabled={!agree.every(Boolean) || publishBusy}>{publishBusy ? 'Publishing...' : 'Publish'}</button>
        </div>
      </form>
    </main>
  );
}

function buildTourDraftPayload(formElement, { agreements, contentHtml, draftId } = {}) {
  const form = new FormData(formElement);
  const payload = Object.fromEntries(form.entries());
  return {
    ...payload,
    id: draftId,
    type: 'tour-draft',
    typeValue: form.get('type') || '',
    title: form.get('title') || 'Untitled tour draft',
    paymentType: form.get('paymentType') || 'pay_as_you_go',
    currency: form.get('currency') || 'USD',
    hourlyPrice: form.get('hourlyPrice') || '',
    packagePrice: form.get('packagePrice') || '',
    contentHtml: contentHtml || '',
    agreements
  };
}

function ProfileAvatar({ src, className = 'h-12 w-12' }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-50 ${className}`}>
      {src ? <img className="h-full w-full object-cover" src={src} alt="" /> : <Camera size={24} />}
    </span>
  );
}

export function BookmarksPage() {
  const { state } = useAppState();
  const [remoteBookmarks, setRemoteBookmarks] = useState([]);
  const saved = remoteBookmarks.length ? remoteBookmarks : tours.filter((tour) => state.bookmarks.includes(tour.id));
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    async function loadBookmarks() {
      if (!state.auth.user?.id) return;
      try {
        const client = await createBrowserSupabaseClient();
        const rows = await fetchBookmarks(client, state.auth.user.id);
        if (active) setRemoteBookmarks(rows.map((row) => row.tour).filter(Boolean));
      } catch {
        if (active) setRemoteBookmarks([]);
      }
    }
    loadBookmarks();
    return () => {
      active = false;
    };
  }, [state.auth.user?.id]);

  return <main className="mx-auto max-w-7xl px-4 py-8"><h1 className="text-3xl font-black">Bookmarks</h1>{saved.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{saved.map((tour) => <TourCard key={tour.id} tour={tour} onClick={() => navigate(`/tour/${tour.id}`)} />)}</div> : <p className="mt-5 rounded-card bg-white p-8 text-center shadow-soft">No saved tours yet. Save your favorites!</p>}</main>;
}

export function MessagesPage() {
  const { state, dispatch } = useAppState();
  const [activeCategory, setActiveCategory] = useState('all');
  const [remoteConversations, setRemoteConversations] = useState([]);
  const allConversations = useMemo(
    () => [
      ...remoteConversations,
      ...state.conversations.map((conversation) => ({ ...conversation, type: conversation.type ?? 'travel' })),
      ...mockConversations
    ],
    [remoteConversations, state.conversations]
  );
  const filteredConversations = activeCategory === 'all' ? allConversations : allConversations.filter((conversation) => conversation.type === activeCategory);
  const [selected, setSelected] = useState(filteredConversations[0]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!filteredConversations.some((conversation) => conversation.id === selected?.id)) {
      setSelected(filteredConversations[0]);
    }
  }, [activeCategory, filteredConversations, selected?.id]);

  useEffect(() => {
    let active = true;
    async function loadConversations() {
      if (!state.auth.user?.id || !getSupabaseConfig().isConfigured) return;
      try {
        const client = await createBrowserSupabaseClient();
        const rows = await fetchConversations(client, state.auth.user.id);
        const mapped = rows.map((conversation) => ({
          id: conversation.id,
          type: conversation.type ?? 'travel',
          guideName: conversation.title || conversation.last_message || 'Conversation',
          avatar: '',
          lastMessage: conversation.last_message || '',
          messages: [...(conversation.conversation_messages ?? [])]
            .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
            .map((message) => ({ from: message.sender_id === state.auth.user.id ? 'me' : 'them', text: message.body }))
        }));
        if (active) setRemoteConversations(mapped);
      } catch {
        if (active) setRemoteConversations([]);
      }
    }
    loadConversations();
    return () => {
      active = false;
    };
  }, [state.auth.user?.id]);

  const sendMessage = async () => {
    if (!text.trim() || !selected) return;
    try {
      if (getSupabaseConfig().isConfigured && !selected.id.startsWith('mock-') && state.auth.user?.id) {
        await sendConversationMessage(await createBrowserSupabaseClient(), {
          conversationId: selected.id,
          senderId: state.auth.user.id,
          body: text
        });
      }
    } catch {}
    dispatch({ type: 'SEND_MESSAGE', payload: { conversationId: selected.id, text } });
    setSelected((conversation) => conversation ? { ...conversation, lastMessage: text, messages: [...conversation.messages, { from: 'me', text }] } : conversation);
    setRemoteConversations((items) => items.map((conversation) => conversation.id === selected.id ? { ...conversation, lastMessage: text, messages: [...conversation.messages, { from: 'me', text }] } : conversation));
    setText('');
  };

  return (
    <main className="mx-auto grid h-[calc(100dvh-73px)] w-full max-w-7xl gap-2 overflow-hidden px-4 sm:px-6 md:grid-cols-[340px_1fr]">
      <aside className="flex min-h-0 flex-col rounded-card bg-white p-2 shadow-soft">
        <h1 className="px-2 py-2 text-2xl font-black">Messages</h1>
        <div className="mb-2 grid grid-cols-4 gap-1 rounded-full bg-zinc-100 p-1">
          {messageCategories.map((category) => (
            <button
              className={`min-h-10 rounded-full px-3 text-sm font-black ${activeCategory === category.id ? 'bg-primary text-white shadow-soft' : 'text-zinc-600 hover:bg-white'}`}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              key={category.id}
            >
              {category.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredConversations.length ? filteredConversations.map((conversation) => (
            <button
              className={`flex w-full gap-3 rounded-card p-3 text-left hover:bg-orange-50 ${selected?.id === conversation.id ? 'bg-orange-50' : ''}`}
              onClick={() => setSelected(conversation)}
              key={conversation.id}
            >
              <img className="h-12 w-12 rounded-full object-cover" src={conversation.avatar} alt="" />
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <b>{conversation.guideName}</b>
                  <small className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-black text-zinc-500">{messageCategories.find((category) => category.id === conversation.type)?.label}</small>
                </span>
                <small className="line-clamp-2 block text-zinc-500">{conversation.lastMessage}</small>
              </span>
            </button>
          )) : <p className="p-3 text-zinc-500">No conversations yet</p>}
        </div>
      </aside>
      <section className="flex min-h-0 flex-col overflow-hidden rounded-card bg-white shadow-soft">
        {selected ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
              <div>
                <h2 className="text-xl font-black">{selected.guideName}</h2>
                <p className="text-sm font-semibold text-zinc-500">{messageCategories.find((category) => category.id === selected.type)?.label} 메시지</p>
              </div>
            </div>
            <div className="message-thread">
              {selected.messages.map((message, index) => (
                <div className={`message-row ${message.from === 'me' ? 'from-me' : 'from-them'}`} key={`${message.text}-${index}`}>
                  <p className={`message-bubble ${message.from === 'me' ? 'from-me' : 'from-them'}`}>{message.text}</p>
                </div>
              ))}
            </div>
            <div className="message-composer">
              <input
                className="message-composer-input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') sendMessage(); }}
                placeholder="메시지를 입력하세요"
              />
              <button className="message-send-button" onClick={sendMessage} disabled={!text.trim()} aria-label="Send message">
                <Send size={21} />
              </button>
            </div>
          </>
        ) : <p>Select a conversation</p>}
      </section>
    </main>
  );
}

export function PoliciesPage() {
  return <main className="mx-auto max-w-4xl px-4 py-8"><h1 className="text-3xl font-black">Terms & Policies</h1>{['Terms of Service', 'Cancellation/Refund Policy', 'Privacy Policy'].map((title) => <details className="mt-4 rounded-card bg-white p-5 shadow-soft" open key={title}><summary className="cursor-pointer text-xl font-black">{title}</summary><p className="mt-3 leading-7 text-zinc-600">This dummy legal text is inspired by common US, Korea, and EU marketplace policy structures. It describes user responsibilities, platform limitations, privacy handling, cancellation windows, refunds, and dispute handling for simulation purposes only. No real legal advice is provided.</p></details>)}</main>;
}

export function SupportPage() {
  const { state, dispatch } = useAppState();
  const [remoteInquiries, setRemoteInquiries] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadTickets() {
      if (!state.auth.user?.id || !getSupabaseConfig().isConfigured) return;
      try {
        const client = await createBrowserSupabaseClient();
        const rows = await fetchSupportTickets(client, state.auth.user.id);
        if (active) setRemoteInquiries(rows);
      } catch {
        if (active) setRemoteInquiries([]);
      }
    }
    loadTickets();
    return () => {
      active = false;
    };
  }, [state.auth.user?.id]);

  const inquiries = remoteInquiries.length ? remoteInquiries : state.inquiries;
  return <main className="mx-auto max-w-5xl px-4 py-8"><h1 className="text-3xl font-black">Customer Support</h1><section className="mt-5 grid gap-4">{faqs.map((faq) => <details className="rounded-card bg-white p-4 shadow-soft" key={faq.q}><summary className="font-black">{faq.q}</summary><p className="mt-2 text-zinc-600">{faq.a}</p></details>)}</section><form className="mt-6 grid gap-3 rounded-card bg-white p-5 shadow-soft" onSubmit={async (e) => { e.preventDefault(); const payload = Object.fromEntries(new FormData(e.currentTarget)); try { if (getSupabaseConfig().isConfigured) { const client = await createBrowserSupabaseClient(); const ticket = await createSupportTicket(client, { profileId: state.auth.user?.id, payload }); setRemoteInquiries((items) => [ticket, ...items]); } } catch {} dispatch({ type: 'SUBMIT_SUPPORT', payload }); e.currentTarget.reset(); }}><h2 className="text-xl font-black">Submit a request</h2><input name="subject" placeholder="Subject" required /><textarea name="description" placeholder="Description" required /><label className="grid min-h-28 place-items-center rounded-card border-2 border-dashed"><Camera /> Optional screenshot upload</label><button className="h-12 rounded-full bg-primary font-black text-white">Submit</button></form><section className="mt-6 rounded-card bg-white p-5 shadow-soft"><h2 className="text-xl font-black">My inquiries</h2>{inquiries.length ? inquiries.map((item) => <p key={item.id}>{item.subject} · {item.status}</p>) : <p>No inquiries yet</p>}</section></main>;
}
