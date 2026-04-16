import { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';

const STEPS = [
  { id: 'upload', label: 'Uploading floor plan', icon: '📤', duration: 1500 },
  { id: 'preprocess', label: 'Preprocessing image', icon: '🖼️', duration: 2000 },
  { id: 'detect_walls', label: 'Detecting walls & boundaries', icon: '🧱', duration: 3000 },
  { id: 'detect_rooms', label: 'Identifying room areas', icon: '🏠', duration: 2500 },
  { id: 'measure', label: 'Estimating dimensions', icon: '📏', duration: 2000 },
  { id: 'finalize', label: 'Finalizing layout', icon: '✅', duration: 1000 },
];

export default function AnalysisWorkflow({ roomId, file, onComplete, onCancel }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [done, setDone] = useState(false);
  const uploadStarted = useRef(false);

  // Run the actual upload in the background while showing animated steps
  useEffect(() => {
    if (uploadStarted.current) return;
    uploadStarted.current = true;

    const uploadFile = async () => {
      const form = new FormData();
      form.append('file', file);
      try {
        const { data } = await api.post(`/api/rooms/${roomId}/upload-floorplan`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        });
        setResult(data);
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      }
    };
    uploadFile();
  }, [roomId, file]);

  // Animate through steps with progress bar
  useEffect(() => {
    if (done || error) return;

    const totalDuration = STEPS.reduce((sum, s) => sum + s.duration, 0);
    let elapsed = 0;
    for (let i = 0; i < currentStep; i++) elapsed += STEPS[i].duration;

    const step = STEPS[currentStep];
    if (!step) return;

    const startTime = Date.now();
    const timer = setInterval(() => {
      const dt = Date.now() - startTime;
      const stepProgress = Math.min(dt / step.duration, 1);
      const totalProgress = ((elapsed + dt) / totalDuration) * 100;
      setProgress(Math.min(totalProgress, currentStep === STEPS.length - 1 ? 100 : 95));

      if (stepProgress >= 1) {
        clearInterval(timer);
        if (currentStep < STEPS.length - 1) {
          setCurrentStep(prev => prev + 1);
        } else {
          // Last step done — wait for result or show done
          setDone(true);
        }
      }
    }, 50);

    return () => clearInterval(timer);
  }, [currentStep, done, error]);

  // When both animation is done and we have a result, finish
  useEffect(() => {
    if (done && result) {
      const timer = setTimeout(() => onComplete(result), 800);
      return () => clearTimeout(timer);
    }
  }, [done, result]);

  // If we get an error, allow showing it
  useEffect(() => {
    if (error) setProgress(0);
  }, [error]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900/70 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-xl font-bold text-white">Analyzing Floor Plan</h2>
          <p className="text-sm text-slate-500 mt-1">
            {file?.name || 'floor-plan'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="px-6">
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${error ? 0 : progress}%`,
                background: done && result ? '#16a34a' : 'linear-gradient(90deg, #2563eb, #7c3aed)',
              }}
            />
          </div>
          <p className="text-right text-xs text-slate-500 mt-1">
            {error ? 'Error' : done && result ? '100%' : `${Math.round(progress)}%`}
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 py-4 space-y-3">
          {STEPS.map((step, i) => {
            const isActive = i === currentStep && !done && !error;
            const isComplete = i < currentStep || (done && !error);
            const isPending = i > currentStep && !done;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-300 ${
                  isActive ? 'bg-brand-500/10 border border-brand-500/30' :
                  isComplete ? 'bg-green-500/10 border border-green-500/20' :
                  'bg-slate-900 border border-transparent'
                }`}
              >
                <div className="text-lg w-7 text-center shrink-0">
                  {isComplete ? '✅' : isActive ? (
                    <span className="inline-block w-5 h-5 border-2 border-brand-500/50 border-t-brand-600 rounded-full animate-spin" />
                  ) : step.icon}
                </div>
                <span className={`text-sm ${
                  isActive ? 'text-brand-200 font-medium' :
                  isComplete ? 'text-green-300' :
                  'text-slate-500'
                }`}>
                  {step.label}
                </span>
                {isActive && (
                  <span className="ml-auto text-xs text-brand-400">Processing...</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Error state */}
        {error && (
          <div className="px-6 pb-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          </div>
        )}

        {/* Done state — waiting for server */}
        {done && !result && !error && (
          <div className="px-6 pb-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-400 flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              Waiting for server to finish processing...
            </div>
          </div>
        )}

        {/* Done state — success */}
        {done && result && (
          <div className="px-6 pb-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-300">
              Analysis complete! {result.parse_result?.rooms?.length
                ? `Detected ${result.parse_result.rooms.length} room(s).`
                : result.parse_result?.walls?.length
                ? `Detected ${result.parse_result.walls.length} wall segments.`
                : 'Floor plan saved as background.'}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end gap-2">
          {error && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700 transition"
            >
              Close
            </button>
          )}
          {!done && !error && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-slate-500 hover:text-slate-300 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
