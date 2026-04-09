'use client';

import Image from 'next/image';
import { useAppStore } from '@store/appStore';
import { EmptyState } from '@components/ui/EmptyState';

export function LayoutCanvas() {
  const uploadedImageUrl = useAppStore((state) => state.uploadedImageUrl);
  const roomLayout = useAppStore((state) => state.roomLayout);

  return (
    <div className="min-h-[420px] rounded-3xl border border-white/10 bg-slate-950/80 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Layout canvas</h2>
          <p className="text-sm text-slate-400">Mock preview of the room and future furniture placements.</p>
        </div>
      </div>
      {uploadedImageUrl ? (
        <div className="relative h-[320px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
          <Image
            src={uploadedImageUrl}
            alt="Room preview"
            fill
            className="object-cover opacity-90"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
          <div className="absolute left-4 top-4 space-y-2 rounded-2xl bg-slate-950/80 p-3 text-xs text-slate-200">
            <p>{roomLayout.roomType}</p>
            <p>{roomLayout.summary}</p>
          </div>
        </div>
      ) : (
        <EmptyState message="Your canvas will display here once a room image is selected." />
      )}
    </div>
  );
}
