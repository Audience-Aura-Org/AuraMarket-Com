import LegalPolicyPage from '@/components/legal/LegalPolicyPage';
import { legalPolicies } from '@/data/legalPolicies';

export const metadata = {
  title: 'Vendor Policy | AuraDime',
  description: legalPolicies.vendorPolicy.description,
  alternates: {
    canonical: '/vendor-policy',
    languages: { 'en-US': '/vendor-policy', 'fr-CM': '/vendor-policy' },
  },
  openGraph: {
    title: 'Vendor Policy | AuraDime',
    description: legalPolicies.vendorPolicy.description,
    locale: 'en_US',
    alternateLocale: ['fr_CM'],
    type: 'article',
  },
};

export default function VendorPolicyPage() {
  return <LegalPolicyPage policy={legalPolicies.vendorPolicy} />;
}
