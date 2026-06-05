import { evaluateGuidedVisionReadiness } from '@/utils/guidedVisionFlow';

/**
 * Whether guided project vision selections satisfy readiness (chip-based flow).
 * @param {object | null | undefined} gv
 * @param {{ spaces?: object[] } | null} [project]
 */
export function isProjectVisionComplete(gv, project = null) {
  if (!gv || typeof gv !== 'object') return false;
  const projectLike =
    project ||
    (Array.isArray(gv.spacesContext) && gv.spacesContext.length > 0
      ? { spaces: gv.spacesContext }
      : null);
  return evaluateGuidedVisionReadiness(gv, projectLike).ready;
}
