'use client';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@store/appStore';

export function RoomUploader() {
  const router = useRouter();
  const setUploadedImageUrl = useAppStore((state) => state.setUploadedImageUrl);

  const handlePreviewClick = () => {
    setUploadedImageUrl('/placeholder-room.jpg');
    router.push('/editor');
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-xl shadow-black/20">
      <div className="space-y-4">
        <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/70 p-10 text-center text-slate-400">
          <p className="text-lg font-semibold text-white">Room photo upload placeholder</p>
          <p className="mt-3 text-sm leading-6">
            Drag and drop will be implemented later. For now, use the mock preview action.
          </p>
          <div className="mt-6 rounded-2xl bg-slate-900 px-6 py-4">
            <p className="text-sm text-slate-400">Drop an empty room photo here in a future version.</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">No real upload logic is included.</p>
          </div>
          <button
            type="button"
            onClick={handlePreviewClick}
            className="inline-flex items-center justify-center rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Use Mock Room and Continue
          </button>
        </div>
      </div>
    </div>
  );
}
