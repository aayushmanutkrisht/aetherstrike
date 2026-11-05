/**
 * MediaPipe model discovery. v1.5.1 regressed by requiring a specific ZIP
 * central-directory layout before letting MediaPipe parse an official .task.
 * The MediaPipe runtime, not this app, is responsible for parsing the model.
 * This check ONLY detects HTML SPA fallbacks/obviously non-model responses.
 */
export const OFFICIAL_HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/** A conservative plausibility check, never a substitute for MediaPipe parsing. */
export function isPlausibleTaskFile(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 500_000 || bytes.byteLength > 30_000_000) return false;
  // A legitimate .task may use a ZIP container or TFLite/FlatBuffer encoding.
  // Never require a particular ZIP central-directory layout or ZIP entry count.
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const tflite = bytes[4] === 0x54 && bytes[5] === 0x46 && bytes[6] === 0x4c && bytes[7] === 0x33;
  return zip || tflite;
}

/** Test a local model without mistaking Vite's index.html fallback for a file. */
export async function hasPlausibleLocalHandModel(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, {cache: 'no-store', signal: controller.signal});
    if (!response.ok) return false;
    const mime = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (mime.includes('text/html') || mime.includes('application/json')) return false;
    // Read local bytes only; external official model is passed straight to
    // MediaPipe by URL, as it was in the previously working v1.4 version.
    const bytes = new Uint8Array(await response.arrayBuffer());
    return isPlausibleTaskFile(bytes);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Prefer a verified local file, otherwise return the previously working URL. */
export function modelCandidates(localUrl: string, localPresent: boolean): string[] {
  return localPresent ? [localUrl, OFFICIAL_HAND_MODEL] : [OFFICIAL_HAND_MODEL];
}
