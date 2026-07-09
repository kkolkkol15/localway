import { X } from 'lucide-react';

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
  return (
    <article className="group min-w-[280px] overflow-hidden rounded-card bg-cream shadow-soft transition hover:-translate-y-1">
      <button className="block w-full text-left" onClick={onClick}>
        <img className="h-56 w-full object-cover" src={tour.image} alt="" loading="lazy" />
        <div className="grid gap-2 p-4">
          <div className="flex items-center gap-2">
            <img className="h-8 w-8 rounded-full object-cover" src={tour.guide.avatar} alt="" />
            <span className="text-sm font-bold">{tour.guide.name}</span>
          </div>
          <h3 className="line-clamp-2 text-lg font-black">{tour.title}</h3>
          <p className="line-clamp-2 text-sm text-zinc-600">{tour.description}</p>
          <div className="flex items-center justify-between font-bold"><span>⭐ {tour.rating}</span><span className="text-primary">${tour.price}</span></div>
        </div>
      </button>
      {onSave && <button className="mx-4 mb-4 h-11 rounded-full border px-4 font-bold" onClick={onSave}>{saved ? '♥ Saved' : '♡ Save'}</button>}
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
