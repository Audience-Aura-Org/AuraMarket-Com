"use client";

import { Suspense } from 'react';
import ChatPage from '../chat/page';

export default function MessagesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPage />
    </Suspense>
  );
}
