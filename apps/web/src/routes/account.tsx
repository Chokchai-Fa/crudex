import { createFileRoute } from '@tanstack/react-router';
import { AccountPage } from '@/features/school-access/account-page';

export const Route = createFileRoute('/account')({
  validateSearch: (search): { returnTo?: 'admin' } =>
    search.returnTo === 'admin' ? { returnTo: 'admin' } : {},
  component: Account,
});

function Account() {
  return <AccountPage returnTo={Route.useSearch().returnTo} />;
}
