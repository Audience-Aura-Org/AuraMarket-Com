import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Privacy Policy | AuraDime',
  description: legalPolicies.privacy.description,
  alternates: {
    canonical: '/privacy',
    languages: { 'en-US': '/privacy', 'fr-CM': '/privacy' },
  },
  openGraph: {
    title: 'Privacy Policy | AuraDime',
    description: legalPolicies.privacy.description,
    locale: 'en_US',
    alternateLocale: ['fr_CM'],
    type: 'article',
  },
};

export default function PrivacyPage() {
  return <LegalPolicyPage policy={legalPolicies.privacy} />;
}
