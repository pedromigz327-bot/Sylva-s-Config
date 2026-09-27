/**
 * Exact Minecraft 1.8.9 Mouse Sensitivity & Yaw Math
 * In MC 1.8.9 (EntityRenderer.java):
 * options.txt stores mouseSensitivity in [0.0, 1.0], where 0.5 = 100% and 1.0 = 200%.
 * f = mouseSensitivity * 0.6 + 0.2
 * f1 = f^3 * 8.0
 * Degrees turned per mouse count = f1 * 0.15
 */

export function mcPercentToOptionsFloat(percent: number): number {
  const clamped = Math.max(0, Math.min(200, percent));
  return Number((clamped / 200).toFixed(8));
}

export function optionsFloatToMcPercent(optionsFloat: number): number {
  return Math.round(optionsFloat * 200);
}

export function calculateCmPer360(dpi: number, mcPercent: number): number {
  const safeDpi = Math.max(50, dpi);
  const s = Math.max(0, Math.min(200, mcPercent)) / 200;
  const f = s * 0.6 + 0.2;
  const degreesPerCount = Math.pow(f, 3) * 8.0 * 0.15;
  const countsPer360 = 360 / degreesPerCount;
  const inchesPer360 = countsPer360 / safeDpi;
  return Number((inchesPer360 * 2.54).toFixed(2));
}

export function calculateMcPercentFromCm360(targetCm360: number, dpi: number): number {
  const safeDpi = Math.max(50, dpi);
  const safeCm = Math.max(2, targetCm360);
  const inchesPer360 = safeCm / 2.54;
  const countsPer360 = inchesPer360 * safeDpi;
  const degreesPerCount = 360 / countsPer360;
  const fCubed = degreesPerCount / (8.0 * 0.15);
  const f = Math.cbrt(fCubed);
  const s = (f - 0.2) / 0.6;
  const percent = s * 200;
  return Math.max(1, Math.min(200, Math.round(percent)));
}

export function calculateEffectiveEdpi(dpi: number, mcPercent: number): number {
  return Math.round(dpi * (mcPercent / 100));
}
