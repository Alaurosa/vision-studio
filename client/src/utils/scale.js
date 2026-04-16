export const computeScale = (p1, p2, realInches) => {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy) / realInches;
};

export const pxToInches = (px, scale) => px / scale;
export const inchesToPx = (inches, scale) => inches * scale;
export const snapToGrid = (val, gridPx) => Math.round(val / gridPx) * gridPx;
