import { useState } from 'react';
import { Heart, X } from 'lucide-react';

function ImageWithFallback({ src, fallback, ...props }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback;
  return <img {...props} src={src} alt={props.alt ?? ''} onError={() => setFailed(true)} />;
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 p-4" onMouseDown={onClose}>
      <section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-card bg-cream p-5 shadow-soft" onMouseDown={(event) => event.stopPropagation()}>
        <header className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-black">{title}</h2>
          <button className="icon-btn bg-white" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function TourCard({ tour, onClick, saved, onSave }) {
  const imageSrc = tour.image || tour.thumbnail || '';
  const avatarSrc = tour.guide?.avatar || '';
  const ratingLabel = Number(tour.reviews ?? 0) > 0 && Number(tour.rating ?? 0) > 0 ? `⭐ ${tour.rating}` : '신규';

  return (
    <article className="group relative w-full min-w-0 overflow-hidden rounded-card bg-cream shadow-soft transition hover:-translate-y-1">
      {onSave && (
        <button
          className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-primary shadow-soft backdrop-blur transition hover:scale-105"
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onSave(event);
          }}
          aria-label={saved ? 'Remove from bookmarks' : 'Save to bookmarks'}
        >
          <Heart className={saved ? 'fill-primary text-primary' : 'text-zinc-700'} size={20} />
        </button>
      )}
      <button className="block w-full text-left" onClick={onClick}>
        <ImageWithFallback
          className="h-56 w-full object-cover"
          src={imageSrc}
          alt=""
          loading="lazy"
          fallback={<div className="grid h-56 w-full place-items-center bg-zinc-100 text-sm font-bold text-zinc-400">No image</div>}
        />
        <div className="grid gap-2 p-4">
          <div className="flex items-center gap-2">
            <ImageWithFallback
              className="h-8 w-8 rounded-full object-cover"
              src={avatarSrc}
              alt=""
              fallback={<span className="grid h-8 w-8 place-items-center rounded-full bg-white text-xs font-black text-zinc-500">{(tour.guide?.name || 'L').slice(0, 1)}</span>}
            />
            <span className="text-sm font-bold">{tour.guide?.name || 'Local guide'}</span>
          </div>
          <h3 className="line-clamp-2 text-lg font-black">{tour.title}</h3>
          <p className="line-clamp-2 text-sm text-zinc-600">{tour.description}</p>
          <div className="flex items-center justify-between font-bold"><span>{ratingLabel}</span><span className="text-primary">${tour.price}</span></div>
        </div>
      </button>
    </article>
  );
}

export function SkeletonGrid() {
  return <div className="grid gap-5 md:grid-cols-3">{[1, 2, 3].map((item) => <div className="h-80 animate-pulse rounded-card bg-zinc-200" key={item} />)}</div>;
}

export function Stepper({ label, value, setValue, min = 0 }) {
  return (
    <div className="flex items-center justify-between rounded-full border bg-white px-3 py-2">
      <span className="font-bold">{label}</span>
      <div className="flex items-center gap-3">
        <button className="h-11 w-11 rounded-full border font-black" onClick={() => setValue(Math.max(min, value - 1))}>-</button>
        <b>{value}</b>
        <button className="h-11 w-11 rounded-full border font-black" onClick={() => setValue(value + 1)}>+</button>
      </div>
    </div>
  );
}
