import { api } from './api';
import { useLocaleStore } from '../i18n';

// Privacy-friendly page events. No cookies, no local storage, no ids: the
// server stores the event name, a coarse country and the day. Do Not Track
// and Global Privacy Control switch it off entirely. Never throws.

export type TrackEvent = 'landing_view' | 'cta_click' | 'login_view' | 'profile_view' | 'pricing_view' | 'upgrade_click' | 'share_click' | 'invite_click';

type PrivacyNavigator = Pick<Navigator, 'doNotTrack'> & { globalPrivacyControl?: boolean };

/** True when the browser asks not to be tracked. */
export function trackingOptedOut(nav: PrivacyNavigator = navigator): boolean {
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

export function trackEvent(name: TrackEvent, props: { page?: string; ref?: string } = {}): void {
  if (trackingOptedOut()) return;
  // The page language (en / hi / hi-Latn) lets us compare conversion by language. It is not an identifier.
  api.sendEvent(name, { ...props, lang: useLocaleStore.getState().locale }).catch(() => { /* measurement must never break the app */ });
}
