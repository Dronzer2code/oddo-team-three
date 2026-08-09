import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BOOKING_STATUS, type Booking } from '@carpool/shared';
import {
  Card,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  SkeletonCards,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { PassengerBookingCard } from '../../components/PassengerBookingCard';
import { CancelBookingDialog } from './CancelBookingDialog';

/** The six filters the platform contract specifies, in its order. */
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: BOOKING_STATUS.PENDING, label: 'Pending' },
  { value: BOOKING_STATUS.CONFIRMED, label: 'Confirmed' },
  { value: BOOKING_STATUS.REJECTED, label: 'Rejected' },
  { value: BOOKING_STATUS.CANCELED, label: 'Canceled' },
  { value: BOOKING_STATUS.COMPLETED, label: 'Completed' },
] as const;

export function BookingsPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<string>('all');
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  // Filtering happens server-side; the passenger scope is resolved from the
  // session, so the client can never widen it.
  const bookings = useApi(() => api.passenger.bookings.list(filter === 'all' ? undefined : filter), [filter]);
  const items = bookings.data ?? [];

  return (
    <>
      <PageHeader
        title="My Bookings"
        lead="Every seat you have requested, confirmed or completed."
        actions={
          <Link className="btn btn-primary" to="/passenger/rides">
            <Icon name="search" size={16} />
            Find a Ride
          </Link>
        }
      />

      <Card>
        <div className="filter-bar">
          <div className="form-group">
            <span className="form-label">Show</span>
            <div className="btn-group">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  className={filter === option.value ? 'is-active' : undefined}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div style={{ marginTop: 'var(--space-6)' }}>
        {bookings.error ? (
          <Card>
            <ErrorState {...resolveErrorCopy(bookings.error)} onRetry={bookings.reload} />
          </Card>
        ) : bookings.initialLoading ? (
          <SkeletonCards count={3} />
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon="seat"
              title={filter === 'all' ? 'No bookings yet' : `No ${filter} bookings`}
              text="Search for a ride and request a seat — your bookings will appear here."
              action={
                <Link className="btn btn-primary" to="/passenger/rides">
                  Find a Ride
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cards">
            {items.map((booking) => (
              <PassengerBookingCard key={booking.id} booking={booking} onCancel={setCancelTarget} />
            ))}
          </div>
        )}
      </div>

      <CancelBookingDialog
        booking={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onDone={() => {
          setCancelTarget(null);
          toast.success('Booking canceled');
          bookings.reload();
        }}
      />
    </>
  );
}
