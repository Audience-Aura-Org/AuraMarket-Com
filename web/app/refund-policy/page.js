import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Refund and Cancellation Policy | AuraDime',
  description: legalPolicies.refundPolicy.description,
};

export default function RefundPolicyPage() {
  return <LegalPolicyPage policy={legalPolicies.refundPolicy} />;
}
