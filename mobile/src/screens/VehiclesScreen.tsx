import { useState } from 'react';
import { Text, View } from 'react-native';
import { VEHICLE_STATUS_LABEL, VEHICLE_TYPE_LABEL, formatPlate, vehicleSchema } from '@carpool/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Field,
  PageTitle,
  Screen,
  SkeletonList,
  styles,
} from '../components/ui';
import { space } from '../theme/tokens';
import { api } from '../services/api';
import { useApi, useMutation } from '../hooks/useApi';

const TONE = { active: 'success', inactive: 'neutral', under_review: 'warning' } as const;

/**
 * The employee's own vehicles. Registration numbers are unique per organisation
 * and that is enforced by the database, so a duplicate comes back as a field
 * error rather than being pre-checked here.
 */
export function VehiclesScreen() {
  const vehicles = useApi(() => api.employee.vehicles.list(), []);
  const create = useMutation((body: Record<string, unknown>) => api.employee.vehicles.create(body));

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    make: '',
    model: '',
    registrationNumber: '',
    vehicleType: 'sedan',
    seatingCapacity: '4',
    mileageKmpl: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  async function submit() {
    const parsed = vehicleSchema.safeParse({
      make: form.make.trim(),
      model: form.model.trim(),
      registrationNumber: form.registrationNumber.trim(),
      vehicleType: form.vehicleType,
      seatingCapacity: Number(form.seatingCapacity) || 0,
      mileageKmpl: form.mileageKmpl ? Number(form.mileageKmpl) : undefined,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    const result = await create.run(parsed.data);
    if (result) {
      setAdding(false);
      setForm({ make: '', model: '', registrationNumber: '', vehicleType: 'sedan', seatingCapacity: '4', mileageKmpl: '' });
      vehicles.reload();
    }
  }

  return (
    <Screen>
      <PageTitle
        title="My vehicles"
        lead="Only vehicles marked active by your organisation can be used for a new ride."
      />

      {create.error ? <Alert tone="danger">{create.error.message}</Alert> : null}

      {vehicles.initialLoading ? (
        <SkeletonList rows={2} />
      ) : vehicles.error ? (
        <ErrorState message={vehicles.error.message} onRetry={vehicles.reload} />
      ) : (vehicles.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No vehicle registered"
          text="Register the car you drive to work and you can start publishing rides."
        />
      ) : (
        vehicles.data!.map((vehicle) => (
          <Card key={vehicle.id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subtitle}>
                  {vehicle.make} {vehicle.model}
                </Text>
                <Text style={styles.caption}>
                  {VEHICLE_TYPE_LABEL[vehicle.vehicleType]} · {vehicle.seatingCapacity} seats
                  {vehicle.mileageKmpl ? ` · ${vehicle.mileageKmpl} km/L` : ''}
                </Text>
              </View>
              <Badge tone={TONE[vehicle.status]}>{VEHICLE_STATUS_LABEL[vehicle.status]}</Badge>
            </View>
            <Divider />
            <Text style={styles.plate}>{formatPlate(vehicle.registrationNumber)}</Text>
          </Card>
        ))
      )}

      {adding ? (
        <Card>
          <Text style={styles.label}>REGISTER A VEHICLE</Text>
          <View style={{ marginTop: space[3] }}>
            <Field label="Make" value={form.make} onChangeText={set('make')} error={errors.make} placeholder="Honda" />
            <Field label="Model" value={form.model} onChangeText={set('model')} error={errors.model} placeholder="City" />
            <Field
              label="Registration number"
              value={form.registrationNumber}
              onChangeText={set('registrationNumber')}
              error={errors.registrationNumber}
              autoCapitalize="characters"
              placeholder="WB 06 AK 4412"
            />
            <Field
              label="Vehicle type"
              value={form.vehicleType}
              onChangeText={set('vehicleType')}
              error={errors.vehicleType}
              autoCapitalize="none"
              hint="sedan, hatchback, suv, van or bike"
            />
            <Field
              label="Seating capacity"
              value={form.seatingCapacity}
              onChangeText={set('seatingCapacity')}
              error={errors.seatingCapacity}
              keyboardType="number-pad"
            />
            <Field
              label="Efficiency (km/L)"
              value={form.mileageKmpl}
              onChangeText={set('mileageKmpl')}
              error={errors.mileageKmpl}
              keyboardType="decimal-pad"
              hint="Leave empty to use the organisation default"
            />
            <Button title="Register vehicle" variant="primary" loading={create.busy} onPress={submit} />
            <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} style={{ marginTop: space[2] }} />
          </View>
        </Card>
      ) : (
        <Button title="Register a vehicle" variant="accent" onPress={() => setAdding(true)} />
      )}
    </Screen>
  );
}
