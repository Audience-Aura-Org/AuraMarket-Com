import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Vendor Policy | AuraDime',
  description: legalPolicies.vendorPolicy.description,
};

export default function VendorPolicyPage() {
  return <LegalPolicyPage policy={legalPolicies.vendorPolicy} />;
}
