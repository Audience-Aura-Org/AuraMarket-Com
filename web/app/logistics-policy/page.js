import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Logistics Partner Policy | AuraDime',
  description: legalPolicies.logisticsPolicy.description,
  alternates: {
    canonical: '/logistics-policy',
    languages: { 'en-US': '/logistics-policy', 'fr-CM': '/logistics-policy' },
  },
  openGraph: {
    title: 'Logistics Partner Policy | AuraDime',
    description: legalPolicies.logisticsPolicy.description,
    locale: 'en_US',
    alternateLocale: ['fr_CM'],
    type: 'article',
  },
};

export default function LogisticsPolicyPage() {
  return <LegalPolicyPage policy={legalPolicies.logisticsPolicy} />;
}
