import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  VEHICLE_STATUS,
  VEHICLE_TYPE_LABEL,
  formatDistance,
  toLocalDateInput,
  toLocalTimeInput,
} from '@carpool/shared';
import {
  Alert,
  Button,
  Card,
  CardBody,
  DateField,
  EmptyState,
  Icon,
  Input,
  PageHeader,
  Plate,
  RouteTimeline,
  Seats,
  Select,
  Skeleton,
  Textarea,
  TimeField,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { isOperational } from '../../lib/auth';

/** A departure has to be at least this far ahead — matches the server rule. */
const LEAD_MINUTES = 10;

/** Offered as one-tap chips; each rolls to tomorrow once it has passed today. */
const COMMON_TIMES = ['07:30', '08:30', '09:30', '17:30', '18:30'];

function roundUpTo5(date: Date): Date {
  const next = new Date(date);
  next.setSeconds(0, 0);
  next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5);
  return next;
}

/** Default departure: the next five-minute mark at least half an hour away. */
function defaultDeparture(): { date: string; time: string } {
  const when = roundUpTo5(new Date(Date.now() + 30 * 60_000));
  return { date: toLocalDateInput(when), time: toLocalTimeInput(when) };
}

/**
 * The next time `hhmm` comes around — today if it is still comfortably ahead,
 * otherwise tomorrow. This is what stops the quick chips from handing back a
 * departure that has already been and gone.
 */
function nextOccurrence(hhmm: string, now: Date): { date: string; time: string; tomorrow: boolean } {
  const [hours, minutes] = hhmm.split(':').map(Number);
  const candidate = new Date(now);
  candidate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  const tomorrow = candidate.getTime() <= now.getTime() + LEAD_MINUTES * 60_000;
  if (tomorrow) candidate.setDate(candidate.getDate() + 1);
  return { date: toLocalDateInput(candidate), time: hhmm, tomorrow };
}

