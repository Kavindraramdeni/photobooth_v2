import { removeBackground } from '@imgly/background-removal';

export async function removeImageBackground(image: Blob): Promise<Blob> {
  return removeBackground(image);
}

export async function compositeWithBackground(foreground: Blob, backgroundUrl: string): Promise<Blob> {
  const [fgBitmap, bgBitmap] = await Promise.all([
    createImageBitmap(await removeImageBackground(foreground)),
    fetch(backgroundUrl).then((r) => r.blob()).then(createImageBitmap),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = fgBitmap.width;
  canvas.height = fgBitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bgBitmap, 0, 0, canvas.width, canvas.height);
  ctx.drawImage(fgBitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Composite failed')), 'image/jpeg', 0.92));
}
