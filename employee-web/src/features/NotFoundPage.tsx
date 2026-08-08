import { Link } from 'react-router-dom';
import { Card, EmptyState, PageHeader } from '@carpool/ui';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Card>
        <EmptyState
          icon="route"
          title="This road leads nowhere"
          text="The page you were looking for does not exist."
          action={
            <Link className="btn btn-primary" to="/home">
              Back to home
            </Link>
          }
        />
      </Card>
    </>
  );
}
