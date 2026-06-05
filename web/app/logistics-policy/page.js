import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Logistics Partner Policy | AuraDime',
  description: legalPolicies.logisticsPolicy.description,
};

export default function LogisticsPolicyPage() {
  return <LegalPolicyPage policy={legalPolicies.logisticsPolicy} />;
}
