import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Ride } from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  SkeletonCards,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { usePanelAccess } from '../../lib/panels';
import { DriverRideCard } from '../../components/DriverRideCard';

const FILTERS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'published', label: 'Published' },
  { value: 'full', label: 'Full' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'all', label: 'All' },
] as const;

/**
 * My Rides — the driver's own published rides. The card here says "You are
 * driving" and carries the driver's actions, which is exactly why it may never
 * be rendered in the passenger panel.
 */
export function DriverRidesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { hasDriverContext } = usePanelAccess();

  const [filter, setFilter] = useState<string>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<Ride | null>(null);
  const [startTarget, setStartTarget] = useState<Ride | null>(null);

  const mine = useApi(() => api.employee.rides.mine(), []);
  const requests = useApi(() => api.employee.rides.incomingRequests(), []);

  const cancelRide = useMutation((id: string) => api.employee.rides.cancel(id));
  const startTrip = useMutation((rideId: string) => api.employee.trips.start(rideId));

  const driving = mine.data?.driving ?? [];
  const pending = requests.data ?? [];

  const items =
    filter === 'all'
      ? driving
      : filter === 'upcoming'
        ? driving.filter((ride) => ride.status === 'published' || ride.status === 'full')
        : driving.filter((ride) => ride.status === filter);

  function refreshAll() {
    mine.reload();
    requests.reload();
  }

  return (
    <>
      <PageHeader
        title="My Rides"
        lead="Rides you have published, and the requests waiting on each of them."
        actions={
          <Link
            className="btn btn-accent"
            to="/driver/rides/new"
            aria-disabled={!hasDriverContext}
            onClick={(event) => {
              if (!hasDriverContext) {
                event.preventDefault();
                toast.error('You need an approved active vehicle before publishing a ride.');
              }
            }}
          >
            <Icon name="plus" size={16} />
            Publish Ride
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
        {mine.error ? (
          <Card>
            <ErrorState {...resolveErrorCopy(mine.error)} onRetry={mine.reload} />
          </Card>
        ) : mine.initialLoading ? (
          <SkeletonCards count={3} />
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon="car"
              title={filter === 'all' ? 'You have not published a ride yet' : `No ${filter} rides`}
              text="Offer the empty seats on a commute you already make."
              action={
                hasDriverContext ? (
                  <Link className="btn btn-accent" to="/driver/rides/new">
                    <Icon name="plus" size={16} />
                    Publish Ride
                  </Link>
                ) : (
                  <Link className="btn btn-primary" to="/driver/vehicle">
                    My Vehicle
                  </Link>
                )
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cards">
            {items.map((ride) => (
              <DriverRideCard
                key={ride.id}
                ride={ride}
                pendingRequests={pending.filter((request) => request.rideId === ride.id).length}
                onCancel={setCancelTarget}
                onStartTrip={setStartTarget}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel Ride"
        message={
          cancelTarget
            ? `${cancelTarget.startLocation} → ${cancelTarget.destination}. Everyone holding or waiting on a seat loses it.`
            : ''
        }
        confirmLabel="Cancel Ride"
        cancelLabel="Keep the ride"
        tone="danger"
        busy={cancelRide.busy}
        onCancel={() => setCancelTarget(null)}
        onConfirm={async () => {
          if (!cancelTarget) return;
          const result = await cancelRide.run(cancelTarget.id);
          if (result) {
            toast.success('Ride canceled');
            setCancelTarget(null);
            refreshAll();
          } else if (cancelRide.error) {
            toast.error(cancelRide.error.message);
          }
        }}
      >
        {cancelRide.error ? <Alert tone="error">{cancelRide.error.message}</Alert> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={startTarget !== null}
        title="Start Trip"
        message={
          startTarget
            ? `${startTarget.startLocation} → ${startTarget.destination}. Accepted passengers are added to the trip and the vehicle and cost basis are frozen onto it.`
            : ''
        }
        confirmLabel="Start Trip"
        cancelLabel="Not yet"
        busy={startTrip.busy}
        onCancel={() => setStartTarget(null)}
        onConfirm={async () => {
          if (!startTarget) return;
          const result = await startTrip.run(startTarget.id);
          if (result) {
            toast.success('Trip started');
            setStartTarget(null);
            refreshAll();
            navigate('/driver/active-trip');
          } else if (startTrip.error) {
            toast.error(startTrip.error.message);
          }
        }}
      >
        {startTrip.error ? <Alert tone="error">{startTrip.error.message}</Alert> : null}
      </ConfirmDialog>
    </>
  );
}