export function PublishRidePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const vehicles = useApi(() => api.employee.vehicles.list(), []);
  const profile = useApi(() => api.employee.profile.get(), []);

  const [form, setForm] = useState(() => ({
    startLocation: '',
    destination: '',
    ...defaultDeparture(),
    vehicleId: '',
    seats: '2',
    estimatedDistanceKm: '',
    notes: '',
  }));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  /**
   * The clock has to be state, not a bare `Date.now()` inside a memo: leaving
   * the page open for ten minutes used to leave the "is this in the future?"
   * check frozen at whatever it computed on mount.
   */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(id);
  }, []);

  const publish = useMutation((body: Record<string, unknown>) => api.employee.rides.publish(body));

  const activeVehicles = (vehicles.data ?? []).filter((vehicle) => vehicle.status === VEHICLE_STATUS.ACTIVE);
  const selectedVehicle =
    activeVehicles.find((vehicle) => vehicle.id === form.vehicleId) ?? activeVehicles[0];
  const maxSeats = selectedVehicle ? Math.max(1, selectedVehicle.seatingCapacity - 1) : 1;

  // Prefill the route from the profile's home and work locations, once.
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    const data = profile.data;
    if (!data || prefilled) return;
    if (data.homeLocation && data.workLocation) {
      setForm((current) =>
        current.startLocation || current.destination
          ? current
          : { ...current, startLocation: data.homeLocation!, destination: data.workLocation! },
      );
      setPrefilled(true);
    }
  }, [profile.data, prefilled]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setTouched((current) => ({ ...current, [key]: true }));
  };

  const today = toLocalDateInput(now);
  const isToday = form.date === today;
  /** Earliest selectable clock time — only constrains the picker on today. */
  const earliestToday = toLocalTimeInput(roundUpTo5(new Date(now.getTime() + LEAD_MINUTES * 60_000)));

  const departureAt = useMemo(() => {
    if (!form.date || !form.time) return null;
    const value = new Date(`${form.date}T${form.time}`);
    return Number.isNaN(value.getTime()) ? null : value;
  }, [form.date, form.time]);

  const distance = Number(form.estimatedDistanceKm);
  const seats = Number(form.seats);

  /** Everything that still stands between the form and a published ride. */
  const errors = useMemo(() => {
    const next: Record<string, string> = {};

    if (form.startLocation.trim().length < 2) next.startLocation = 'Where are you starting from?';
    if (form.destination.trim().length < 2) next.destination = 'Where are you going?';
    else if (form.startLocation.trim() && form.startLocation.trim() === form.destination.trim()) {
      next.destination = 'Destination must differ from the start';
    }

    if (!form.date) next.date = 'Pick a date';
    if (!form.time) next.time = 'Pick a departure time';
    else if (!departureAt) next.time = 'That date and time could not be read';
    else if (departureAt.getTime() <= now.getTime() + LEAD_MINUTES * 60_000) {
      next.time = isToday
        ? `${form.time} today has already passed — pick a later time, or move the ride to tomorrow.`
        : `Departure has to be at least ${LEAD_MINUTES} minutes from now.`;
    }

    if (!selectedVehicle) next.vehicleId = 'Register a vehicle and get it approved first';

    if (!Number.isFinite(seats) || seats < 1) next.seats = 'Offer at least one seat';
    else if (seats > maxSeats) next.seats = `This vehicle can offer at most ${maxSeats}`;

    if (!Number.isFinite(distance) || distance <= 0) next.estimatedDistanceKm = 'Enter the distance in km';

    return next;
  }, [
    form.startLocation,
    form.destination,
    form.date,
    form.time,
    departureAt,
    now,
    isToday,
    selectedVehicle,
    seats,
    maxSeats,
    distance,
  ]);

  /** Show a message once the field has been touched, or once publish was tried. */
  const shown = (key: string) => (submitted || touched[key] ? errors[key] : undefined);
  const ready = Object.keys(errors).length === 0;

  /** Keep the date, push the ride to the same clock time tomorrow. */
  const moveToTomorrow = () => {
    const base = new Date(`${form.date || today}T${form.time || '08:30'}`);
    base.setDate(base.getDate() + 1);
    setForm((current) => ({ ...current, date: toLocalDateInput(base) }));
    setTouched((current) => ({ ...current, date: true, time: true }));
  };

  async function submit() {
    setSubmitted(true);
    if (!ready || !departureAt || !selectedVehicle) return;
    const result = await publish.run({
      vehicleId: selectedVehicle.id,
      startLocation: form.startLocation.trim(),
      destination: form.destination.trim(),
      departureAt: departureAt.toISOString(),
      seats,
      estimatedDistanceKm: distance,
      notes: form.notes.trim() || undefined,
    });
    if (result) {
      toast.success('Ride published — colleagues can now request a seat');
      navigate(`/rides/${result.id}`);
    }
  }

  if (!isOperational(user)) {
    return (
      <>
        <PageHeader title="Publish a ride" />
        <Card>
          <EmptyState
            icon="alert"
            title="Publishing is not available for your account"
            text={
              user?.status === 'suspended'
                ? 'Your carpooling access is suspended. Contact your administrator to restore it.'
                : 'Your account is pending activation by an administrator.'
            }
            action={
              <Link className="btn btn-secondary" to="/home">
                Back to home
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  if (vehicles.initialLoading) {
    return (
      <>
        <PageHeader title="Publish a ride" />
        <Card>
          <CardBody className="stack">
            <Skeleton variant="title" width="34%" />
            <Skeleton width="60%" />
            <Skeleton variant="block" height={160} />
          </CardBody>
        </Card>
      </>
    );
  }

  if (activeVehicles.length === 0) {
    return (
      <>
        <PageHeader title="Publish a ride" />
        <Card>
          <EmptyState
            icon="car"
            title="You need an approved vehicle first"
            text={
              (vehicles.data ?? []).length > 0
                ? 'Your vehicle is registered but not approved yet. An administrator has to approve it before you can publish rides.'
                : 'Register the car you drive to work. Once an administrator approves it you can offer the empty seats.'
            }
            action={
              <Link className="btn btn-primary" to="/vehicles">
                <Icon name="plus" size={16} />
                Manage my vehicles
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  const departureLabel = departureAt
    ? departureAt.toLocaleString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <>
      <PageHeader
        title="Publish a ride"
        lead={
          prefilled
            ? 'Route prefilled from your profile — adjust anything and publish.'
            : 'One form. Nothing is offered to colleagues until you press publish.'
        }
        actions={
          <Link className="btn btn-ghost" to="/rides">
            <Icon name="search" size={16} />
            Find a ride instead
          </Link>
        }
      />

      <div className="grid grid-split">
        <Card>
          <CardBody className="publish-form">
            {publish.error ? <Alert tone="error">{publish.error.message}</Alert> : null}

            <section className="form-section">
              <header className="form-section__head">
                <h2 className="form-section__title">Route</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="refresh"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      startLocation: current.destination,
                      destination: current.startLocation,
                    }))
                  }
                >
                  Swap
                </Button>
              </header>
              <div className="form-row">
                <Input
                  label="Start location"
                  value={form.startLocation}
                  onChange={(event) => set('startLocation', event.target.value)}
                  error={shown('startLocation')}
                  icon="pin"
                  placeholder="Salt Lake Sector V"
                />
                <Input
                  label="Destination"
                  value={form.destination}
                  onChange={(event) => set('destination', event.target.value)}
                  error={shown('destination')}
                  icon="pin"
                  placeholder="Park Street Office"
                />
              </div>
            </section>

            <section className="form-section">
              <header className="form-section__head">
                <h2 className="form-section__title">Departure</h2>
                <span className="t-caption">{isToday ? 'Leaving today' : departureLabel}</span>
              </header>
              <div className="form-row">
                <DateField
                  label="Date"
                  min={today}
                  clearable={false}
                  value={form.date}
                  onChange={(event) => set('date', event.target.value)}
                  error={shown('date')}
                />
                <TimeField
                  label="Departure time"
                  clearable={false}
                  /* On today, everything already past is greyed out in the picker. */
                  min={isToday ? earliestToday : undefined}
                  value={form.time}
                  onChange={(event) => set('time', event.target.value)}
                  error={shown('time')}
                />
              </div>

              <div className="row-wrap chip-choices">
                {COMMON_TIMES.map((time) => {
                  const slot = nextOccurrence(time, now);
                  const selected = form.date === slot.date && form.time === slot.time;
                  return (
                    <button
                      key={time}
                      type="button"
                      className={`time-chip${selected ? ' is-selected' : ''}`}
                      onClick={() => {
                        setForm((current) => ({ ...current, date: slot.date, time: slot.time }));
                        setTouched((current) => ({ ...current, date: true, time: true }));
                      }}
                    >
                      <span className="time-chip__time">{time}</span>
                      <span className="time-chip__day">{slot.tomorrow ? 'Tomorrow' : 'Today'}</span>
                    </button>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  icon="clock"
                  onClick={() => {
                    const soon = roundUpTo5(new Date(now.getTime() + 30 * 60_000));
                    setForm((current) => ({
                      ...current,
                      date: toLocalDateInput(soon),
                      time: toLocalTimeInput(soon),
                    }));
                    setTouched((current) => ({ ...current, date: true, time: true }));
                  }}
                >
                  In 30 minutes
                </Button>
              </div>

              {shown('time') && isToday ? (
                <Button variant="secondary" size="sm" icon="calendar" onClick={moveToTomorrow}>
                  Move this ride to tomorrow
                </Button>
              ) : null}
            </section>

            <section className="form-section">
              <header className="form-section__head">
                <h2 className="form-section__title">Vehicle</h2>
                <Link className="t-caption" to="/vehicles">
                  Manage vehicles
                </Link>
              </header>
              {shown('vehicleId') ? <Alert tone="error">{errors.vehicleId}</Alert> : null}
              <div className="choice-row">
                {activeVehicles.map((vehicle) => {
                  const selected = selectedVehicle?.id === vehicle.id;
                  return (
                    <button
                      key={vehicle.id}
                      type="button"
                      className={`choice${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => set('vehicleId', vehicle.id)}
                    >
                      <span className="choice__icon">
                        <Icon name="car" size={16} />
                      </span>
                      <span className="choice__text">
                        <span className="choice__name">
                          {vehicle.make} {vehicle.model}
                        </span>
                        <span className="choice__meta">
                          {VEHICLE_TYPE_LABEL[vehicle.vehicleType]} · {vehicle.seatingCapacity} seats
                        </span>
                      </span>
                      <Plate>{vehicle.registrationNumber}</Plate>
                      {selected ? <Icon name="check" size={15} className="choice__check" /> : null}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="form-section">
              <header className="form-section__head">
                <h2 className="form-section__title">Seats and distance</h2>
                <Seats total={Math.min(Math.max(seats || 1, 1), 12)} taken={0} />
              </header>
              <div className="form-row">
                <Select
                  label="Seats offered"
                  options={Array.from({ length: maxSeats }).map((_, index) => ({
                    value: String(index + 1),
                    label: `${index + 1} seat${index === 0 ? '' : 's'}`,
                  }))}
                  value={form.seats}
                  onChange={(event) => set('seats', event.target.value)}
                  error={shown('seats')}
                  hint={`${selectedVehicle?.seatingCapacity} seats including you`}
                />
                <Input
                  label="Estimated distance (km)"
                  type="number"
                  step="0.1"
                  min={0.1}
                  value={form.estimatedDistanceKm}
                  onChange={(event) => set('estimatedDistanceKm', event.target.value)}
                  error={shown('estimatedDistanceKm')}
                  placeholder="12.4"
                />
              </div>
              <Textarea
                label="Notes for passengers"
                optional
                rows={2}
                value={form.notes}
                onChange={(event) => set('notes', event.target.value)}
                placeholder="Pickup near the metro gate. Leaving sharp."
              />
            </section>
          </CardBody>
        </Card>

        <aside className="publish-aside">
          <Card>
            <CardBody className="stack">
              <h2 className="t-subtitle">Before you publish</h2>

              <RouteTimeline
                from={form.startLocation || 'Start location'}
                to={form.destination || 'Destination'}
                middle={
                  <span className="t-caption">
                    {Number.isFinite(distance) && distance > 0
                      ? formatDistance(distance)
                      : 'Distance not set'}
                  </span>
                }
              />

              <div className="detail-list">
                <div className="detail-list__item">
                  <div className="detail-list__label">Departure</div>
                  <div className="detail-list__value">{departureLabel}</div>
                </div>
                <div className="detail-list__item">
                  <div className="detail-list__label">Vehicle</div>
                  <div className="detail-list__value">
                    {selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model}` : '—'}
                  </div>
                </div>
                <div className="detail-list__item">
                  <div className="detail-list__label">Registration</div>
                  <div className="detail-list__value">
                    {selectedVehicle ? <Plate>{selectedVehicle.registrationNumber}</Plate> : '—'}
                  </div>
                </div>
                <div className="detail-list__item">
                  <div className="detail-list__label">Seats offered</div>
                  <div className="detail-list__value">{Number.isFinite(seats) ? seats : '—'}</div>
                </div>
                <div className="detail-list__item">
                  <div className="detail-list__label">Cost per seat</div>
                  <div className="detail-list__value t-caption">
                    Calculated on publish from your organization&apos;s fuel price and running cost.
                  </div>
                </div>
              </div>

              {submitted && !ready ? (
                <Alert tone="error">
                  <span className="t-medium">Almost there</span>
                  <ul className="publish-issues">
                    {Object.entries(errors).map(([key, message]) => (
                      <li key={key}>{message}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}

              <Button variant="primary" icon="check" block loading={publish.busy} onClick={submit}>
                Publish ride
              </Button>
              <p className="t-caption">
                Distance, fuel and cost are recalculated on the server. Publishing is refused if the vehicle
                is not active or the seats exceed its capacity.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
