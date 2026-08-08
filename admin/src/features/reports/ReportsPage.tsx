import { useState } from 'react';
import { TRIP_STATUS, formatDistance, formatMoney, formatNumber, toLocalDateInput } from '@carpool/shared';
import {
  BarChart,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  PageHeader,
  Plate,
  Select,
  SkeletonStats,
  SkeletonTable,
  Stat,
  resolveErrorCopy,
} from '@carpool/ui';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toLocalDateInput(date);
}

const PRESETS = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '12 months', days: 365 },
];

export function ReportsPage() {
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(toLocalDateInput());
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [department, setDepartment] = useState('');
  const [tripStatus, setTripStatus] = useState('');

  const vehicles = useApi(() => api.admin.vehicles.list({ pageSize: 100 }), []);
  const drivers = useApi(() => api.admin.drivers.list({ pageSize: 100 }), []);
  const departments = useApi(() => api.admin.employees.departments(), []);

  const reports = useApi(
    () =>
      api.admin.reports({
        from,
        to,
        vehicleId: vehicleId || undefined,
        driverId: driverId || undefined,
        department: department || undefined,
        tripStatus: tripStatus || undefined,
      }),
    [from, to, vehicleId, driverId, department, tripStatus],
  );

  const data = reports.data;

  function applyPreset(days: number) {
    setFrom(daysAgo(days));
    setTo(toLocalDateInput());
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      ['Vehicle', 'Registration', 'Trips', 'Distance km', 'Fuel litres', 'Cost', 'Cost per km', 'Efficiency km/l'],
      ...data.vehicles.map((vehicle) => [
        vehicle.label,
        vehicle.registrationNumber,
        String(vehicle.trips),
        String(vehicle.distanceKm),
        String(vehicle.fuelLitres),
        String(vehicle.cost),
        String(vehicle.costPerKm),
        String(vehicle.efficiencyKmpl),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ridesync-vehicle-report-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Reports"
        lead="Completed trips only. Canceled rides and canceled trips are reported separately and never inflate these figures."
        actions={
          <Button variant="secondary" icon="download" onClick={exportCsv} disabled={!data}>
            Export vehicles CSV
          </Button>
        }
      />

      <Card>
        <div className="filter-bar">
          <Input label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          <div className="form-group">
            <span className="form-label">Quick range</span>
            <div className="btn-group">
              {PRESETS.map((preset) => (
                <button key={preset.label} onClick={() => applyPreset(preset.days)}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <Select
            label="Vehicle"
            placeholder="All vehicles"
            options={(vehicles.data?.items ?? []).map((vehicle) => ({
              value: vehicle.id,
              label: `${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}`,
            }))}
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
          />
          <Select
            label="Driver"
            placeholder="All drivers"
            options={(drivers.data?.items ?? []).map((driver) => ({ value: driver.employeeId, label: driver.name }))}
            value={driverId}
            onChange={(event) => setDriverId(event.target.value)}
          />
          <Select
            label="Department"
            placeholder="All departments"
            options={(departments.data ?? []).map((value) => ({ value, label: value }))}
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          />
          <Select
            label="Trip status"
            placeholder="Completed"
            options={[
              { value: TRIP_STATUS.COMPLETED, label: 'Completed' },
              { value: TRIP_STATUS.CANCELED, label: 'Canceled' },
              { value: TRIP_STATUS.IN_PROGRESS, label: 'In progress' },
            ]}
            value={tripStatus}
            onChange={(event) => setTripStatus(event.target.value)}
          />
        </div>
      </Card>

      {reports.error ? (
        <Card style={{ marginTop: 'var(--space-6)' }}>
          <ErrorState {...resolveErrorCopy(reports.error)} onRetry={reports.reload} />
        </Card>
      ) : reports.initialLoading || !data ? (
        <div style={{ marginTop: 'var(--space-6)' }}>
          <SkeletonStats count={4} />
        </div>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginTop: 'var(--space-6)' }}>
            <Stat
              label="Completed trips"
              value={formatNumber(data.totals.completedTrips)}
              icon="route"
              accent
              foot={
                <>
                  <span>{formatNumber(data.totals.rides)} rides published</span>
                  <span className="t-muted">{formatNumber(data.totals.canceledRides)} canceled</span>
                </>
              }
            />
            <Stat
              label="Distance"
              value={formatDistance(data.totals.distanceKm)}
              icon="trend"
              foot={<span>{formatNumber(data.totals.averageOccupancy, 1)} people per trip on average</span>}
            />
            <Stat
              label="Fuel consumed"
              value={`${formatNumber(data.totals.fuelLitres, 1)} L`}
              icon="fuel"
              foot={
                <span>
                  {data.totals.fuelLitres > 0
                    ? `${formatNumber(data.totals.distanceKm / data.totals.fuelLitres, 1)} km/l effective`
                    : 'No fuel recorded'}
                </span>
              }
            />
            <Stat
              label="Transportation cost"
              value={formatMoney(data.totals.totalCost, data.totals.currency)}
              icon="wallet"
              foot={<span>{formatMoney(data.totals.costPerKm, data.totals.currency, 2)} per km</span>}
            />
          </div>

          <Card style={{ marginTop: 'var(--space-6)' }}>
            <CardHeader title="Trips by month" lead="Within the selected range and filters" />
            <CardBody>
              {data.monthly.length === 0 ? (
                <EmptyState
                  icon="chart"
                  title="No trips in this range"
                  text="Widen the date range or clear the filters."
                />
              ) : (
                <BarChart points={data.monthly.map((point) => ({ label: point.label, value: point.trips }))} />
              )}
            </CardBody>
          </Card>

          <div className="grid grid-2" style={{ marginTop: 'var(--space-6)', alignItems: 'start' }}>
            <Card>
              <CardHeader title="Cost by vehicle" lead="Fuel efficiency from each trip's own snapshot" />
              <CardBody flush>
                {data.vehicles.length === 0 ? (
                  <EmptyState icon="car" title="No vehicle activity in this range" />
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Vehicle</th>
                          <th className="is-numeric">Trips</th>
                          <th className="is-numeric">Distance</th>
                          <th className="is-numeric">Fuel</th>
                          <th className="is-numeric">Cost</th>
                          <th className="is-numeric">Per km</th>
                          <th className="is-numeric">km/l</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.vehicles.map((vehicle) => (
                          <tr key={vehicle.vehicleId}>
                            <td>
                              <div className="t-medium">{vehicle.label}</div>
                              <Plate>{vehicle.registrationNumber}</Plate>
                            </td>
                            <td className="is-numeric">{formatNumber(vehicle.trips)}</td>
                            <td className="is-numeric">{formatNumber(vehicle.distanceKm)}</td>
                            <td className="is-numeric">{formatNumber(vehicle.fuelLitres, 1)}</td>
                            <td className="is-numeric">{formatMoney(vehicle.cost, data.totals.currency)}</td>
                            <td className="is-numeric">{formatMoney(vehicle.costPerKm, data.totals.currency, 2)}</td>
                            <td className="is-numeric">{formatNumber(vehicle.efficiencyKmpl, 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Driver activity" lead="Rides published and passengers carried" />
              <CardBody flush>
                {data.drivers.length === 0 ? (
                  <EmptyState icon="user" title="No driver activity in this range" />
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Driver</th>
                          <th className="is-numeric">Published</th>
                          <th className="is-numeric">Trips</th>
                          <th className="is-numeric">Passengers</th>
                          <th className="is-numeric">Distance</th>
                          <th className="is-numeric">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.drivers.map((driver) => (
                          <tr key={driver.driverId}>
                            <td>
                              <div className="t-medium">{driver.name}</div>
                              <div className="t-caption">{driver.department ?? '—'}</div>
                            </td>
                            <td className="is-numeric">{formatNumber(driver.ridesPublished)}</td>
                            <td className="is-numeric">{formatNumber(driver.tripsCompleted)}</td>
                            <td className="is-numeric">{formatNumber(driver.passengersServed)}</td>
                            <td className="is-numeric">{formatNumber(driver.distanceKm)}</td>
                            <td className="is-numeric">{formatMoney(driver.cost, data.totals.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <Card style={{ marginTop: 'var(--space-4)' }}>
            <CardBody tight>
              <p className="t-caption">
                <Icon name="info" size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6 }} />
                Both range boundaries are inclusive — a report for 1–31 March includes a trip completed at 18:40
                on 31 March. Fuel and cost come from each trip's snapshot, so re-running an old report reproduces
                the original numbers.
              </p>
            </CardBody>
          </Card>
        </>
      )}

      {reports.loading && !reports.initialLoading ? <SkeletonTable rows={1} columns={3} /> : null}
    </>
  );
}
