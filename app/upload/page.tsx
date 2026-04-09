import { RoomUploader } from '@components/editor/RoomUploader';

export default function UploadPage() {
  return (
    <section className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-xl shadow-black/20">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-200">Upload</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Upload a room photo</h1>
          <p className="max-w-2xl text-slate-300">
            This page is a placeholder for the image upload and room analysis flow. Image analysis is not implemented yet.
          </p>
        </div>
      </div>
      <RoomUploader />
    </section>
  );
}
