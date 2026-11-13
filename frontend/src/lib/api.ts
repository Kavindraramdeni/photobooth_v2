import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 120000,
});

// Attach auth token to every request automatically
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('sb_access_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// 401 → clear session and redirect to login (only on protected pages)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      const isPublic = path.startsWith('/booth') || path.startsWith('/gallery') || path.startsWith('/p/') || path === '/';
      if (!isPublic) {
        localStorage.removeItem('sb_access_token');
        localStorage.removeItem('sb_refresh_token');
        localStorage.removeItem('sb_user');
        document.cookie = 'sb_access_token=; path=/; max-age=0';
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Booth Session & Operator Auth Helpers ─────────────────────────────────

export function getBoothToken(eventId?: string): string | null {
  if (typeof window === 'undefined') return null;
  if (eventId) {
    const eventSpecific =
      sessionStorage.getItem(`booth_token_${eventId}`) ||
      localStorage.getItem(`booth_token_${eventId}`);
    if (eventSpecific) return eventSpecific;
  }
  return (
    sessionStorage.getItem('booth_token') ||
    sessionStorage.getItem('booth_session_token') ||
    sessionStorage.getItem('operator_token') ||
    localStorage.getItem('sb_operator_token') ||
    localStorage.getItem('sb_access_token') ||
    null
  );
}

export function setBoothToken(token: string, eventId?: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('booth_token', token);
  sessionStorage.setItem('booth_session_token', token);
  if (eventId) {
    sessionStorage.setItem(`booth_token_${eventId}`, token);
    localStorage.setItem(`booth_token_${eventId}`, token);
  }
}

export function getBoothHeaders(eventId?: string, idempotencyKey?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getBoothToken(eventId);
  if (token) {
    headers['x-booth-session'] = token;
    headers['X-Booth-Session'] = token;
  }
  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
    headers['x-idempotency-key'] = idempotencyKey;
  }
  return headers;
}

/**
 * Authenticates booth operator PIN against backend endpoint
 * Returns scoped operator token
 */
export async function operatorLogin(
  eventId: string,
  pin: string
): Promise<{ token: string; operator: { role: string; eventId: string; expiresAt: string } }> {
  try {
    const res = await api.post('/auth/operator-login', { eventId, pin });
    if (res.data?.token && typeof window !== 'undefined') {
      sessionStorage.setItem('operator_token', res.data.token);
      localStorage.setItem('sb_operator_token', res.data.token);
    }
    return res.data;
  } catch (err: any) {
    // Fallback to legacy event endpoint if /auth route is not reachable
    if (err.response?.status === 404) {
      const fallback = await api.post(`/events/${eventId}/operator-login`, { pin });
      if (fallback.data?.token && typeof window !== 'undefined') {
        sessionStorage.setItem('operator_token', fallback.data.token);
        localStorage.setItem('sb_operator_token', fallback.data.token);
      }
      return fallback.data;
    }
    throw err;
  }
}

/**
 * Exchanges operator or owner credentials for a signed event booth session token
 */
export async function getBoothSession(
  eventId: string,
  operatorToken?: string
): Promise<{ sessionToken: string; boothToken: string; eventId: string; expiresAt: string }> {
  const token =
    operatorToken ||
    getBoothToken(eventId) ||
    (typeof window !== 'undefined' ? localStorage.getItem('sb_access_token') : null);

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await api.post(`/events/${eventId}/booth-session`, {}, { headers });
  const sessionToken = res.data?.sessionToken || res.data?.boothToken;
  if (sessionToken) {
    setBoothToken(sessionToken, eventId);
  }
  return res.data;
}

// ─── Photos & Media Upload ──────────────────────────────────────────────────

export async function uploadPhoto(
  blob: Blob,
  eventId: string,
  sessionId?: string,
  mode = 'single',
  clientPhotoId?: string
) {
  const form = new FormData();
  form.append('photo', blob, 'photo.jpg');
  form.append('eventId', eventId);
  if (sessionId) form.append('sessionId', sessionId);
  form.append('mode', mode);

  if (clientPhotoId) {
    form.append('clientPhotoId', clientPhotoId);
    form.append('client_photo_id', clientPhotoId);
    form.append('clientCaptureId', clientPhotoId);
  }

  const headers = getBoothHeaders(eventId, clientPhotoId);
  const res = await api.post('/photos/upload', form, { headers });
  return res.data;
}

export async function createGIF(
  frames: Blob[],
  eventId: string,
  type: 'gif' | 'boomerang' = 'gif',
  clientPhotoId?: string,
  sessionId?: string
) {
  const form = new FormData();
  frames.forEach((f, i) => form.append('frames', f, `frame_${i}.jpg`));
  form.append('eventId', eventId);
  form.append('type', type);
  if (sessionId) form.append('sessionId', sessionId);
  if (clientPhotoId) {
    form.append('clientPhotoId', clientPhotoId);
    form.append('client_photo_id', clientPhotoId);
    form.append('clientCaptureId', clientPhotoId);
  }

  const headers = getBoothHeaders(eventId, clientPhotoId);
  const res = await api.post('/photos/gif', form, { headers });
  return res.data;
}

export async function createBurst(
  frames: Blob[],
  eventId: string,
  sessionId?: string,
  clientPhotoId?: string
) {
  const form = new FormData();
  frames.forEach((f, i) => form.append('frames', f, `frame_${i}.jpg`));
  form.append('eventId', eventId);
  if (sessionId) form.append('sessionId', sessionId);
  if (clientPhotoId) {
    form.append('clientPhotoId', clientPhotoId);
    form.append('client_photo_id', clientPhotoId);
    form.append('clientCaptureId', clientPhotoId);
  }

  const headers = getBoothHeaders(eventId, clientPhotoId);
  const res = await api.post('/photos/burst', form, { headers });
  return res.data;
}

export async function createStrip(
  photos: Blob[],
  eventId: string,
  clientPhotoId?: string,
  sessionId?: string
) {
  const form = new FormData();
  photos.forEach((p, i) => form.append('photos', p, `photo_${i}.jpg`));
  form.append('eventId', eventId);
  if (sessionId) form.append('sessionId', sessionId);
  if (clientPhotoId) {
    form.append('clientPhotoId', clientPhotoId);
    form.append('client_photo_id', clientPhotoId);
    form.append('clientCaptureId', clientPhotoId);
  }

  const headers = getBoothHeaders(eventId, clientPhotoId);
  const res = await api.post('/photos/strip', form, { headers });
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
  const token = typeof window !== 'undefined' ? localStorage.getItem('sb_access_token') : null;
  const response = await fetch(`${API_BASE}/api/photos/event/${eventId}/zip`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
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

export async function getPhotoCount(eventId: string): Promise<number> {
  const res = await api.get(`/photos/event/${eventId}/count`);
  return res.data.count ?? 0;
}

// ─── AI ────────────────────────────────────────────────────────────────────

export async function generateAI(blob: Blob, styleKey: string, eventId: string, photoId?: string) {
  const form = new FormData();
  form.append('photo', blob, 'photo.jpg');
  form.append('styleKey', styleKey);
  form.append('eventId', eventId);
  if (photoId) {
    form.append('photoId', photoId);
    form.append('clientPhotoId', photoId);
  }
  const headers = getBoothHeaders(eventId, photoId);
  const res = await api.post('/ai/generate', form, { headers });
  return res.data;
}

export async function generateSurpriseAI(blob: Blob, eventId: string) {
  const form = new FormData();
  form.append('photo', blob, 'photo.jpg');
  form.append('eventId', eventId);
  const headers = getBoothHeaders(eventId);
  const res = await api.post('/ai/surprise', form, { headers });
  return res.data;
}

export async function getAIStyles() {
  const res = await api.get('/ai/styles');
  return res.data.styles;
}

// ─── Events ────────────────────────────────────────────────────────────────

export async function getEvent(idOrSlug: string) {
  const res = await api.get(`/events/${idOrSlug}`);
  const eventData = res.data?.event || res.data;
  const boothToken = res.data?.boothToken || eventData?.boothToken;
  if (boothToken && eventData?.id) {
    setBoothToken(boothToken, eventData.id);
  }
  return eventData;
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

export async function testWebhook(
  eventId: string,
  webhookUrl: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await api.post(`/events/${eventId}/webhook-test`, { webhookUrl });
    return res.data;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return { ok: false, error: msg };
  }
}

// ─── Gallery ───────────────────────────────────────────────────────────────

export async function verifyGalleryPassword(eventId: string, password: string): Promise<boolean> {
  try {
    const res = await api.post(`/events/${eventId}/gallery-auth`, { password });
    return res.data.ok === true;
  } catch {
    return false;
  }
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

export async function getEventAnalytics(eventId: string, days = 30) {
  const res = await api.get(`/analytics/event/${eventId}?days=${days}`);
  return res.data;
}

export function exportAnalyticsCSV(
  rows: { action: string; metadata: Record<string, unknown>; created_at: string }[],
  eventName: string
) {
  const headers = ['Action', 'Mode', 'Details', 'Date'];
  const data = rows.map((r) => [
    r.action,
    (r.metadata?.mode as string) || '',
    JSON.stringify(r.metadata).replace(/"/g, "'"),
    new Date(r.created_at).toLocaleString(),
  ]);
  const csv = [headers, ...data]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${eventName.replace(/\s+/g, '_')}_analytics.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

// ─── Moderation ────────────────────────────────────────────────────────────

export async function hidePhoto(photoId: string, reason = '') {
  const res = await api.patch(`/photos/${photoId}/moderate`, { is_hidden: true, reason });
  return res.data;
}

export async function unhidePhoto(photoId: string) {
  const res = await api.patch(`/photos/${photoId}/moderate`, { is_hidden: false });
  return res.data;
}

export async function getEventPhotosWithHidden(eventId: string) {
  const res = await api.get(`/photos/event/${eventId}?include_hidden=true`);
  return res.data;
}

// ─── Leads ─────────────────────────────────────────────────────────────────

export async function submitLead(data: {
  eventId: string;
  photoId?: string;
  email?: string;
  phone?: string;
  name?: string;
  consented?: boolean;
}) {
  const res = await api.post('/leads', data);
  return res.data;
}

export async function getEventLeads(eventId: string) {
  const res = await api.get(`/leads/event/${eventId}`);
  return res.data;
}

export function exportLeadsCSV(
  leads: { email?: string; name?: string; phone?: string; created_at: string }[],
  eventName: string
) {
  const rows = [
    ['Name', 'Email', 'Phone', 'Captured At'],
    ...leads.map((l) => [l.name || '', l.email || '', l.phone || '', new Date(l.created_at).toLocaleString()]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${eventName.replace(/\s+/g, '_')}_leads.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Share ─────────────────────────────────────────────────────────────────

export async function sharePhotoByEmail(photoId: string, email: string, eventId: string) {
  const res = await api.post('/photos/share/email', { photoId, email, eventId });
  return res.data;
}

export async function sharePhotoBySMS(photoId: string, phone: string, eventId: string) {
  const res = await api.post('/photos/share/sms', { photoId, phone, eventId });
  return res.data;
}

// ─── Billing / Plan ────────────────────────────────────────────────────────

export async function getMyPlan() {
  const res = await api.get('/billing/my-plan');
  return res.data;
}

export async function checkEventLimits() {
  const res = await api.get('/billing/check-limits');
  return res.data;
}

export async function openBillingPortal() {
  const res = await api.post('/billing/portal');
  return res.data;
}

// ─── Email / Backgrounds / Templates ───────────────────────────────────────

export async function sendPhotoEmail(data: { eventId: string; photoId: string; email: string; name?: string }) {
  const res = await api.post('/email/photo', data);
  return res.data;
}

export async function getBackgrounds(eventId: string) {
  const res = await api.get(`/backgrounds/event/${eventId}`);
  return res.data.backgrounds;
}

export async function uploadBackground(eventId: string, file: File, name?: string) {
  const form = new FormData();
  form.append('file', file);
  if (name) form.append('name', name);
  const res = await api.post(`/backgrounds/event/${eventId}`, form);
  return res.data.background;
}

export async function getTemplates(eventId: string) {
  const res = await api.get(`/templates/event/${eventId}`);
  return res.data.templates;
}

export async function createTemplate(
  eventId: string,
  data: { name: string; layout?: Record<string, unknown>; isDefault?: boolean }
) {
  const res = await api.post(`/templates/event/${eventId}`, data);
  return res.data.template;
}
