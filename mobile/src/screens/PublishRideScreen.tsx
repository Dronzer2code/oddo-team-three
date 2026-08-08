import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { VEHICLE_TYPE_LABEL, formatPlate, publishRideSchema } from '@carpool/shared';
import { ApiError } from '@carpool/api-client';
import {
  Alert,
  Button,
  Card,
  Divider,
  EmptyState,
  Field,
  PageTitle,
  Screen,
  SkeletonList,
  styles,
} from '../components/ui';
import { colors, radius, space } from '../theme/tokens';
import { api } from '../services/api';
import { useApi, useMutation } from '../hooks/useApi';
import { useAuth } from '../store/auth';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PublishRide'>;

/**
 * Publish a ride. Only active vehicles are offered, and the API re-checks
 * ownership, status, capacity and departure time before the ride is created —
 * the picker here is a convenience, not the rule.
 */
export function PublishRideScreen({ navigation }: Props) {
  const { user } = useAuth();
  const vehicles = useApi(() => api.employee.vehicles.list(), []);
  const publish = useMutation((body: Record<string, unknown>) => api.employee.rides.publish(body));

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [form, setForm] = useState({
    startLocation: '',
    destination: '',
    date: '',
    time: '',
    seats: '2',
    distanceKm: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const active = useMemo(
    () => (vehicles.data ?? []).filter((vehicle) => vehicle.status === 'active'),
    [vehicles.data],
  );
  const selected = active.find((vehicle) => vehicle.id === vehicleId) ?? null;

  async function submit() {
    setFailure(null);
    if (!selected) {
      setFailure('Choose a vehicle first.');
      return;
    }
    // Combine the two fields into the ISO instant the shared schema expects.
    const departureAt = `${form.date}T${form.time}:00`;
    const parsed = publishRideSchema.safeParse({
      vehicleId: selected.id,
      startLocation: form.startLocation.trim(),
      destination: form.destination.trim(),
      departureAt: new Date(departureAt).toString() === 'Invalid Date' ? '' : new Date(departureAt).toISOString(),
      seats: Number(form.seats) || 0,
      estimatedDistanceKm: form.distanceKm ? Number(form.distanceKm) : undefined,
      notes: form.notes.trim() || undefined,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      setFailure('Check the highlighted fields.');
      return;
    }

    try {
      const ride = await publish.run(parsed.data);
      if (ride) navigation.replace('RideDetail', { rideId: ride.id });
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : 'Could not publish this ride.');
    }
  }

  if (user?.status !== 'active') {
    return (
      <Screen>
        <Alert tone="warning">
          Publishing is only available to active accounts. An administrator has to activate or restore your
          access first.
        </Alert>
      </Screen>
    );
  }

  return (
    <Screen>
      <PageTitle title="Publish a ride" lead="Offer the seats you were driving with empty anyway." />

      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      {publish.error ? <Alert tone="danger">{publish.error.message}</Alert> : null}

      <Card>
        <Text style={styles.label}>VEHICLE</Text>
        {vehicles.initialLoading ? (
          <SkeletonList rows={1} />
        ) : active.length === 0 ? (
          <EmptyState
            title="No active vehicle"
            text="Register a vehicle, or ask an administrator to activate one, before publishing."
            action={<Button title="My vehicles" variant="secondary" onPress={() => navigation.navigate('Vehicles')} />}
          />
        ) : (
          <View style={{ gap: space[2], marginTop: space[3] }}>
            {active.map((vehicle) => {
              const chosen = vehicle.id === vehicleId;
              return (
                <Pressable
                  key={vehicle.id}
                  onPress={() => setVehicleId(vehicle.id)}
                  style={{
                    padding: space[4],
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: chosen ? colors.forest : colors.border,
                    backgroundColor: chosen ? colors.accentSoft : colors.surface,
                  }}
                >
                  <Text style={styles.subtitle}>
                    {vehicle.make} {vehicle.model}
                  </Text>
                  <Text style={styles.caption}>
                    {VEHICLE_TYPE_LABEL[vehicle.vehicleType]} · {vehicle.seatingCapacity} seats ·{' '}
                    {formatPlate(vehicle.registrationNumber)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <Card>
        <Text style={styles.label}>ROUTE AND TIME</Text>
        <View style={{ marginTop: space[3] }}>
          <Field
            label="Start location"
            value={form.startLocation}
            onChangeText={set('startLocation')}
            error={errors.startLocation}
            placeholder={user?.homeLocation ?? 'Salt Lake Sector V'}
          />
          <Field
            label="Destination"
            value={form.destination}
            onChangeText={set('destination')}
            error={errors.destination}
            placeholder={user?.workLocation ?? 'Park Street Office'}
          />
          <Field
            label="Date"
            value={form.date}
            onChangeText={set('date')}
            error={errors.departureAt}
            placeholder="YYYY-MM-DD"
          />
          <Field label="Departure time" value={form.time} onChangeText={set('time')} placeholder="08:30" />
          <Field
            label="Seats offered"
            value={form.seats}
            onChangeText={set('seats')}
            error={errors.seats}
            keyboardType="number-pad"
            hint={selected ? `Up to ${selected.seatingCapacity - 1} passengers` : 'Choose a vehicle first'}
          />
          <Field
            label="Estimated distance (km)"
            value={form.distanceKm}
            onChangeText={set('distanceKm')}
            error={errors.estimatedDistanceKm}
            keyboardType="decimal-pad"
            hint="Leave empty and the server estimates it"
          />
          <Field
            label="Notes"
            value={form.notes}
            onChangeText={set('notes')}
            placeholder="I leave from the main gate"
            multiline
          />
        </View>

        <Divider />

        {/* The figure itself is deliberately not computed here: the server owns
            the cost basis, and it is shown on the ride once published. */}
        <Text style={styles.caption}>
          The cost per seat is calculated by the server from your organisation's fuel price, running cost and
          the vehicle's efficiency, using the rates in force today. You will see it on the published ride.
        </Text>

        <Button
          title="Publish ride"
          variant="primary"
          style={{ marginTop: space[4] }}
          loading={publish.busy}
          disabled={!selected}
          onPress={submit}
        />
      </Card>
    </Screen>
  );
}
