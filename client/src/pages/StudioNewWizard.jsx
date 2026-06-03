import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useLayoutStore } from '@/store/layoutStore';
import { ROOM_TEMPLATES } from '@/utils/constants';
import Upload from '@/pages/Upload';
import ProjectSaveAuthModal from '@/components/project/ProjectSaveAuthModal';
import {
  createProjectDraft,
  createProjectSpaceDraft,
  upsertProject,
} from '@/utils/projectCompat';

const PROPERTY_TYPES = ['Apartment', 'House', 'Studio', 'Office', 'Retail / Hospitality', 'Other'];
const PROJECT_SCOPES = [
  { id: 'interior_only', label: 'Interior only' },
  { id: 'exterior_only', label: 'Exterior only' },
  { id: 'interior_exterior', label: 'Interior + Exterior' },
];

function normalizeProjectPayload(project) {
  if (!project) return null;
  return {
    ...project,
    propertyType: project.propertyType ?? project.property_type ?? 'House',
    globalVision: project.globalVision ?? project.global_vision ?? {},
    spaces: (project.spaces || []).map((space) => {
      const rawType = space.type ?? space.space_type;
      const pm = space.placeholderMode ?? space.placeholder_mode;
      let typeNorm = 'interior';
      if (typeof rawType === 'string') {
        typeNorm = rawType.toLowerCase() === 'exterior' ? 'exterior' : 'interior';
      } else if (pm === true) {
        typeNorm = 'exterior';
      }
      return {
        ...space,
        type: typeNorm,
        roomId: space.roomId ?? space.room_id ?? null,
        placeholderMode: space.placeholderMode ?? space.placeholder_mode ?? false,
        spaceVision: space.spaceVision ?? space.space_vision ?? {},
      };
    }),
    updatedAt: project.updatedAt ?? project.updated_at,
    createdAt: project.createdAt ?? project.created_at,
  };
}

/**
 * Full-page new project wizard — replaces dashboard modal.
 * Flow: Start → Details → upload branch OR blank/template → `/studio/project/:id/confirm?mode=adjust`.
 */
