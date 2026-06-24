'use client';

import { useState } from 'react';
import { X, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendPhotoEmail } from '@/lib/api';

export function EmailCaptureModal({ eventId, photoId, onClose }: { eventId: string; photoId: string; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    setSending(true);
    try {
      await sendPhotoEmail({ eventId, photoId, email, name });
      toast.success('Photo emailed!');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Email failed');
    } finally {
      setSending(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="w-full max-w-md rounded-3xl bg-white p-6 text-gray-950 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-black">Email my photo</h3><button onClick={onClose}><X /></button></div>
      <input className="mb-3 w-full rounded-xl border px-4 py-3" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="mb-4 w-full rounded-xl border px-4 py-3" placeholder="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button onClick={submit} disabled={sending || !email} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-bold text-white disabled:opacity-50"><Mail size={18} />{sending ? 'Sending...' : 'Send photo'}</button>
    </div>
  </div>;
}
