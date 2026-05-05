/**
 * Whether the user has completed the required whole-property vision step
 * (stored in project.globalVision on the client / projectCompat).
 *
 * Required: propertyVision — overall house/property description (min length).
 * If the description is shorter, require at least one style keyword or a mood.
 */
const MIN_VISION = 40;
const MIN_VISION_STANDALONE = 72;

export function isProjectVisionComplete(gv) {
  if (!gv || typeof gv !== 'object') return false;
  const text = (gv.propertyVision || '').trim();
  if (text.length < MIN_VISION) return false;
  if (text.length >= MIN_VISION_STANDALONE) return true;
  const mood = (gv.moodVibe || '').trim();
  const styles = Array.isArray(gv.styleKeywords) ? gv.styleKeywords.filter(Boolean).length : 0;
  return styles > 0 || mood.length > 0;
}
