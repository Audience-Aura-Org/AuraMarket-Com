import WorkspacePageClient from './WorkspacePageClient';

// Static export (Android app) needs one pre-rendered shell; real account IDs are read on the client.
export function generateStaticParams() {
  return [{ userId: '__placeholder__', slug: [] }];
}

export default function WorkspacePage() {
  return <WorkspacePageClient />;
}