export default function StudioNewWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const createRoom = useLayoutStore((s) => s.createRoom);
  const createDraftRoom = useLayoutStore((s) => s.createDraftRoom);

  const urlStep = searchParams.get('step');
  const urlProjectId = searchParams.get('projectId');
  const [wizardStep, setWizardStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showSaveAuthGate, setShowSaveAuthGate] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '',
    propertyType: 'Apartment',
    scope: 'interior_exterior',
    startMode: 'upload',
    templateId: ROOM_TEMPLATES[0]?.id || '',
  });

  useEffect(() => {
    const initialStartMode = searchParams.get('startMode');
    const initialTemplateId = searchParams.get('templateId');
    if (initialStartMode === 'template' && initialTemplateId) {
      setProjectForm((s) => ({
        ...s,
        startMode: 'template',
        templateId: initialTemplateId,
        name: ROOM_TEMPLATES.find((t) => t.id === initialTemplateId)?.name || s.name,
      }));
    } else if (initialStartMode === 'blank') {
      setProjectForm((s) => ({ ...s, startMode: 'blank' }));
    }
    if (searchParams.get('step') === 'upload') {
      setProjectForm((s) => ({ ...s, startMode: 'upload' }));
    }
  }, [searchParams]);

  if (urlProjectId && urlStep === 'vision') {
    return <Navigate to={`/studio/project/${urlProjectId}/vision?setup=new`} replace />;
  }

  if (urlProjectId && urlStep !== 'upload') {
    return <Navigate to={`/studio/project/${urlProjectId}/vision?setup=new`} replace />;
  }

  if (urlStep === 'upload' && urlProjectId) {
    return <Upload embedInWizard />;
  }

  const createProject = async (authenticated = false) => {
    if (creating) return;
    if (!user && !authenticated && projectForm.startMode !== 'upload') {
      setShowSaveAuthGate(true);
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      let project = createProjectDraft({
        name: projectForm.name || 'Untitled Project',
        propertyType: projectForm.propertyType,
        startMode: projectForm.startMode,
      });
      project.scope = projectForm.scope;
      project.status = 'in_progress';

      try {
        const { data } = await api.post('/api/projects', {
          name: project.name,
          property_type: project.propertyType,
          scope: project.scope,
          global_vision: project.globalVision,
          status: project.status,
        });
        project = normalizeProjectPayload({ ...data, spaces: data.spaces || [] }) || project;
      } catch {
        // local compatibility path
      }

      if (projectForm.startMode === 'upload') {
        upsertProject(project);
        navigate(
          `/studio/new?projectId=${encodeURIComponent(project.id)}&step=upload&projectName=${encodeURIComponent(project.name || '')}`
        );
        return;
      }

      const shouldSeedInterior = projectForm.scope !== 'exterior_only';
      if (shouldSeedInterior) {
        const template = ROOM_TEMPLATES.find((t) => t.id === projectForm.templateId) || ROOM_TEMPLATES[0];
        const seedSpace = createProjectSpaceDraft(project, 'interior', {
          name: projectForm.startMode === 'template' ? template.name : 'Living Room',
          category: projectForm.startMode === 'template' ? template.name : 'Living Room',
        });
        try {
          const { data } = await api.post(`/api/projects/${project.id}/spaces`, {
            type: 'interior',
            name: seedSpace.name,
            category: seedSpace.category,
            placeholder_mode: false,
            space_vision: seedSpace.spaceVision,
            room_payload: {
              name: `${project.name} - ${seedSpace.name}`,
              width: projectForm.startMode === 'template' ? template.width : 240,
              depth: projectForm.startMode === 'template' ? template.depth : 180,
              height: projectForm.startMode === 'template' ? template.height : 96,
            },
          });
          const normalizedSpace = normalizeProjectPayload({ spaces: [data] })?.spaces?.[0];
          project.spaces = normalizedSpace ? [normalizedSpace] : [];
        } catch {
          try {
            const base =
              projectForm.startMode === 'template'
                ? {
                    name: `${project.name} - ${template.name}`,
                    width: template.width,
                    depth: template.depth,
                    height: template.height,
                  }
                : { name: `${project.name} - Interior`, width: 240, depth: 180, height: 96 };
            const created = user ? await createRoom(base) : createDraftRoom(base);
            project.spaces = [{ ...seedSpace, roomId: created.id }];
          } catch {
            project.spaces = [];
            toast.error('Project created, but initial space setup failed. Add spaces on the next step.');
          }
        }
      }

      project.updatedAt = new Date().toISOString();
      upsertProject(project);
      navigate(`/studio/project/${project.id}/confirm?mode=adjust`);
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || 'Failed to create project';
      setCreateError(message);
      toast.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>New Project — Vision Studio</title>
      </Helmet>
      <div className="mx-auto max-w-3xl bg-[#f6f3ee] px-6 py-16 text-[#171717] md:px-8 min-h-[calc(100vh-4rem)]">
        <button
          type="button"
          onClick={() => navigate('/studio')}
          className="text-[11px] uppercase tracking-editorial text-[#5b5b5b] hover:text-[#171717] mb-8"
        >
          ← Back to projects
        </button>

        <div className="flex gap-2 mb-10 text-[10px] uppercase tracking-[0.2em] text-[#5b5b5b]">
          <span className={wizardStep >= 1 ? 'text-[#004aad] font-semibold' : ''}>1 · Start</span>
          <span aria-hidden>→</span>
          <span className={wizardStep >= 2 ? 'text-[#004aad] font-semibold' : ''}>2 · Details</span>
        </div>

        {wizardStep === 1 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-vs-accent mb-4">New project</p>
            <h1 className="display-lg mb-6">How would you like to begin?</h1>
            <div className="grid grid-cols-3 gap-2 mb-10">
              {['upload', 'blank', 'template'].map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setProjectForm((s) => ({ ...s, startMode: mode }))}
                  className={`rounded-xl px-3 py-4 text-[11px] uppercase tracking-editorial border min-h-[88px] ${
                    projectForm.startMode === mode
                      ? 'border-[#004aad] text-[#004aad] bg-[#eef4f7]'
                      : 'border-[rgba(0,0,0,0.08)] text-[#5b5b5b] bg-[#f8f8f6]'
                  }`}
                >
                  {mode === 'upload' ? 'Upload Floorplan' : mode === 'blank' ? 'Start Blank' : 'Use Template'}
                </button>
              ))}
            </div>
            <button type="button" className="btn-ink" onClick={() => setWizardStep(2)}>
              Continue
            </button>
          </div>
        )}

        {wizardStep === 2 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createProject();
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-vs-accent mb-4">Project details</p>
            <h1 className="display-lg mb-8">Name your project</h1>
            <label className="block mb-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Project name</div>
              <input
                className="input-field bg-[#fffdf9]"
                value={projectForm.name}
                onChange={(e) => setProjectForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Untitled Project"
              />
            </label>
            <label className="block mb-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Property type</div>
              <select
                className="input-field bg-[#fffdf9]"
                value={projectForm.propertyType}
                onChange={(e) => setProjectForm((s) => ({ ...s, propertyType: e.target.value }))}
              >
                {PROPERTY_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Scope</div>
            <div className="grid grid-cols-3 gap-2 mb-8">
              {PROJECT_SCOPES.map((scope) => (
                <button
                  type="button"
                  key={scope.id}
                  onClick={() => setProjectForm((s) => ({ ...s, scope: scope.id }))}
                  className={`rounded-lg px-3 py-2 text-[11px] uppercase tracking-editorial border ${
                    projectForm.scope === scope.id
                      ? 'border-[#004aad] text-[#004aad] bg-[#eef4f7]'
                      : 'border-[rgba(0,0,0,0.08)] text-[#5b5b5b]'
                  }`}
                >
                  {scope.label}
                </button>
              ))}
            </div>
            {projectForm.startMode === 'template' && (
              <label className="block mb-8">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#5b5b5b] mb-2">Template</div>
                <select
                  className="input-field bg-[#fffdf9]"
                  value={projectForm.templateId}
                  onChange={(e) => setProjectForm((s) => ({ ...s, templateId: e.target.value }))}
                >
                  {ROOM_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {createError && (
              <div className="mb-4 rounded-lg border border-[rgba(143,77,77,0.3)] bg-[#fff1f1] px-3 py-2 text-sm text-[#7a2f2f]">
                {createError}
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" className="btn-ghost" onClick={() => setWizardStep(1)}>
                Back
              </button>
              <button type="submit" className="btn-ink" disabled={creating}>
                {creating ? 'Creating…' : 'Create & continue'}
              </button>
            </div>
          </form>
        )}
      </div>

      {showSaveAuthGate && (
        <ProjectSaveAuthModal
          onClose={() => setShowSaveAuthGate(false)}
          onAuthed={() => {
            setShowSaveAuthGate(false);
            createProject(true);
          }}
        />
      )}
    </>
  );
}
