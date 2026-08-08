import { useAppStore } from '../store/useAppStore';
import { DIAGNOSTICS_ENABLED } from './features';

/**
 * Should this build show its owner-only surfaces right now?
 *
 * `DIAGNOSTICS_ENABLED` answers "does this build HAVE them" and is decided at
 * compile time. This answers "should they be VISIBLE", which the owner can turn
 * off from Diagnostics in order to see the app exactly as a parishioner does —
 * without installing a second copy, and without losing the owner build.
 *
 * WHAT THIS PREVIEW DOES AND DOES NOT PROVE. It is faithful for judging the
 * public UI, because the only difference between the two builds IS which
 * surfaces appear. It cannot prove the console is UNREACHABLE in a real public
 * build — that is a property of the compiled flag, and it is checked by building
 * the public bundle and reading it, not by looking at the screen.
 *
 * In a public build this is always false: `DIAGNOSTICS_ENABLED` is false, so the
 * expression short-circuits and the toggle that would set it does not render.
 */
export function useOwnerSurfaces(): boolean {
  const previewPublic = useAppStore((state) => state.previewPublic);
  return DIAGNOSTICS_ENABLED && !previewPublic;
}
