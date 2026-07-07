import AdminEditProductClient from './AdminEditProductClient';

export function generateStaticParams() {
  return [{ id: '__placeholder__' }];
}

export default function AdminEditProductPage() {
  return <AdminEditProductClient />;
}
