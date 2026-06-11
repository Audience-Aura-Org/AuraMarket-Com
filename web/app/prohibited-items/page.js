import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Prohibited Items Policy | AuraDime',
  description: legalPolicies.prohibitedItems.description,
  alternates: {
    canonical: '/prohibited-items',
    languages: { 'en-US': '/prohibited-items', 'fr-CM': '/prohibited-items' },
  },
  openGraph: {
    title: 'Prohibited Items Policy | AuraDime',
    description: legalPolicies.prohibitedItems.description,
    locale: 'en_US',
    alternateLocale: ['fr_CM'],
    type: 'article',
  },
};

export default function ProhibitedItemsPage() {
  return <LegalPolicyPage policy={legalPolicies.prohibitedItems} />;
}
