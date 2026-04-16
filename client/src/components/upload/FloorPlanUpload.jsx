import { useState, useRef } from 'react';
import api from '../../lib/api';

export default function FloorPlanUpload({ roomId, onComplete, onAnalysisStart }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // If we have the analysis workflow, delegate to it
    if (onAnalysisStart) {
      onAnalysisStart(file);
      // Reset the file input
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    // Fallback: direct upload without workflow
    setUploading(true);
    setError('');
    setResult(null);
    setProgress('Uploading floor plan...');

    const form = new FormData();
    form.append('file', file);

    try {
      setProgress('Analyzing floor plan (detecting rooms)...');
      const { data } = await api.post(`/api/rooms/${roomId}/upload-floorplan`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      const rooms = data.parse_result?.rooms || [];
      const walls = data.parse_result?.walls || [];
      const points = data.parse_result?.points || [];

      if (rooms.length > 0) {
        const roomLabels = rooms.map(r => r.label).join(', ');
        setResult({ type: 'success', message: `Detected ${rooms.length} room${rooms.length > 1 ? 's' : ''}: ${roomLabels}.` });
      } else if (walls.length > 0 || points.length > 0) {
        setResult({ type: 'success', message: `Detected room boundary (${walls.length || points.length} wall segments).` });
      } else if (data.floor_plan_url) {
        setResult({ type: 'partial', message: 'Floor plan saved as room background. Set room dimensions manually.' });
      } else {
        setResult({ type: 'warning', message: 'Upload saved but AI parsing unavailable.' });
      }

      setProgress('');
      onComplete?.(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 border-2 border-dashed border-white/10 rounded-xl p-5 text-center hover:border-brand-500/50 hover:bg-brand-500/10/30 transition group cursor-pointer" onClick={(e) => { if (e.target.closest('p') || uploading) return; fileRef.current?.click(); }}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleUpload}
      />
      <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center group-hover:bg-brand-100 transition">
        <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-200 mb-0.5">
        {uploading ? progress : 'Floor Plan'}
      </p>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      {result?.type === 'success' && <p className="text-green-400 text-xs mt-1">{result.message}</p>}
      {result?.type === 'partial' && <p className="text-amber-400 text-xs mt-1">{result.message}</p>}
      {result?.type === 'warning' && <p className="text-amber-400 text-xs mt-1">{result.message}</p>}
      {!result && !uploading && <p className="text-slate-500 text-xs">JPEG, PNG, WebP, or PDF</p>}
    </div>
  );
}
