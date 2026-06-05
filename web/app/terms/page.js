import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Terms of Service | AuraDime',
  description: legalPolicies.terms.description,
};

export default function TermsPage() {
  return <LegalPolicyPage policy={legalPolicies.terms} />;
}
