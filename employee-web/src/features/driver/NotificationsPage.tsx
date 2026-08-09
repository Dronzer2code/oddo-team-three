import { NotificationFeed } from '../../components/NotificationFeed';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';

/** Seat requests to answer and vehicle approval outcomes. */
export function DriverNotificationsPage() {
  const feed = useApi(() => api.driver.notifications(), []);

  return (
    <NotificationFeed
      feed={feed}
      lead="Seat requests waiting on you, and vehicle approval decisions."
      emptyText="Publish a ride and passenger requests will show up here."
    />
  );
}
