import { useState } from 'react';
import { Link } from 'react-router-dom';
import { VEHICLE_TYPE, VEHICLE_TYPE_LABEL, toLocalDateInput } from '@carpool/shared';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  SkeletonCards,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { RideCard } from '../../components/RideCard';

export function FindRidePage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [minSeats, setMinSeats] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [page, setPage] = useState(1);

  const debouncedFrom = useDebounced(from);
  const debouncedTo = useDebounced(to);

  const rides = useApi(
    () =>
      api.employee.rides.search({
        from: debouncedFrom || undefined,
        to: debouncedTo || undefined,
        date: date || undefined,
        timeFrom: timeFrom || undefined,
        timeTo: timeTo || undefined,
        minSeats: minSeats ? Number(minSeats) : undefined,
        vehicleType: vehicleType || undefined,
        page,
        pageSize: 9,
      }),
    [debouncedFrom, debouncedTo, date, timeFrom, timeTo, minSeats, vehicleType, page],
  );

  const items = rides.data?.items ?? [];
  const pagination = rides.data?.pagination;
  const filtered = Boolean(from || to || date || timeFrom || timeTo || minSeats || vehicleType);

  function clear() {
    setFrom('');
    setTo('');
    setDate('');
    setTimeFrom('');
    setTimeTo('');
    setMinSeats('');
    setVehicleType('');
    setPage(1);
  }

  return (
    <>
      <PageHeader
        title="Find a ride"
        lead="Open rides published by colleagues in your organization."
        actions={
          <Link className="btn btn-accent" to="/rides/new">
            <Icon name="plus" size={16} />
            Publish instead
          </Link>
        }
      />

      <Card>
        <div className="filter-bar">
          <div className="filter-bar__search">
            <span className="form-label">Starting area</span>
            <SearchInput
              placeholder="Salt Lake, New Town…"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="filter-bar__search">
            <span className="form-label">Destination</span>
            <SearchInput
              placeholder="Park Street Office"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Input
            label="Date"
            type="date"
            min={toLocalDateInput()}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
          />
          <Input
            label="Leaving after"
            type="time"
            value={timeFrom}
            onChange={(event) => {
              setTimeFrom(event.target.value);
              setPage(1);
            }}
          />
          <Input
            label="Leaving before"
            type="time"
            value={timeTo}
            onChange={(event) => {
              setTimeTo(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Seats needed"
            placeholder="Any"
            options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value}+` }))}
            value={minSeats}
            onChange={(event) => {
              setMinSeats(event.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Vehicle type"
            placeholder="Any"
            options={Object.values(VEHICLE_TYPE).map((value) => ({ value, label: VEHICLE_TYPE_LABEL[value] }))}
            value={vehicleType}
            onChange={(event) => {
              setVehicleType(event.target.value);
              setPage(1);
            }}
          />
          {filtered ? (
            <Button variant="ghost" onClick={clear}>
              Clear
            </Button>
          ) : null}
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
                  ? 'Try a wider time window, or drop the vehicle type filter.'
                  : 'Nobody has published a ride you can join yet. Publish yours and let colleagues request a seat.'
              }
              action={
                filtered ? (
                  <Button variant="secondary" onClick={clear}>
                    Clear filters
                  </Button>
                ) : (
                  <Link className="btn btn-primary" to="/rides/new">
                    Publish a ride
                  </Link>
                )
              }
            />
          </Card>
        ) : (
          <>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
              {items.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  action={
                    <Link className="btn btn-primary btn-sm" to={`/rides/${ride.id}`}>
                      {ride.viewer.canRequest ? 'Request seat' : 'View ride'}
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
