import { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  TRIP_ROLE_LABEL,
  TRIP_STATUS_LABEL,
  formatDateTime,
  formatDistance,
  formatMoney,
  formatPlate,
} from '@carpool/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  Field,
  RouteRow,
  Screen,
  SkeletonList,
  styles,
} from '../components/ui';
import { space } from '../theme/tokens';
import { api } from '../services/api';
import { useApi, useMutation } from '../hooks/useApi';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveTrip'>;

const TONE = { in_progress: 'ink', completed: 'success', canceled: 'danger' } as const;

/**
 * Active trip management, and the read-only view of a finished one. Completing a
 * trip is what freezes the distance, fuel and cost onto the record; the snapshot
 * shown here is the one reports will use forever.
 */
export function ActiveTripScreen({ route }: Props) {
  const { tripId } = route.params;
  const trip = useApi(() => api.employee.trips.get(tripId), [tripId]);
  const [distance, setDistance] = useState('');

  const complete = useMutation((km?: number) => api.employee.trips.complete(tripId, km));
  const cancel = useMutation(() => api.employee.trips.cancel(tripId));

  if (trip.initialLoading) {
    return (
      <Screen>
        <SkeletonList rows={3} />
      </Screen>
    );
  }
  if (trip.error || !trip.data) {
    return (
      <Screen>
        <ErrorState message={trip.error?.message} onRetry={trip.reload} />
      </Screen>
    );
  }

  const data = trip.data;
  const live = data.status === 'in_progress';
  const isDriver = data.viewerRole === 'driver';
  const failure = complete.error ?? cancel.error;

  return (
    <Screen>
      {failure ? <Alert tone="danger">{failure.message}</Alert> : null}

      <Card>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.title}>{live ? 'Trip in progress' : 'Trip record'}</Text>
            <Text style={styles.caption}>Started {formatDateTime(data.startedAt)}</Text>
          </View>
          <Badge tone={TONE[data.status]}>{TRIP_STATUS_LABEL[data.status]}</Badge>
        </View>

        <Divider />

        <RouteRow from={data.startLocation} to={data.destination} />
      </Card>

      <Card>
        <Text style={styles.label}>ON BOARD</Text>
        <View style={{ gap: space[3], marginTop: space[3] }}>
          {data.participants.map((participant) => (
            <View key={participant.userId} style={styles.rowBetween}>
              <Text style={styles.body}>{participant.name}</Text>
              <Text style={styles.caption}>
                {TRIP_ROLE_LABEL[participant.role]}
                {participant.seats > 1 ? ` · ${participant.seats} seats` : ''}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={styles.label}>VEHICLE AND COST AT THE TIME OF THE TRIP</Text>
        <View style={{ gap: space[3], marginTop: space[3] }}>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Vehicle</Text>
            <Text style={styles.body}>
              {data.vehicleSnapshot.make} {data.vehicleSnapshot.model}
            </Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Registration</Text>
            <Text style={styles.plate}>{formatPlate(data.vehicleSnapshot.registrationNumber)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Fuel price</Text>
            <Text style={styles.body}>
              {formatMoney(data.costSnapshot.fuelCostPerLitre, data.costSnapshot.currency)} / L
            </Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Efficiency</Text>
            <Text style={styles.body}>{data.costSnapshot.mileageKmpl} km/L</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Distance</Text>
            <Text style={styles.body}>{formatDistance(data.distanceKm)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Fuel used</Text>
            <Text style={styles.body}>{data.fuelConsumedLitres.toFixed(2)} L</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Total cost</Text>
            <Text style={styles.subtitle}>{formatMoney(data.totalCost, data.currency)}</Text>
          </View>
          {data.viewerShare !== null ? (
            <View style={styles.rowBetween}>
              <Text style={styles.caption}>Your share</Text>
              <Text style={styles.subtitle}>{formatMoney(data.viewerShare, data.currency)}</Text>
            </View>
          ) : null}
        </View>
      </Card>

      {live && isDriver ? (
        <Card>
          <Text style={styles.subtitle}>Finish the trip</Text>
          <View style={{ marginTop: space[4] }}>
            <Field
              label="Actual distance (km)"
              value={distance}
              onChangeText={setDistance}
              keyboardType="decimal-pad"
              hint="Leave empty to keep the estimate from the ride"
            />
            <Button
              title="Complete trip"
              variant="primary"
              loading={complete.busy}
              onPress={async () => {
                const km = distance.trim() ? Number(distance) : undefined;
                if (await complete.run(km)) trip.reload();
              }}
            />
            <Button
              title="Cancel trip"
              variant="danger"
              style={{ marginTop: space[3] }}
              loading={cancel.busy}
              onPress={async () => {
                if (await cancel.run()) trip.reload();
              }}
            />
          </View>
        </Card>
      ) : live ? (
        <Card>
          <Text style={styles.caption}>Your driver completes the trip. The cost split appears here after that.</Text>
        </Card>
      ) : null}
    </Screen>
  );
}
