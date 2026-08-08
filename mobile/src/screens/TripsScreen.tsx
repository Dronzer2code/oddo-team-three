import { Pressable, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  TRIP_ROLE_LABEL,
  TRIP_STATUS_LABEL,
  formatDate,
  formatDistance,
  formatMoney,
  type Trip,
} from '@carpool/shared';
import { Badge, Button, Card, Divider, EmptyState, ErrorState, Screen, SkeletonList, styles } from '../components/ui';
import { colors, space } from '../theme/tokens';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import type { TabParamList } from '../navigation/types';

type Props = BottomTabScreenProps<TabParamList, 'Trips'>;

const TONE = { in_progress: 'ink', completed: 'success', canceled: 'danger' } as const;

/**
 * Trip history. Figures come from the trip's own snapshot, so a later change to
 * the fuel price does not rewrite what a past trip cost.
 */
export function TripsScreen({ navigation }: Props) {
  const trips = useApi(() => api.employee.trips.list(), []);
  const active = useApi(() => api.employee.trips.active(), []);
  const open = navigation.getParent();

  const history = (trips.data ?? []).filter((trip) => trip.status !== 'in_progress');

  return (
    <Screen>
      {active.data ? (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.title}>Trip in progress</Text>
            <Badge tone="ink">In progress</Badge>
          </View>
          <Text style={[styles.subtitle, { marginTop: space[3] }]}>
            {active.data.startLocation} → {active.data.destination}
          </Text>
          <Button
            title="Manage trip"
            variant="primary"
            style={{ marginTop: space[4] }}
            onPress={() => open?.navigate('ActiveTrip', { tripId: active.data!.id })}
          />
        </Card>
      ) : null}

      {trips.initialLoading ? (
        <SkeletonList rows={4} />
      ) : trips.error ? (
        <ErrorState message={trips.error.message} onRetry={trips.reload} />
      ) : history.length === 0 ? (
        <EmptyState
          title="No trips yet"
          text="Once a ride is started and completed it appears here with its distance, fuel and cost."
        />
      ) : (
        history.map((trip: Trip) => (
          <Pressable key={trip.id} onPress={() => open?.navigate('ActiveTrip', { tripId: trip.id })}>
            <Card>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {trip.startLocation} → {trip.destination}
                  </Text>
                  <Text style={styles.caption}>
                    {formatDate(trip.completedAt ?? trip.startedAt)}
                    {trip.viewerRole ? ` · ${TRIP_ROLE_LABEL[trip.viewerRole]}` : ''}
                  </Text>
                </View>
                <Badge tone={TONE[trip.status]}>{TRIP_STATUS_LABEL[trip.status]}</Badge>
              </View>

              <Divider />

              <View style={styles.wrap}>
                <Text style={styles.caption}>{formatDistance(trip.distanceKm)}</Text>
                <Text style={styles.caption}>{trip.fuelConsumedLitres.toFixed(1)} L</Text>
                <Text style={styles.caption}>
                  {formatMoney(trip.viewerShare ?? trip.totalCost, trip.currency)}
                  {trip.viewerShare !== null ? ' your share' : ' total'}
                </Text>
                <Text style={[styles.caption, { color: colors.fgMuted }]}>
                  {formatMoney(trip.costPerKm, trip.currency)} / km
                </Text>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
