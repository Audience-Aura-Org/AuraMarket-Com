import EditMealPageClient from './EditMealPageClient';

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function Page() {
  return <EditMealPageClient />;
}
