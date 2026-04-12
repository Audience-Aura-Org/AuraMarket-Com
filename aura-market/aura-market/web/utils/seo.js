/**
 * utils/seo.js
 * Utility for generating Next.js 13+ Metadata objects for SEO and OpenGraph.
 */

export const siteConfig = {
  name: 'Aura Market',
  description: 'The premium digital marketplace for secondary goods and services.',
  url: 'https://auramarket.com', // Update with production URL
  ogImage: '/og-image.png',
  twitterHandle: '@AuraMarket',
};

export function generateSEO({
  title,
  description,
  image,
  noIndex = false,
} = {}) {
  const fullTitle = title ? `${title} | ${siteConfig.name}` : siteConfig.name;
  const fullDesc = description || siteConfig.description;
  const fullImage = image || siteConfig.ogImage;

  return {
    title: fullTitle,
    description: fullDesc,
    openGraph: {
      title: fullTitle,
      description: fullDesc,
      images: [
        {
          url: fullImage,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: fullDesc,
      images: [fullImage],
      creator: siteConfig.twitterHandle,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
    },
    icons: {
      icon: '/favicon.ico',
    },
  };
}
