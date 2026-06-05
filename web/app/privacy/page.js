import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Privacy Policy | AuraDime',
  description: legalPolicies.privacy.description,
};

export default function PrivacyPage() {
  return <LegalPolicyPage policy={legalPolicies.privacy} />;
}
