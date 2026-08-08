import { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  RIDE_STATUS_LABEL,
  VEHICLE_TYPE_LABEL,
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
  Seats,
  SkeletonList,
  styles,
} from '../components/ui';
import { space } from '../theme/tokens';
import { api } from '../services/api';
import { useApi, useMutation } from '../hooks/useApi';
import { useAuth } from '../store/auth';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RideDetail'>;

/**
 * Ride detail. Which actions are offered comes from the `viewer` block the API
 * resolves server-side — the client never decides whether a seat may be taken.
 */
export function RideDetailScreen({ route, navigation }: Props) {
  const { rideId } = route.params;
  const { user } = useAuth();
  const ride = useApi(() => api.employee.rides.get(rideId), [rideId]);
  const [seats, setSeats] = useState('1');
  const [note, setNote] = useState('');

  const requestSeat = useMutation((body: { seats: number; note?: string }) =>
    api.employee.rides.requestSeat(rideId, body),
  );
  const withdraw = useMutation((requestId: string) => api.employee.rides.withdraw(rideId, requestId));
  const cancelRide = useMutation(() => api.employee.rides.cancel(rideId));
  const startTrip = useMutation(() => api.employee.trips.start(rideId));

  const busy = requestSeat.busy || withdraw.busy || cancelRide.busy || startTrip.busy;
  const failure = requestSeat.error ?? withdraw.error ?? cancelRide.error ?? startTrip.error;

  if (ride.initialLoading) {
    return (
      <Screen>
        <SkeletonList rows={3} />
      </Screen>
    );
  }
  if (ride.error || !ride.data) {
    return (
      <Screen>
        <ErrorState message={ride.error?.message} onRetry={ride.reload} />
      </Screen>
    );
  }

  const data = ride.data;
  const suspended = user?.status !== 'active';

  return (
    <Screen>
      {failure ? <Alert tone="danger">{failure.message}</Alert> : null}
      {suspended ? (
        <Alert tone="warning">Your access is not active, so requesting a seat is disabled.</Alert>
      ) : null}

      <Card>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.heading}>{formatDateTime(data.departureAt)}</Text>
            <Text style={styles.caption}>
              {data.seatsAvailable} of {data.totalSeats} seats free
            </Text>
          </View>
          <Badge tone={data.status === 'published' ? 'accent' : 'neutral'}>
            {RIDE_STATUS_LABEL[data.status]}
          </Badge>
        </View>

        <Divider />

        <RouteRow
          from={data.startLocation}
          to={data.destination}
          meta={`${formatDistance(data.estimatedDistanceKm)} estimated`}
        />

        <Divider />

        <View style={{ gap: space[3] }}>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Driver</Text>
            <Text style={styles.body}>
              {data.viewer.isDriver ? 'You' : data.driver.name}
              {data.driver.department ? ` · ${data.driver.department}` : ''}
            </Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Vehicle</Text>
            <Text style={styles.body}>
              {data.vehicle.make} {data.vehicle.model} · {VEHICLE_TYPE_LABEL[data.vehicle.vehicleType]}
            </Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Registration</Text>
            <Text style={[styles.plate]}>{formatPlate(data.vehicle.registrationNumber)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Seats</Text>
            <Seats total={data.totalSeats} taken={data.seatsTaken} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.caption}>Cost per seat</Text>
            <Text style={styles.subtitle}>{formatMoney(data.costPerSeat, data.currency)}</Text>
          </View>
        </View>

        {data.notes ? (
          <>
            <Divider />
            <Text style={styles.caption}>{data.notes}</Text>
          </>
        ) : null}
      </Card>

      {/* Driver actions */}
      {data.viewer.isDriver ? (
        <Card>
          <Text style={styles.subtitle}>You are driving this ride</Text>
          <Text style={[styles.caption, { marginTop: space[2] }]}>
            {(data.requests ?? []).filter((r) => r.status === 'pending').length} request(s) waiting, {data.seatsTaken}{' '}
            seat(s) confirmed.
          </Text>
          <View style={{ gap: space[3], marginTop: space[4] }}>
            {data.status === 'published' || data.status === 'full' ? (
              <>
                <Button
                  title="Start the trip"
                  variant="primary"
                  loading={startTrip.busy}
                  disabled={busy}
                  onPress={async () => {
                    const trip = await startTrip.run();
                    if (trip) navigation.replace('ActiveTrip', { tripId: trip.id });
                  }}
                />
                <Button
                  title="Cancel this ride"
                  variant="danger"
                  loading={cancelRide.busy}
                  disabled={busy}
                  onPress={async () => {
                    if (await cancelRide.run()) ride.reload();
                  }}
                />
              </>
            ) : null}
          </View>
        </Card>
      ) : data.viewer.requestStatus === 'pending' || data.viewer.requestStatus === 'accepted' ? (
        <Card>
          <Text style={styles.subtitle}>
            {data.viewer.requestStatus === 'accepted' ? 'Your seat is confirmed' : 'Your request is pending'}
          </Text>
          <Button
            title="Withdraw my request"
            variant="secondary"
            style={{ marginTop: space[4] }}
            loading={withdraw.busy}
            disabled={busy || !data.viewer.requestId}
            onPress={async () => {
              if (data.viewer.requestId && (await withdraw.run(data.viewer.requestId))) ride.reload();
            }}
          />
        </Card>
      ) : data.viewer.canRequest ? (
        <Card>
          <Text style={styles.subtitle}>Request a seat</Text>
          <View style={{ marginTop: space[4] }}>
            <Field
              label="Seats"
              value={seats}
              onChangeText={setSeats}
              keyboardType="number-pad"
              hint={`Up to ${data.seatsAvailable} available`}
            />
            <Field
              label="Note for the driver"
              value={note}
              onChangeText={setNote}
              placeholder="I can wait at the main gate"
              multiline
            />
            <Button
              title="Request seat"
              variant="accent"
              loading={requestSeat.busy}
              disabled={busy || suspended}
              onPress={async () => {
                const result = await requestSeat.run({
                  seats: Number(seats) || 1,
                  note: note.trim() || undefined,
                });
                if (result) ride.reload();
              }}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={styles.caption}>
            {'This ride cannot be requested right now — it may be full, already departed, or your own.'}
          </Text>
        </Card>
      )}
    </Screen>
  );
}
