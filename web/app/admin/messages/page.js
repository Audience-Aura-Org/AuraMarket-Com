import { redirect } from 'next/navigation';

export default function AdminMessagesRedirect() {
  redirect('/chat');
}
