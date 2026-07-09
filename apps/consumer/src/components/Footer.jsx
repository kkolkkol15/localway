const primaryLinks = ['회사소개', '공지사항', 'FAQ', '제휴문의', '채용'];
const policyLinks = ['이용약관', '개인정보처리방침', '환불정책', '위치기반서비스약관'];

export function Footer() {
  const topLinks = ['개인정보 처리방침', '쿠키 정책', ...policyLinks, ...primaryLinks];

  return (
    <footer className="border-t border-zinc-200 bg-[#f7f7f7] text-zinc-700">
      <div className="mx-auto max-w-7xl px-6 py-5">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <nav className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-semibold">
            <span className="text-zinc-800">© 2026 COMPANY, Inc.</span>
            {topLinks.map((item) => (
              <a className="footer-plain-link footer-dot-link" href="/policies" key={item}>{item}</a>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-zinc-800">
            <button className="footer-utility" type="button" aria-label="언어 선택">
              <span aria-hidden="true">🌐</span>
              한국어 (KR)
            </button>
            <button className="footer-utility" type="button" aria-label="통화 선택">
              <span aria-hidden="true">₩</span>
              KRW
            </button>
            <div className="flex items-center gap-2">
              <a className="footer-social" href="https://www.facebook.com" aria-label="Facebook">
                <FacebookLogo />
              </a>
              <a className="footer-social" href="https://x.com" aria-label="X">
                <XLogo />
              </a>
              <a className="footer-social" href="https://www.instagram.com" aria-label="Instagram">
                <InstagramLogo />
              </a>
              <a className="footer-social" href="https://www.youtube.com" aria-label="YouTube">
                <YouTubeLogo />
              </a>
            </div>
          </div>
        </div>

        <p className="pt-3 text-[11px] font-semibold leading-5 text-zinc-500">
          웹사이트 제공자: Local Way Korea, private unlimited company. 사업자등록번호: 000-00-00000 · 통신판매업신고번호: 제2026-서울-0000호 ·
          연락처: support@company.com. 당사는 통신판매중개자이며 통신판매의 당사자가 아닙니다. 상품 및 거래에 관한 책임은 판매자에게 있습니다.
        </p>
      </div>
    </footer>
  );
}

function InstagramLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="currentColor" d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2Zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-2.35a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z" />
    </svg>
  );
}

function YouTubeLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.55 3.6 12 3.6 12 3.6s-7.55 0-9.4.5A3 3 0 0 0 .5 6.2 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.85.5 9.4.5 9.4.5s7.55 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.86.5-5.8.5-5.8s0-3.94-.5-5.8ZM9.6 15.6V8.4l6.25 3.6L9.6 15.6Z" />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="currentColor" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.03 1.79-4.7 4.53-4.7 1.31 0 2.68.23 2.68.23v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.27h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="currentColor" d="M18.9 2h3.68l-8.04 9.2L24 22h-7.42l-5.8-7.6L4.12 22H.44l8.6-9.83L0 2h7.6l5.24 6.93L18.9 2Zm-1.3 18.1h2.04L6.49 3.8H4.3l13.3 16.3Z" />
    </svg>
  );
}
