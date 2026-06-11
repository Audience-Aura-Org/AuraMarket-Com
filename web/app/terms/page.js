import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Terms of Service | AuraDime',
  description: legalPolicies.terms.description,
  alternates: {
    canonical: '/terms',
    languages: { 'en-US': '/terms', 'fr-CM': '/terms' },
  },
  openGraph: {
    title: 'Terms of Service | AuraDime',
    description: legalPolicies.terms.description,
    locale: 'en_US',
    alternateLocale: ['fr_CM'],
    type: 'article',
  },
};

export default function TermsPage() {
  return <LegalPolicyPage policy={legalPolicies.terms} />;
}
