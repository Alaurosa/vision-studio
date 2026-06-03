import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import ProjectVisionIntake from '@/components/project/ProjectVisionIntake';
import {
  GUIDED_STEP_SUMMARY_MESSAGE_ID,
  isVisionSaveStatusMessage,
} from '@/utils/projectVisionIntakeChat';
import { evaluateGuidedVisionReadiness } from '@/utils/guidedVisionFlow';

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
  globalVision: {},
  spaces: [
    { id: 'z0', name: 'Living Room', type: 'interior', category: 'Living' },
    { id: 'z1', name: 'Bedroom', type: 'interior', category: 'Bedroom' },
  ],
};

let storedProject = { ...baseProject };

vi.mock('@/utils/projectCompat', () => ({
  getProjectById: vi.fn(() => storedProject),
  upsertProject: vi.fn((p) => {
    storedProject = p;
    return p;
  }),
}));

function renderIntake(project = baseProject, route = '/vision?setup=new') {
  storedProject = project;
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[route]}>
        <ProjectVisionIntake project={project} />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

async function pickGuidedChips(user, labels) {
  for (const label of labels) {
    const buttons = screen.getAllByRole('button', { name: label });
    await user.click(buttons[0]);
  }
}

function continueButton() {
  return screen.getAllByRole('button', { name: /Review Project & Spaces|Continue to Studio/i })[0];
}

describe('ProjectVisionIntake guided flow', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockRejectedValue(new Error('network'));
    storedProject = { ...baseProject, globalVision: {} };
  });

  it('renders project spaces as automatic context', () => {
    renderIntake();
    expect(screen.getByText('Living Room')).toBeInTheDocument();
    expect(screen.getByText('Bedroom')).toBeInTheDocument();
    expect(screen.getByText(/Project Vision Assistant/i)).toBeInTheDocument();
  });

  it('does not require typing a paragraph to enable continue', async () => {
    const user = userEvent.setup();
    renderIntake();

    expect(continueButton()).toBeDisabled();

    await pickGuidedChips(user, ['Warm', 'Modern']);
    await pickGuidedChips(user, ['Better flow', 'Hosting guests']);
    await pickGuidedChips(user, ['Pet-friendly']);
    await user.click(screen.getByRole('button', { name: 'Living Room' }));
    await user.click(screen.getByRole('button', { name: 'Hosting' }));

    await waitFor(() => {
      expect(continueButton()).not.toBeDisabled();
      expect(screen.getAllByText(/Ready — I’ll carry this context into the Studio/i)[0]).toBeInTheDocument();
    });
  });

  it('passes structured global_vision when user sends a chat message', async () => {
    api.post.mockResolvedValueOnce({ data: { message: 'Sounds great.' } });
    const user = userEvent.setup();
    renderIntake();

    await pickGuidedChips(user, ['Warm', 'Modern', 'Better flow', 'Hosting guests', 'Pet-friendly']);
    await user.click(screen.getByRole('button', { name: 'Use all rooms evenly' }));

    const chatInput = screen.getAllByPlaceholderText(/Ask the assistant anything/i)[0];
    await user.type(chatInput, 'focus on natural light');
    await user.click(screen.getAllByRole('button', { name: 'Send' })[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
      const body = api.post.mock.calls[0][1];
      expect(body.global_vision.moodTags).toContain('Warm');
      expect(body.global_vision.priorities.length).toBeGreaterThanOrEqual(2);
      expect(body.global_vision.constraints).toContain('Pet-friendly');
      expect(body.global_vision.useAllRoomsEvenly).toBe(true);
    });
  });

  it('does not stack duplicate save-status cards when assistant API fails twice', async () => {
    const user = userEvent.setup();
    renderIntake();

    const chatInput = screen.getAllByPlaceholderText(/Ask the assistant anything/i)[0];
    await user.type(chatInput, 'add a storage-focused area');
    await user.click(screen.getAllByRole('button', { name: 'Send' })[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
      expect(screen.getAllByText(/Your direction is saved/i)).toHaveLength(1);
    });

    await user.clear(chatInput);
    await user.type(chatInput, 'make sure it is host-focused');
    await user.click(screen.getAllByRole('button', { name: 'Send' })[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(2);
    });

    expect(screen.getAllByText(/Your direction is saved/i)).toHaveLength(1);
  });

  it('upserts one guided step summary instead of stacking duplicates', async () => {
    const user = userEvent.setup();
    renderIntake();

    await pickGuidedChips(user, ['Warm', 'Modern']);

    const summaries = screen.getAllByText(/overall feeling/i);
    expect(summaries.length).toBe(1);
    expect(GUIDED_STEP_SUMMARY_MESSAGE_ID).toBe('vision-guided-step-summary');
  });

  it('shows rehydrated user messages from saved thread', () => {
    const projectWithThread = {
      ...baseProject,
      globalVision: {
        moodTags: ['Warm', 'Modern'],
        priorities: ['Better flow', 'Hosting guests'],
        constraints: ['Pet-friendly'],
        useAllRoomsEvenly: true,
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

  it('explains missing items when continue is disabled', () => {
    renderIntake();
    expect(screen.getAllByText(/Choose|Still needed/i)[0]).toBeInTheDocument();
    const { helperText } = evaluateGuidedVisionReadiness({}, baseProject);
    expect(helperText.length).toBeGreaterThan(0);
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
