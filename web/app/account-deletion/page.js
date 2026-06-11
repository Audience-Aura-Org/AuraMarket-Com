import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Account Deletion Policy | AuraDime',
  description: legalPolicies.accountDeletion.description,
  alternates: {
    canonical: '/account-deletion',
    languages: { 'en-US': '/account-deletion', 'fr-CM': '/account-deletion' },
  },
  openGraph: {
    title: 'Account Deletion Policy | AuraDime',
    description: legalPolicies.accountDeletion.description,
    locale: 'en_US',
    alternateLocale: ['fr_CM'],
    type: 'article',
  },
};

export default function AccountDeletionPage() {
  return <LegalPolicyPage policy={legalPolicies.accountDeletion} />;
}
