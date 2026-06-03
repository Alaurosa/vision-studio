import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import ProjectVisionIntake from '@/components/project/ProjectVisionIntake';

vi.mock('@/lib/api', () => ({
  default: { post: vi.fn() },
}));

describe('ProjectVisionIntake', () => {
  it('renders project spaces as automatic context', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
        <ProjectVisionIntake
          project={{
            id: 'proj-1',
            name: 'Coastal Home',
            spaces: [
              { id: 'z0', name: 'Living Room', type: 'interior', category: 'Living' },
              { id: 'z1', name: 'Bedroom', type: 'interior', category: 'Bedroom' },
            ],
          }}
        />
        </MemoryRouter>
      </HelmetProvider>,
    );
    expect(screen.getByText('Living Room')).toBeInTheDocument();
    expect(screen.getByText('Bedroom')).toBeInTheDocument();
    expect(screen.getByText(/Project Vision Assistant/i)).toBeInTheDocument();
  });
});
