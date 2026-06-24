'use client';

export interface BoothBackground { id: string; name: string; url: string; }

export function BackgroundSelector({ backgrounds, selectedUrl, onSelect }: { backgrounds: BoothBackground[]; selectedUrl?: string | null; onSelect: (url: string) => void }) {
  if (!backgrounds.length) return null;
  return <div className="grid grid-cols-3 gap-3">
    {backgrounds.map((background) => <button key={background.id} onClick={() => onSelect(background.url)} className={`overflow-hidden rounded-2xl border-2 ${selectedUrl === background.url ? 'border-violet-400' : 'border-white/20'}`}>
      <img src={background.url} alt={background.name} className="h-24 w-full object-cover" />
      <span className="block truncate bg-black/70 px-2 py-1 text-xs text-white">{background.name}</span>
    </button>)}
  </div>;
}
