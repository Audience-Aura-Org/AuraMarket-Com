"use client";
import Hero from './Hero';
import CategoryCarousel from './CategoryCarousel';
import ProductSection from './ProductSection';
import PromoBanner from './PromoBanner';
import StoreHighlights from './StoreHighlights';

const FULL_WIDTH = new Set(['hero', 'promo_banner', 'footer_promo']);

export default function StorefrontRenderer({ sections }) {
  if (!sections?.length) return null;

  return (
    <div className="w-full">
      {sections.map((section, index) => {
        if (!section.is_active) return null;

        const { type, title, subtitle, data, config } = section;
        const isFullWidth = FULL_WIDTH.has(type) || title?.toLowerCase().includes('featured');

        const content = (() => {
          switch (type) {
            case 'hero':
              return <Hero key={section._id || index} data={data} config={config} />;

            case 'categories':
              return <CategoryCarousel key={section._id || index} title={title} data={data} />;

            case 'featured_products':
            case 'trending':
            case 'collection':
            case 'recommendations':
              return (
                <ProductSection
                  key={section._id || index}
                  title={title}
                  subtitle={subtitle}
                  data={data}
                  config={config}
                />
              );

            case 'promo_banner':
            case 'footer_promo':
              return <PromoBanner key={section._id || index} data={data} />;

            case 'stores':
              return <StoreHighlights key={section._id || index} title={title} data={data} />;

            default:
              return null;
          }
        })();

        if (!content) return null;

        return (
          <div
            key={section._id || index}
            className={isFullWidth ? 'w-full mb-1' : 'w-full px-2 sm:px-5 md:px-8 lg:px-12'}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
