import LegacyRedirect from '@/components/manager/LegacyRedirect';
import { LEGACY_ROUTES } from '@/components/manager/legacyRoutes';

export default function LegacyPage() {
  return <LegacyRedirect to={LEGACY_ROUTES.activity} />;
}
