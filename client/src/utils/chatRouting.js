const NAV_VERBS = [
  'edit',
  'open',
  'continue',
  'work on',
  'go to',
  'take me to',
  'show me',
  'modify',
  'refine',
  'change',
  'update',
];

const SPACE_KEYWORDS = [
  'bedroom',
  'living room',
  'kitchen',
  'bathroom',
  'dining room',
  'office',
  'backyard',
  'back yard',
  'frontyard',
  'front yard',
  'exterior',
  'interior',
];

const normalize = (text) => String(text || '').toLowerCase().trim();

const toTime = (value) => {
  const t = new Date(value || 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

const isNavigationIntent = (message) => {
  const m = normalize(message);
  return NAV_VERBS.some((verb) => m.includes(verb));
};

const extractSpaceHints = (message) => {
  const m = normalize(message);
  return SPACE_KEYWORDS.filter((k) => m.includes(k));
};

const scoreNameMatch = (messageNorm, candidate) => {
  const c = normalize(candidate);
  if (!c) return 0;
  if (messageNorm === c) return 100;
  if (messageNorm.includes(c)) return 90;
  if (c.includes(messageNorm)) return 60;
  const parts = c.split(/\s+/).filter(Boolean);
  const overlap = parts.filter((p) => messageNorm.includes(p)).length;
  return overlap * 10;
};

const sortByRecent = (a, b) => {
  const aT = toTime(a.updatedAt || a.updated_at || a.createdAt || a.created_at);
  const bT = toTime(b.updatedAt || b.updated_at || b.createdAt || b.created_at);
  return bT - aT;
};

export function getChatRoutableProjects(rawProjects = []) {
  return (rawProjects || [])
    .map((p) => ({
      ...p,
      spaces: (p.spaces || []).map((s) => ({
        ...s,
        type: normalize(s.type || s.space_type) === 'exterior' ? 'exterior' : 'interior',
        roomId: s.roomId || s.room_id || null,
      })),
    }))
    .sort(sortByRecent);
}

export function findProjectSpaceMatches(message, projects) {
  const m = normalize(message);
  const spaceHints = extractSpaceHints(message);

  const projectMatches = projects
    .map((project) => ({
      project,
      score: scoreNameMatch(m, project.name),
    }))
    .filter((x) => x.score >= 30)
    .sort((a, b) => b.score - a.score);

  const spaceMatches = [];
  for (const project of projects) {
    for (const space of project.spaces || []) {
      const spaceNameScore = Math.max(scoreNameMatch(m, space.name), scoreNameMatch(m, space.category));
      const typeBonus = spaceHints.some((hint) => normalize(space.name).includes(hint)) ? 30 : 0;
      const interiorExteriorBonus =
        (spaceHints.includes('exterior') && space.type === 'exterior') ||
        (spaceHints.includes('interior') && space.type === 'interior')
          ? 20
          : 0;
      const score = spaceNameScore + typeBonus + interiorExteriorBonus;
      if (score >= 40) {
        spaceMatches.push({ project, space, score });
      }
    }
  }
  spaceMatches.sort((a, b) => b.score - a.score);

  return { projectMatches, spaceMatches, spaceHints };
}

export function buildStudioRoute(match) {
  if (match.space?.id) {
    return `/studio/project/${match.project.id}/editor/${match.space.id}`;
  }
  return `/studio/project/${match.project.id}`;
}

export function handleChatNavigationIntent(message, projects) {
  const m = normalize(message);
  if (!isNavigationIntent(m)) return { kind: 'none' };

  if (!projects || projects.length === 0) {
    return {
      kind: 'not_found',
      context: null,
      assistantText:
        "I couldn't find that space yet. You can start a new project or open Studio to choose one.",
      options: [
        { label: 'Start a new project', to: '/studio/new' },
        { label: 'Open Studio', to: '/studio' },
      ],
    };
  }

  const latestProject = [...projects].sort(sortByRecent)[0];
  const latestSpace = [...(latestProject?.spaces || [])].sort(sortByRecent)[0];
  const asksLatest = m.includes('latest') || m.includes('most recent') || m.includes('continue editing');

  if (asksLatest) {
    if (latestSpace?.id) {
      return {
        kind: 'route',
        context: {
          projectId: latestProject.id,
          projectName: latestProject.name,
          spaceId: latestSpace.id,
          spaceName: latestSpace.name,
          label: `${latestProject.name} · ${latestSpace.name}`,
        },
        assistantText: `I can take you to **${latestProject.name} — ${latestSpace.name}** in Studio.`,
        to: `/studio/project/${latestProject.id}/editor/${latestSpace.id}`,
      };
    }
    return {
      kind: 'route',
      context: {
        projectId: latestProject.id,
        projectName: latestProject.name,
        label: latestProject.name,
      },
      assistantText: `I can take you to your latest project, **${latestProject.name}**.`,
      to: `/studio/project/${latestProject.id}`,
    };
  }

  const { projectMatches, spaceMatches } = findProjectSpaceMatches(message, projects);

  if (projectMatches.length === 1) {
    const selectedProject = projectMatches[0].project;
    const spacesInProject = spaceMatches.filter((x) => x.project.id === selectedProject.id);
    if (spacesInProject.length === 1) {
      const exact = spacesInProject[0];
      return {
        kind: 'route',
        context: {
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          spaceId: exact.space.id,
          spaceName: exact.space.name,
          label: `${selectedProject.name} · ${exact.space.name}`,
        },
        assistantText: `I can take you to **${selectedProject.name} — ${exact.space.name}** so you can edit directly in Studio.`,
        to: buildStudioRoute(exact),
      };
    }
    if (spacesInProject.length > 1) {
      return {
        kind: 'suggest',
        context: {
          projectId: selectedProject.id,
          projectName: selectedProject.name,
          label: selectedProject.name,
        },
        assistantText: `I found multiple spaces in **${selectedProject.name}**. Pick one:`,
        options: spacesInProject.slice(0, 4).map((x) => ({
          label: `Open ${selectedProject.name} — ${x.space.name}`,
          to: buildStudioRoute(x),
        })),
      };
    }
    return {
      kind: 'route',
      context: {
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        label: selectedProject.name,
      },
      assistantText: `I can take you to **${selectedProject.name}** in Studio.`,
      to: `/studio/project/${selectedProject.id}`,
    };
  }

  if (spaceMatches.length === 1) {
    const exact = spaceMatches[0];
    return {
      kind: 'route',
      context: {
        projectId: exact.project.id,
        projectName: exact.project.name,
        spaceId: exact.space.id,
        spaceName: exact.space.name,
        label: `${exact.project.name} · ${exact.space.name}`,
      },
      assistantText: `I can take you to **${exact.project.name} — ${exact.space.name}** in Studio.`,
      to: buildStudioRoute(exact),
    };
  }

  if (spaceMatches.length > 1) {
    return {
      kind: 'suggest',
      context: null,
      assistantText: 'I found a few possible matches. Pick where you want to edit:',
      options: spaceMatches.slice(0, 4).map((x) => ({
        label: `Open ${x.project.name} — ${x.space.name}`,
        to: buildStudioRoute(x),
      })),
    };
  }

  if (projectMatches.length > 1) {
    return {
      kind: 'suggest',
      context: null,
      assistantText: 'I found multiple project matches. Pick one:',
      options: projectMatches.slice(0, 4).map((x) => ({
        label: `Open ${x.project.name}`,
        to: `/studio/project/${x.project.id}`,
      })),
    };
  }

  return {
    kind: 'not_found',
    context: null,
    assistantText:
      "I couldn't find that space yet. You can start a new project or open Studio to choose one.",
    options: [
      { label: 'Start a new project', to: '/studio/new' },
      { label: 'Open Studio', to: '/studio' },
    ],
  };
}
