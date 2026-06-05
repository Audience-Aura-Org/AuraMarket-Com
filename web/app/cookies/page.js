import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Cookie Policy | AuraDime',
  description: legalPolicies.cookies.description,
};

export default function CookiesPage() {
  return <LegalPolicyPage policy={legalPolicies.cookies} />;
}
