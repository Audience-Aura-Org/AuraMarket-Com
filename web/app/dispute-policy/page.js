import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Dispute and Escrow Policy | AuraDime',
  description: legalPolicies.disputePolicy.description,
};

export default function DisputePolicyPage() {
  return <LegalPolicyPage policy={legalPolicies.disputePolicy} />;
}
