import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 120000,
});

// ─── Photos ────────────────────────────────────────────────────────────────

export async function uploadPhoto(blob: Blob, eventId: string, sessionId: string, mode = 'single') {
  const form = new FormData();
  form.append('photo', blob, 'photo.jpg');
  form.append('eventId', eventId);
  form.append('sessionId', sessionId);
  form.append('mode', mode);
  const res = await api.post('/photos/upload', form);
  return res.data;
}

export async function createGIF(frames: Blob[], eventId: string, type: 'gif' | 'boomerang' = 'gif') {
  const form = new FormData();
  frames.forEach((f, i) => form.append('frames', f, `frame_${i}.jpg`));
  form.append('eventId', eventId);
  form.append('type', type);
  const res = await api.post('/photos/gif', form);
  return res.data;
}

export async function createStrip(photos: Blob[], eventId: string) {
  const form = new FormData();
  photos.forEach((p, i) => form.append('photos', p, `photo_${i}.jpg`));
  form.append('eventId', eventId);
  const res = await api.post('/photos/strip', form);
  return res.data;
}

export async function getEventPhotos(eventId: string, page = 1) {
  const res = await api.get(`/photos/event/${eventId}?page=${page}`);
  return res.data;
}

export async function deletePhoto(photoId: string) {
  const res = await api.delete(`/photos/${photoId}`);
  return res.data;
}

export async function downloadPhotosZip(eventId: string, eventName: string) {
  const response = await fetch(`${API_BASE}/api/photos/event/${eventId}/zip`);
  if (!response.ok) throw new Error('ZIP download failed');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${eventName.replace(/\s+/g, '_')}_photos.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── AI ────────────────────────────────────────────────────────────────────

export async function generateAI(blob: Blob, styleKey: string, eventId: string, photoId?: string) {
  const form = new FormData();
  form.append('photo', blob, 'photo.jpg');
  form.append('styleKey', styleKey);
  form.append('eventId', eventId);
  if (photoId) form.append('photoId', photoId);
  const res = await api.post('/ai/generate', form);
  return res.data;
}

export async function generateSurpriseAI(blob: Blob, eventId: string) {
  const form = new FormData();
  form.append('photo', blob, 'photo.jpg');
  form.append('eventId', eventId);
  const res = await api.post('/ai/surprise', form);
  return res.data;
}

export async function getAIStyles() {
  const res = await api.get('/ai/styles');
  return res.data.styles;
}

// ─── Events ────────────────────────────────────────────────────────────────

export async function getEvent(idOrSlug: string) {
  const res = await api.get(`/events/${idOrSlug}`);
  return res.data.event;
}

export async function getEvents() {
  const res = await api.get('/events');
  return res.data.events;
}

export async function createEvent(data: Record<string, unknown>) {
  const res = await api.post('/events', data);
  return res.data.event;
}

export async function updateEvent(id: string, data: Record<string, unknown>) {
  const res = await api.put(`/events/${id}`, data);
  return res.data.event;
}

export async function getEventStats(id: string) {
  const res = await api.get(`/events/${id}/stats`);
  return res.data.stats;
}

export async function getEventQR(idOrSlug: string) {
  const res = await api.get(`/events/${idOrSlug}/qr`);
  return res.data;
}

// ─── Analytics ─────────────────────────────────────────────────────────────

export async function trackAction(eventId: string, action: string, metadata = {}) {
  try {
    await api.post('/analytics/track', { eventId, action, metadata });
  } catch (e) {
    console.warn('Analytics track failed:', e);
  }
}

export async function getDashboardStats(days = 30) {
  const res = await api.get(`/analytics/dashboard?days=${days}`);
  return res.data;
}

// ─── Diagnostics ───────────────────────────────────────────────────────────

export async function pingBackend(): Promise<{ ok: boolean; latencyMs: number; timestamp: string }> {
  const start = Date.now();
  try {
    const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
    const latencyMs = Date.now() - start;
    const data = await res.json();
    return { ok: res.ok, latencyMs, timestamp: data.timestamp || new Date().toISOString() };
  } catch {
    return { ok: false, latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
  }
}
