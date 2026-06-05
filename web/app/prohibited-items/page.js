import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Prohibited Items Policy | AuraDime',
  description: legalPolicies.prohibitedItems.description,
};

export default function ProhibitedItemsPage() {
  return <LegalPolicyPage policy={legalPolicies.prohibitedItems} />;
}
