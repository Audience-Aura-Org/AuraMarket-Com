import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Account Deletion Policy | AuraDime',
  description: legalPolicies.accountDeletion.description,
};

export default function AccountDeletionPage() {
  return <LegalPolicyPage policy={legalPolicies.accountDeletion} />;
}
