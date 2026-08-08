/** Brand name — never translated. */
export const BRAND_TITLE = 'Orthodox Korea';

/**
 * Every device now draws the app's OWN branded band. Nothing uses the platform's.
 *
 * This constant exists because of a problem that has since been solved one layer
 * down. iPadOS 18 renders a UITabBarController's bar at the TOP of the window,
 * where it collided with each screen's branded ORTHODOX KOREA band, so the iPad
 * used to surrender the top chrome to the platform: no gradient, no travelling
 * sheen, no knots, no closing rule — the tablet lost the headpiece that is most
 * of the app's character.
 *
 * The bar is at the top only in a REGULAR width environment, so the iPad is now
 * given a compact one (`useCompactWidthOnPad` in plugins/withIosSceneLifecycle.js).
 * It is still the platform's own tab bar, drawing itself with iOS 26 Liquid Glass
 * — it simply lays out at the bottom, as it does on every other device. With the
 * top of the window free, the iPad takes the same path as the phone.
 *
 * KEPT RATHER THAN DELETED, as a named switch instead of a scattering of
 * `Platform.isPad` checks: if a future iPadOS forces the top bar back regardless
 * of size class, flipping this one constant restores the platform-header layout
 * in all three tab screens at once.
 */
export const USES_NATIVE_HEADER: boolean = false;
