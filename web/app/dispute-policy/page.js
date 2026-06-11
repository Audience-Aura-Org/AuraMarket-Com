import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Dispute and Escrow Policy | AuraDime',
  description: legalPolicies.disputePolicy.description,
  alternates: {
    canonical: '/dispute-policy',
    languages: { 'en-US': '/dispute-policy', 'fr-CM': '/dispute-policy' },
  },
  openGraph: {
    title: 'Dispute and Escrow Policy | AuraDime',
    description: legalPolicies.disputePolicy.description,
    locale: 'en_US',
    alternateLocale: ['fr_CM'],
    type: 'article',
  },
};

export default function DisputePolicyPage() {
  return <LegalPolicyPage policy={legalPolicies.disputePolicy} />;
}
