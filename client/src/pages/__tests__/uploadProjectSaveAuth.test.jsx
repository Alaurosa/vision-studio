import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadSource = readFileSync(resolve(__dirname, '../Upload.jsx'), 'utf8');
const wizardSource = readFileSync(resolve(__dirname, '../StudioNewWizard.jsx'), 'utf8');

describe('project save auth gate', () => {
  it('Upload prompts guests before vision handoff', () => {
    expect(uploadSource).toContain('ProjectSaveAuthModal');
    expect(uploadSource).toContain('showSaveAuthGate');
    expect(uploadSource).toContain('ProjectSaveAuthModal');
    expect(uploadSource).toMatch(/if\s*\(\s*!user\s*\)/);
    expect(uploadSource).toContain('finalizeAndGoToVision(true)');
    expect(uploadSource).toContain('persistFloorplanRoomToServer');
  });

  it('StudioNewWizard prompts guests before blank/template confirm', () => {
    expect(wizardSource).toContain('ProjectSaveAuthModal');
    expect(wizardSource).toContain("startMode !== 'upload'");
    expect(wizardSource).toContain('createProject(true)');
  });
});
