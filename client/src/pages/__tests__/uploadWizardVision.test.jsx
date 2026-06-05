import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StudioNewWizard from '@/pages/StudioNewWizard';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadSource = readFileSync(resolve(__dirname, '../Upload.jsx'), 'utf8');

vi.mock('@/pages/Upload', () => ({
  default: () => <div data-testid="wizard-upload-step">Upload step</div>,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/store/layoutStore', () => ({
  useLayoutStore: (selector) =>
    selector({
      createRoom: vi.fn(),
      createDraftRoom: vi.fn(),
    }),
}));

vi.mock('@/lib/api', () => ({
  default: { post: vi.fn() },
}));

describe('upload wizard vision routing', () => {
  it('removes the old manual vision overlay copy from Upload.jsx', () => {
    expect(uploadSource).not.toContain('What feeling should guests have when entering?');
    expect(uploadSource).not.toContain('Describe the whole-house mood');
    expect(uploadSource).not.toContain('Inspiration image (optional)');
    expect(uploadSource).not.toContain('visionStep');
    expect(uploadSource).toContain('continueToProjectVision');
    expect(uploadSource).toContain('/vision?setup=new');
  });

  it('redirects /studio/new?projectId=... to Project Vision Assistant', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/studio/new?projectId=proj-wizard-1']}>
          <Routes>
            <Route path="/studio/new" element={<StudioNewWizard />} />
            <Route
              path="/studio/project/:projectId/vision"
              element={<div data-testid="project-vision-route">Project Vision Assistant route</div>}
            />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );
    expect(await screen.findByTestId('project-vision-route')).toBeInTheDocument();
  });

  it('keeps /studio/new?projectId=...&step=upload on the upload step', () => {
    render(
      <HelmetProvider>
        <MemoryRouter
          initialEntries={['/studio/new?projectId=proj-wizard-2&step=upload&projectName=Test']}
        >
          <Routes>
            <Route path="/studio/new" element={<StudioNewWizard />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );
    expect(screen.getByTestId('wizard-upload-step')).toBeInTheDocument();
  });

  it('still renders the new-project wizard without projectId', () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/studio/new']}>
          <Routes>
            <Route path="/studio/new" element={<StudioNewWizard />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );
    expect(screen.getByText(/How would you like to begin\?/i)).toBeInTheDocument();
  });
});
