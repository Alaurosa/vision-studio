import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import ProjectVisionIntake from '@/components/project/ProjectVisionIntake';
import { isVisionSaveStatusMessage } from '@/utils/projectVisionIntakeChat';

vi.mock('@/lib/api', () => ({
  default: { post: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const baseProject = {
  id: 'proj-1',
  name: 'Coastal Home',
  scope: 'interior_exterior',
  globalVision: {
    summary: 'Whole-property direction: warm, minimal, host-focused for guests and family.',
    moodTags: ['warm', 'minimal'],
    styleKeywords: ['warm', 'minimal'],
    priorities: ['hosting'],
  },
  spaces: [
    { id: 'z0', name: 'Living Room', type: 'interior', category: 'Living' },
    { id: 'z1', name: 'Bedroom', type: 'interior', category: 'Bedroom' },
  ],
};

vi.mock('@/utils/projectCompat', () => ({
  getProjectById: vi.fn(() => baseProject),
  upsertProject: vi.fn((p) => p),
}));

function renderIntake(project = baseProject) {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ProjectVisionIntake project={project} />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('ProjectVisionIntake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockRejectedValue(new Error('network'));
  });

  it('renders project spaces as automatic context', () => {
    renderIntake();
    expect(screen.getByText('Living Room')).toBeInTheDocument();
    expect(screen.getByText('Bedroom')).toBeInTheDocument();
    expect(screen.getByText(/Project Vision Assistant/i)).toBeInTheDocument();
  });

  it('does not stack duplicate save-status cards when assistant API fails twice', async () => {
    const user = userEvent.setup();
    renderIntake();

    const input = screen.getAllByPlaceholderText(/Tell me anything specific/i)[0];
    await user.type(input, 'add a storage-focused area');
    await user.click(screen.getAllByRole('button', { name: 'Send' })[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
      expect(screen.getAllByText(/Your direction is saved/i)).toHaveLength(1);
    });

    await user.clear(input);
    await user.type(input, 'make sure it is host-focused');
    await user.click(screen.getAllByRole('button', { name: 'Send' })[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(2);
    });

    const statusTexts = screen.getAllByText(/Your direction is saved/i);
    expect(statusTexts).toHaveLength(1);
    expect(screen.getByText('add a storage-focused area')).toBeInTheDocument();
    expect(screen.getByText(/make sure it is host-focused/i)).toBeInTheDocument();
  });

  it('shows rehydrated user messages from saved thread', () => {
    const projectWithThread = {
      ...baseProject,
      globalVision: {
        ...baseProject.globalVision,
        visionIntakeThread: [
          { id: 'u-1', role: 'user', content: 'first note' },
          {
            id: 'a-old-1',
            role: 'assistant',
            content: 'Your direction is saved. Quick suggestions:\n\n- one',
          },
          { id: 'u-2', role: 'user', content: 'second note' },
        ],
      },
    };
    renderIntake(projectWithThread);
    expect(screen.getByText('first note')).toBeInTheDocument();
    expect(screen.getByText('second note')).toBeInTheDocument();
  });
});

describe('ProjectVisionIntake save-status helpers integration', () => {
  it('status message uses stable id', () => {
    const msg = {
      id: 'vision-save-status',
      role: 'assistant',
      type: 'assistant_status',
      content: 'Your direction is saved. Quick suggestions:\n\n- x',
    };
    expect(isVisionSaveStatusMessage(msg)).toBe(true);
  });
});
