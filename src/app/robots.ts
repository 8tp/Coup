import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/lobby/*', '/game/*'],
    },
    sitemap: 'https://coup.8tp.dev/sitemap.xml',
  };
}
