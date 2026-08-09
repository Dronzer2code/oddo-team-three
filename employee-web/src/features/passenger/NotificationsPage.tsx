import { NotificationFeed } from '../../components/NotificationFeed';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';

/** Seat decisions and trip updates for the rides this passenger booked. */
export function PassengerNotificationsPage() {
  const feed = useApi(() => api.passenger.notifications(), []);

  return (
    <NotificationFeed
      feed={feed}
      lead="Seat decisions and trip updates for your bookings."
      emptyText="Request a seat and you will hear back from the driver here."
    />
  );
}
