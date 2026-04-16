import { useState, useRef } from 'react';
import api from '../../lib/api';

export default function RoomPhotoUpload({ roomId, onDetectionComplete }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setResult(null);
    setProgress('Uploading photo...');

    const form = new FormData();
    form.append('file', file);

    try {
      setProgress('Detecting furniture (AI)...');
      const { data } = await api.post(`/api/recognition/room-photo/${roomId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      const count = data.detections?.length || 0;
      if (count > 0) {
        setResult({ type: 'success', message: `Found ${count} objects.` });
      } else if (data.room_photo_url) {
        setResult({ type: 'partial', message: 'Photo saved as room background. AI detection unavailable — place furniture manually.' });
      } else {
        setResult({ type: 'warning', message: 'Upload processed but no detections found.' });
      }

      setProgress('');
      onDetectionComplete?.(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 border-2 border-dashed border-white/10 rounded-xl p-5 text-center hover:border-blue-300 hover:bg-blue-500/10/30 transition group cursor-pointer" onClick={() => !uploading && fileRef.current?.click()}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition">
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-200 mb-0.5">
        {uploading ? progress : 'Room Photo'}
      </p>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      {result?.type === 'success' && <p className="text-green-400 text-xs mt-1">{result.message}</p>}
      {result?.type === 'partial' && <p className="text-amber-400 text-xs mt-1">{result.message}</p>}
      {result?.type === 'warning' && <p className="text-amber-400 text-xs mt-1">{result.message}</p>}
      {!result && !uploading && <p className="text-slate-500 text-xs">Auto-detect furniture with AI</p>}
    </div>
  );
}
