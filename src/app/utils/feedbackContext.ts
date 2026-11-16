import { FEEDBACK_PHONE_MAX_WIDTH, FEEDBACK_TABLET_MAX_WIDTH } from '@/shared/constants';
import type {
  BrowserFamily,
  FeedbackClientContext,
  FeedbackScreen,
  FeedbackTextSize,
  OsFamily,
  ViewportBucket,
} from '@/shared/feedbackTypes';

/** Coarse bucket only: the exact size is not sent. */
export function viewportBucket(width: number | null | undefined): ViewportBucket {
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) return 'unknown';
  if (width <= FEEDBACK_PHONE_MAX_WIDTH) return 'phone';
  if (width <= FEEDBACK_TABLET_MAX_WIDTH) return 'tablet';
  return 'desktop';
}

/** Browser family from the user agent. Order matters: most UAs claim to be several browsers. */
export function browserFamily(ua: string): BrowserFamily {
  if (/SamsungBrowser\//.test(ua)) return 'samsung';
  if (/\bEdg(e|A|iOS)?\//.test(ua)) return 'edge';
  if (/\bOPR\/|\bOpera\b|OPiOS\//.test(ua)) return 'opera';
  if (/Firefox\/|FxiOS\//.test(ua)) return 'firefox';
  if (/CriOS\/|Chrome\/|Chromium\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua) && /Version\/|Mobile\//.test(ua)) return 'safari';
  return 'other';
}

export function osFamily(ua: string, maxTouchPoints = 0): OsFamily {
  if (/Android/.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  // iPadOS reports a Mac user agent; touch support gives it away.
  if (/Macintosh/.test(ua)) return maxTouchPoints > 1 ? 'ios' : 'macos';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Windows/.test(ua)) return 'windows';
  if (/Linux|X11/.test(ua)) return 'linux';
  return 'other';
}

/** Collect the coarse device context sent with a feedback note. Never the raw UA string. */
export function collectFeedbackClientContext(screen: FeedbackScreen, textSize: FeedbackTextSize): FeedbackClientContext {
  if (typeof window === 'undefined') {
    return { screen, viewport: 'unknown', browser: 'other', os: 'other', textSize, standalone: false };
  }
  const ua = navigator.userAgent || '';
  let standalone = false;
  try {
    standalone = window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    standalone = false;
  }
  return {
    screen,
    viewport: viewportBucket(window.innerWidth),
    browser: browserFamily(ua),
    os: osFamily(ua, navigator.maxTouchPoints ?? 0),
    textSize,
    standalone,
  };
}
