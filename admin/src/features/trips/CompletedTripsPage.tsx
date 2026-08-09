import { TripsTable } from './TripsTable';

/**
 * Finished trips with their frozen cost figures — distance, fuel and cost are
 * the snapshot taken at completion, never recomputed from current settings.
 */
export function CompletedTripsPage() {
  return (
    <TripsTable
      variant="completed"
      title="Completed Trips"
      lead="Finished trips with the distance, fuel and cost recorded at completion."
      emptyTitle="No completed trips yet"
      emptyText="Trips move here once a driver marks them complete."
    />
  );
}
