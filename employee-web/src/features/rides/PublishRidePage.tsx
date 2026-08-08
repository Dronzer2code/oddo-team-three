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
  CardHeader,
  EmptyState,
  Icon,
  Input,
  Meter,
  PageHeader,
  Plate,
  RouteTimeline,
  Seats,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi, useMutation } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { isOperational } from '../../lib/auth';

const STEPS = ['Where', 'When', 'Vehicle', 'Seats', 'Review'] as const;

export function PublishRidePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const vehicles = useApi(() => api.employee.vehicles.list(), []);
  const profile = useApi(() => api.employee.profile.get(), []);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    startLocation: '',
    destination: '',
    date: toLocalDateInput(),
    time: '08:30',
    vehicleId: '',
    seats: '2',
    estimatedDistanceKm: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const publish = useMutation((body: Record<string, unknown>) => api.employee.rides.publish(body));

  const activeVehicles = (vehicles.data ?? []).filter((vehicle) => vehicle.status === VEHICLE_STATUS.ACTIVE);
  const selectedVehicle = activeVehicles.find((vehicle) => vehicle.id === form.vehicleId) ?? activeVehicles[0];
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

  const departureAt = useMemo(() => {
    if (!form.date || !form.time) return null;
    const value = new Date(`${form.date}T${form.time}`);
    return Number.isNaN(value.getTime()) ? null : value;
  }, [form.date, form.time]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  function validateStep(index: number): boolean {
    const next: Record<string, string> = {};
    if (index === 0) {
      if (form.startLocation.trim().length < 2) next.startLocation = 'Where are you starting from?';
      if (form.destination.trim().length < 2) next.destination = 'Where are you going?';
      if (form.startLocation.trim() === form.destination.trim() && form.startLocation) {
        next.destination = 'Destination must differ from the start';
      }
    }
    if (index === 1) {
      if (!departureAt) next.time = 'Enter a valid date and time';
      else if (departureAt.getTime() <= Date.now()) next.time = 'Departure must be in the future';
    }
    if (index === 2) {
      if (!selectedVehicle) next.vehicleId = 'Register and get a vehicle approved first';
    }
    if (index === 3) {
      const seats = Number(form.seats);
      if (!Number.isFinite(seats) || seats < 1) next.seats = 'Offer at least one seat';
      else if (seats > maxSeats) next.seats = `This vehicle can offer at most ${maxSeats}`;
      const distance = Number(form.estimatedDistanceKm);
      if (!Number.isFinite(distance) || distance <= 0) next.estimatedDistanceKm = 'Enter the distance in km';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (!validateStep(3) || !departureAt || !selectedVehicle) return;
    const result = await publish.run({
      vehicleId: selectedVehicle.id,
      startLocation: form.startLocation.trim(),
      destination: form.destination.trim(),
      departureAt: departureAt.toISOString(),
      seats: Number(form.seats),
      estimatedDistanceKm: Number(form.estimatedDistanceKm),
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

  return (
    <>
      <PageHeader
        title="Publish a ride"
        lead="Five short steps. Nothing is published until you confirm on the last one."
      />

      <Card>
        <CardHeader
          title={`Step ${step + 1} of ${STEPS.length} — ${STEPS[step]}`}
          actions={
            <span className="t-caption">
              {prefilled ? 'Route prefilled from your profile' : `${STEPS.length - step - 1} steps left`}
            </span>
          }
        />
        <CardBody className="stack-lg">
          <Meter value={step + 1} max={STEPS.length} accent />

          {publish.error ? <Alert tone="error">{publish.error.message}</Alert> : null}

          {step === 0 ? (
            <div className="stack">
              <h2 className="t-title">Where are you going?</h2>
              <Input
                label="Start location"
                value={form.startLocation}
                onChange={(event) => set('startLocation', event.target.value)}
                error={errors.startLocation}
                icon="pin"
                placeholder="Salt Lake Sector V"
                autoFocus
              />
              <Input
                label="Destination"
                value={form.destination}
                onChange={(event) => set('destination', event.target.value)}
                error={errors.destination}
                icon="pin"
                placeholder="Park Street Office"
              />
              <Button
                variant="ghost"
                size="sm"
                icon="refresh"
                onClick={() =>
                  setForm({ ...form, startLocation: form.destination, destination: form.startLocation })
                }
              >
                Swap direction
              </Button>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="stack">
              <h2 className="t-title">When are you leaving?</h2>
              <div className="form-row">
                <Input
                  label="Date"
                  type="date"
                  min={toLocalDateInput()}
                  value={form.date}
                  onChange={(event) => set('date', event.target.value)}
                  error={errors.date}
                />
                <Input
                  label="Departure time"
                  type="time"
                  value={form.time}
                  onChange={(event) => set('time', event.target.value)}
                  error={errors.time}
                />
              </div>
              <div className="row-wrap">
                {['07:30', '08:30', '09:30', '18:00', '19:00'].map((time) => (
                  <Button key={time} variant={form.time === time ? 'primary' : 'secondary'} size="sm" onClick={() => set('time', time)}>
                    {time}
                  </Button>
                ))}
                <Button variant="ghost" size="sm" onClick={() => set('time', toLocalTimeInput())}>
                  Now
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="stack">
              <h2 className="t-title">Which vehicle?</h2>
              {errors.vehicleId ? <Alert tone="error">{errors.vehicleId}</Alert> : null}
              <div className="stack">
                {activeVehicles.map((vehicle) => {
                  const selected = (form.vehicleId || activeVehicles[0]?.id) === vehicle.id;
                  return (
                    <button
                      key={vehicle.id}
                      className="card card--interactive"
                      style={{
                        padding: 'var(--space-4)',
                        textAlign: 'left',
                        borderColor: selected ? 'var(--color-fg)' : undefined,
                      }}
                      onClick={() => set('vehicleId', vehicle.id)}
                    >
                      <div className="row-between">
                        <span className="row">
                          <span className="card-statistic__icon">
                            <Icon name="car" size={16} />
                          </span>
                          <span>
                            <span className="t-medium">
                              {vehicle.make} {vehicle.model}
                            </span>
                            <div className="t-caption">
                              {VEHICLE_TYPE_LABEL[vehicle.vehicleType]} · {vehicle.seatingCapacity} seats
                              {vehicle.color ? ` · ${vehicle.color}` : ''}
                            </div>
                          </span>
                        </span>
                        <span className="row" style={{ gap: 'var(--space-3)' }}>
                          <Plate>{vehicle.registrationNumber}</Plate>
                          {selected ? <Icon name="check" size={16} /> : null}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="stack">
              <h2 className="t-title">How many seats, and how far?</h2>
              <div className="form-row">
                <Select
                  label="Seats offered"
                  options={Array.from({ length: maxSeats }).map((_, index) => ({
                    value: String(index + 1),
                    label: `${index + 1} seat${index === 0 ? '' : 's'}`,
                  }))}
                  value={form.seats}
                  onChange={(event) => set('seats', event.target.value)}
                  error={errors.seats}
                  hint={`${selectedVehicle?.seatingCapacity} seats including you`}
                />
                <Input
                  label="Estimated distance (km)"
                  type="number"
                  step="0.1"
                  min={0.1}
                  value={form.estimatedDistanceKm}
                  onChange={(event) => set('estimatedDistanceKm', event.target.value)}
                  error={errors.estimatedDistanceKm}
                  placeholder="12.4"
                />
              </div>
              <div className="row">
                <span className="t-caption">Seat availability preview</span>
                <Seats total={Number(form.seats) || 1} taken={0} />
              </div>
              <Textarea
                label="Notes for passengers"
                optional
                rows={3}
                value={form.notes}
                onChange={(event) => set('notes', event.target.value)}
                placeholder="Pickup near the metro gate. Leaving sharp."
              />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="stack-lg">
              <h2 className="t-title">Review and publish</h2>
              <RouteTimeline
                from={form.startLocation}
                to={form.destination}
                middle={
                  <span className="t-caption">
                    {formatDistance(Number(form.estimatedDistanceKm) || 0)} ·{' '}
                    {departureAt ? departureAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                  </span>
                }
              />
              <div className="detail-list">
                <div className="detail-list__item">
                  <div className="detail-list__label">Vehicle</div>
                  <div className="detail-list__value">
                    {selectedVehicle?.make} {selectedVehicle?.model}
                  </div>
                </div>
                <div className="detail-list__item">
                  <div className="detail-list__label">Registration</div>
                  <div className="detail-list__value">
                    <Plate>{selectedVehicle?.registrationNumber ?? ''}</Plate>
                  </div>
                </div>
                <div className="detail-list__item">
                  <div className="detail-list__label">Seats offered</div>
                  <div className="detail-list__value">{form.seats}</div>
                </div>
                <div className="detail-list__item">
                  <div className="detail-list__label">Cost per seat</div>
                  <div className="detail-list__value t-caption">
                    Calculated on publish from your organization&apos;s current fuel price and running cost.
                  </div>
                </div>
              </div>
              {form.notes ? <Alert tone="info">{form.notes}</Alert> : null}
              <Alert tone="info">
                Distance, fuel and cost are recalculated on the server. If your vehicle is not active or the
                seats exceed its capacity, publishing is refused.
              </Alert>
            </div>
          ) : null}

          <div className="row-between">
            <Button
              variant="ghost"
              icon="arrowLeft"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || publish.busy}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                variant="primary"
                iconAfter="arrowRight"
                onClick={() => {
                  if (validateStep(step)) setStep((current) => current + 1);
                }}
              >
                Continue
              </Button>
            ) : (
              <Button variant="accent" icon="check" onClick={submit} loading={publish.busy}>
                Publish ride
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
