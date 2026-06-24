export function printImage(photoUrl: string, title = 'SnapBooth', scale = 98) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    window.open(photoUrl, '_blank');
    return;
  }
  const safeScale = Math.max(70, Math.min(110, Number.isFinite(scale) ? scale : 98));
  doc.open();
  doc.write(`<!doctype html><html><head><title>${title}</title><style>@page{margin:0;size:4in 6in portrait}html,body{margin:0;width:100%;height:100%;overflow:hidden}.wrap{width:4in;height:6in;display:flex;align-items:center;justify-content:center}img{max-width:${safeScale}%;max-height:96%;object-fit:contain}</style></head><body><div class="wrap"><img src="${photoUrl}" /></div></body></html>`);
  doc.close();
  const img = doc.querySelector('img');
  const doPrint = () => { win.focus(); win.print(); };
  if (img?.complete) setTimeout(doPrint, 300);
  else img?.addEventListener('load', () => setTimeout(doPrint, 300), { once: true });
  setTimeout(() => iframe.remove(), 30000);
}
