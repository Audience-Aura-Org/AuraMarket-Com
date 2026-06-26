import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Refund and Cancellation Policy | AuraDime',
  description: legalPolicies.refundPolicy.description,
  alternates: {
    canonical: '/refund-policy',
    languages: { 'en-US': '/refund-policy', 'fr-CM': '/refund-policy' },
  },
  openGraph: {
    title: 'Refund and Cancellation Policy | AuraDime',
    description: legalPolicies.refundPolicy.description,
    locale: 'en_US',
    alternateLocale: ['fr_CM'],
    type: 'article',
  },
};

export default function RefundPolicyPage() {
  return <LegalPolicyPage policy={legalPolicies.refundPolicy} />;
}
