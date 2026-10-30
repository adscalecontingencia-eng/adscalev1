/**
 * Reads an image file and returns a small PNG data URL, so brand images can be stored with the
 * agency settings (no public file bucket needed).
 * - mode 'square': centered square of `size`×`size` (favicon), transparent padding, no crop.
 * - mode 'fit': fits inside `size`×`size` keeping proportions (logo).
 */
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

export async function fileToBrandDataUrl(file: File, mode: 'square' | 'fit', size: number): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.type)) throw new Error('Envie uma imagem PNG, JPG, WEBP, GIF ou SVG.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('A imagem deve ter no máximo 5 MB.');
  const src = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('Não foi possível ler a imagem.'));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Imagem inválida.'));
    i.src = src;
  });
  const w = img.naturalWidth || size, h = img.naturalHeight || size;
  const scale = Math.min(size / w, size / h, mode === 'fit' ? 1 : Infinity);
  const dw = Math.max(1, Math.round(w * scale)), dh = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = mode === 'square' ? size : dw;
  canvas.height = mode === 'square' ? size : dh;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  return canvas.toDataURL('image/png');
}

/** True when the image is not square (favicon will get transparent padding). */
export async function isSquareImage(file: File): Promise<boolean> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    return Math.abs(img.naturalWidth - img.naturalHeight) <= 2;
  } catch { return true; } finally { URL.revokeObjectURL(url); }
}
