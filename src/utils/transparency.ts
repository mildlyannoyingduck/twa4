/**
 * Direct numeric CSS variable applicator for 0%–100% Card Transparency & Galaxy A07 Performance Mode.
 *
 * Scale:
 *   0%   = Solid opaque high-contrast cards (0.99 alpha, zero background bleed)
 *   72%  = Balanced Arctic Prism frost (default)
 *   100% = Ultra-clear glass wireframes (0.02 alpha, background Arctic grid & aurora shine cleanly through)
 */
export function applyGlassTransparencyVars(percent: number): void {
  if (typeof document === 'undefined') return;
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const t = clamped / 100;

  const rootStyle = document.documentElement.style;

  // Main cards (ios-glass, ios-glass-strong, ios-glass-tile)
  // Smooth dramatic curve from 0.99 (solid) -> 0.02 (clear wireframe)
  const alphaLight = 0.99 - t * 0.97;
  const alphaLightLow = 0.95 - t * 0.94;

  const alphaDark = 0.98 - t * 0.96;
  const alphaDarkLow = 0.93 - t * 0.92;

  // Subject cards (Bio / Phy / Chem)
  const subjAlpha = 0.98 - t * 0.95;
  const subjAlphaLow = 0.90 - t * 0.89;

  // Sub-controls inside modals & sheets
  const controlLight = 0.94 - t * 0.84; // 0.94 -> 0.10
  const controlDark = 0.88 - t * 0.80; // 0.88 -> 0.08

  // TopBar & Dock chrome (stays responsive to slider while preserving minimum legibility)
  const chromeLight = Math.max(0.18, alphaLight);
  const chromeLightLow = Math.max(0.10, alphaLightLow);
  const chromeDark = Math.max(0.24, alphaDark);
  const chromeDarkLow = Math.max(0.16, alphaDarkLow);

  // Modals / Sheets (clearly shifts solid 0.99 <-> frosted translucent 0.28/0.34)
  const modalLight = 0.99 - t * 0.71;
  const modalLightLow = 0.94 - t * 0.72;
  const modalDark = 0.98 - t * 0.64;
  const modalDarkLow = 0.92 - t * 0.64;

  // Specular borders (crisp crystal wireframe outline even at 100% transparency)
  const borderLight = 0.96 - t * 0.16; // 0.96 -> 0.80
  const borderDark = 0.66 - t * 0.14; // 0.66 -> 0.52

  rootStyle.setProperty('--glass-transparency', String(clamped));
  rootStyle.setProperty('--glass-alpha', alphaLight.toFixed(3));
  rootStyle.setProperty('--glass-alpha-low', alphaLightLow.toFixed(3));
  rootStyle.setProperty('--glass-dark-alpha', alphaDark.toFixed(3));
  rootStyle.setProperty('--glass-dark-alpha-low', alphaDarkLow.toFixed(3));
  rootStyle.setProperty('--glass-subj-alpha', subjAlpha.toFixed(3));
  rootStyle.setProperty('--glass-subj-alpha-low', subjAlphaLow.toFixed(3));
  rootStyle.setProperty('--glass-control-light', controlLight.toFixed(3));
  rootStyle.setProperty('--glass-control-dark', controlDark.toFixed(3));
  rootStyle.setProperty('--glass-chrome-light', chromeLight.toFixed(3));
  rootStyle.setProperty('--glass-chrome-light-low', chromeLightLow.toFixed(3));
  rootStyle.setProperty('--glass-chrome-dark', chromeDark.toFixed(3));
  rootStyle.setProperty('--glass-chrome-dark-low', chromeDarkLow.toFixed(3));
  rootStyle.setProperty('--glass-modal-light', modalLight.toFixed(3));
  rootStyle.setProperty('--glass-modal-light-low', modalLightLow.toFixed(3));
  rootStyle.setProperty('--glass-modal-dark', modalDark.toFixed(3));
  rootStyle.setProperty('--glass-modal-dark-low', modalDarkLow.toFixed(3));
  rootStyle.setProperty('--glass-border-light', borderLight.toFixed(3));
  rootStyle.setProperty('--glass-border-dark', borderDark.toFixed(3));
}

export function applyA07PerfClass(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('a07-perf', enabled);
}
