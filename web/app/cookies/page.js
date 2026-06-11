import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Cookie Policy | AuraDime',
  description: legalPolicies.cookies.description,
  alternates: {
    canonical: '/cookies',
    languages: { 'en-US': '/cookies', 'fr-CM': '/cookies' },
  },
  openGraph: {
    title: 'Cookie Policy | AuraDime',
    description: legalPolicies.cookies.description,
    locale: 'en_US',
    alternateLocale: ['fr_CM'],
    type: 'article',
  },
};

export default function CookiesPage() {
  return <LegalPolicyPage policy={legalPolicies.cookies} />;
}
