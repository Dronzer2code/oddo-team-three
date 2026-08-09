import { TripsTable } from './TripsTable';

/** Trips currently under way. Costs are only final once the driver completes. */
export function ActiveTripsPage() {
  return (
    <TripsTable
      variant="active"
      title="Active Trips"
      lead="Trips currently under way in your organization."
      emptyTitle="No trips are running right now"
      emptyText="A trip appears here the moment a driver starts one."
    />
  );
}
