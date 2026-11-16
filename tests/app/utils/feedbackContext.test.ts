import { describe, expect, it } from 'vitest';
import { browserFamily, osFamily, viewportBucket } from '@/app/utils/feedbackContext';

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  windowsEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/114.0.0.0',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

describe('feedback client context', () => {
  it('buckets the viewport width', () => {
    expect(viewportBucket(390)).toBe('phone');
    expect(viewportBucket(639)).toBe('phone');
    expect(viewportBucket(768)).toBe('tablet');
    expect(viewportBucket(1023)).toBe('tablet');
    expect(viewportBucket(1440)).toBe('desktop');
    expect(viewportBucket(0)).toBe('unknown');
    expect(viewportBucket(undefined)).toBe('unknown');
  });

  it('derives a coarse browser family', () => {
    expect(browserFamily(UA.androidChrome)).toBe('chrome');
    expect(browserFamily(UA.samsung)).toBe('samsung');
    expect(browserFamily(UA.iphoneSafari)).toBe('safari');
    expect(browserFamily(UA.iphoneChrome)).toBe('chrome');
    expect(browserFamily(UA.macSafari)).toBe('safari');
    expect(browserFamily(UA.windowsEdge)).toBe('edge');
    expect(browserFamily(UA.linuxFirefox)).toBe('firefox');
    expect(browserFamily(UA.opera)).toBe('opera');
    expect(browserFamily('curl/8.0')).toBe('other');
  });

  it('derives a coarse OS family, including iPadOS desktop-mode', () => {
    expect(osFamily(UA.androidChrome)).toBe('android');
    expect(osFamily(UA.iphoneSafari)).toBe('ios');
    expect(osFamily(UA.macSafari, 0)).toBe('macos');
    expect(osFamily(UA.macSafari, 5)).toBe('ios');
    expect(osFamily(UA.windowsEdge)).toBe('windows');
    expect(osFamily(UA.linuxFirefox)).toBe('linux');
    expect(osFamily(UA.chromebook)).toBe('chromeos');
    expect(osFamily('')).toBe('other');
  });
});
