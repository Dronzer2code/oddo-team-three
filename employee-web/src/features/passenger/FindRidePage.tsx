import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toLocalDateInput } from '@carpool/shared';
import {
  Button,
  Card,
  DateField,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  SkeletonCards,
  TimeField,
  resolveErrorCopy,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { AvailableRideCard } from '../../components/AvailableRideCard';

/**
 * Find a Ride. The search fields, and the three buttons, are the ones the
 * platform contract specifies — including "Maximum estimated cost", which is
 * applied to the per-seat price the API returns.
 */
export function FindRidePage() {
  const toast = useToast();

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [seats, setSeats] = useState('');
  const [maxCost, setMaxCost] = useState('');
  const [page, setPage] = useState(1);

  const debouncedPickup = useDebounced(pickup);
  const debouncedDestination = useDebounced(destination);
  const debouncedMaxCost = useDebounced(maxCost);

  const rides = useApi(
    () =>
      api.employee.rides.search({
        from: debouncedPickup || undefined,
        to: debouncedDestination || undefined,
        date: date || undefined,
        timeFrom: departureTime || undefined,
        minSeats: seats ? Number(seats) : undefined,
        page,
        pageSize: 9,
      }),
    [debouncedPickup, debouncedDestination, date, departureTime, seats, page],
  );

  const ceiling = Number(debouncedMaxCost);
  const returned = rides.data?.items ?? [];
  // The cost ceiling is the one filter the search endpoint does not carry, so
  // it is applied here against the per-seat price the server calculated.
  const items =
    debouncedMaxCost && Number.isFinite(ceiling) && ceiling > 0
      ? returned.filter((ride) => ride.costPerSeat <= ceiling)
      : returned;

  const pagination = rides.data?.pagination;
  const filtered = Boolean(pickup || destination || date || departureTime || seats || maxCost);

  function clearFilters() {
    setPickup('');
    setDestination('');
    setDate('');
    setDepartureTime('');
    setSeats('');
    setMaxCost('');
    setPage(1);
  }

  function useCurrentLocation() {
    if (!('geolocation' in navigator)) {
      toast.error('This browser cannot share your location.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setPickup(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setPage(1);
        toast.success('Pickup set to your current location');
      },
      () => toast.error('Location permission was declined. Type a pickup point instead.'),
    );
  }

  return (
    <>
      <PageHeader
        title="Find a Ride"
        lead="Open rides published by colleagues in your organization."
      />

      <Card>
        <div className="filter-bar">
          <div className="filter-bar__search">
            <span className="form-label">Pickup location</span>
            <SearchInput
              placeholder="Salt Lake, New Town…"
              value={pickup}
              onChange={(event) => {
                setPickup(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="filter-bar__search">
            <span className="form-label">Destination</span>
            <SearchInput
              placeholder="Park Street Office"
              value={destination}
              onChange={(event) => {
                setDestination(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <DateField
            label="Date"
            placeholder="Any day"
            min={toLocalDateInput()}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
          />
          <TimeField
            label="Departure time"
            placeholder="Any time"
            step={15}
            value={departureTime}
            onChange={(event) => {
              setDepartureTime(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Number of seats"
            placeholder="Any"
            options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value}+` }))}
            value={seats}
            onChange={(event) => {
              setSeats(event.target.value);
              setPage(1);
            }}
          />
          <Input
            label="Maximum estimated cost"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Any"
            value={maxCost}
            onChange={(event) => setMaxCost(event.target.value)}
          />
        </div>

        <div className="row" style={{ gap: 'var(--space-2)', padding: '0 var(--space-5) var(--space-5)', flexWrap: 'wrap' }}>
          <Button variant="secondary" icon="pin" onClick={useCurrentLocation}>
            Use current location
          </Button>
          <Button variant="primary" icon="search" onClick={rides.reload} loading={rides.loading}>
            Search rides
          </Button>
          <Button variant="ghost" onClick={clearFilters} disabled={!filtered}>
            Clear filters
          </Button>
        </div>
      </Card>

      <div style={{ marginTop: 'var(--space-6)' }}>
        {rides.error ? (
          <Card>
            <ErrorState {...resolveErrorCopy(rides.error)} onRetry={rides.reload} />
          </Card>
        ) : rides.initialLoading ? (
          <SkeletonCards count={3} />
        ) : items.length === 0 ? (
          <Card>
            <EmptyState
              icon="search"
              title={filtered ? 'No rides match your search' : 'No open rides right now'}
              text={
                filtered
                  ? 'Try a wider time window, or raise the maximum cost.'
                  : 'Nobody has published a ride you can join yet. Check back shortly.'
              }
              action={
                filtered ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cards">
              {items.map((ride) => (
                <AvailableRideCard
                  key={ride.id}
                  ride={ride}
                  action={
                    <Link className="btn btn-primary btn-sm" to={`/passenger/rides/${ride.id}`}>
                      {ride.viewer.canRequest ? 'Request Seat' : 'View Ride'}
                      <Icon name="arrowRight" size={14} />
                    </Link>
                  }
                />
              ))}
            </div>
            {pagination && pagination.totalPages > 1 ? (
              <Card style={{ marginTop: 'var(--space-4)' }}>
                <Pagination
                  page={pagination.page}
                  pageSize={pagination.pageSize}
                  total={pagination.total}
                  totalPages={pagination.totalPages}
                  onPage={setPage}
                  label="rides"
                />
              </Card>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
