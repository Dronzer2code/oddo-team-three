import { useState } from 'react';
import { Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Button, Card, EmptyState, ErrorState, Field, Screen, SkeletonList, styles } from '../components/ui';
import { RideCard } from '../components/RideCard';
import { space } from '../theme/tokens';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import type { TabParamList } from '../navigation/types';

type Props = BottomTabScreenProps<TabParamList, 'FindRide'>;

/**
 * Ride discovery. Filters are sent to the API as query parameters; the search
 * itself — including the organisation scope — happens on the server.
 */
export function FindRideScreen({ navigation }: Props) {
  const [draft, setDraft] = useState({ from: '', to: '', date: '', seats: '' });
  const [query, setQuery] = useState<Record<string, string>>({});

  const rides = useApi(() => api.employee.rides.search({ ...query, pageSize: 20 }), [JSON.stringify(query)]);

  function apply() {
    const next: Record<string, string> = {};
    if (draft.from.trim()) next.from = draft.from.trim();
    if (draft.to.trim()) next.to = draft.to.trim();
    if (draft.date.trim()) next.date = draft.date.trim();
    if (draft.seats.trim()) next.seats = draft.seats.trim();
    setQuery(next);
  }

  function clear() {
    setDraft({ from: '', to: '', date: '', seats: '' });
    setQuery({});
  }

  const results = rides.data?.items ?? [];
  const filtered = Object.keys(query).length > 0;

  return (
    <Screen>
      <Card>
        <Text style={styles.label}>FILTER</Text>
        <View style={{ marginTop: space[3] }}>
          <Field
            label="Starting area"
            value={draft.from}
            onChangeText={(v) => setDraft({ ...draft, from: v })}
            placeholder="Salt Lake, New Town…"
          />
          <Field
            label="Destination"
            value={draft.to}
            onChangeText={(v) => setDraft({ ...draft, to: v })}
            placeholder="Park Street Office"
          />
          <Field
            label="Date"
            value={draft.date}
            onChangeText={(v) => setDraft({ ...draft, date: v })}
            placeholder="YYYY-MM-DD"
            hint="Leave empty for every upcoming ride"
          />
          <Field
            label="Seats needed"
            value={draft.seats}
            onChangeText={(v) => setDraft({ ...draft, seats: v })}
            keyboardType="number-pad"
            placeholder="1"
          />
          <View style={{ flexDirection: 'row', gap: space[3] }}>
            <Button title="Search" variant="primary" style={{ flex: 1 }} onPress={apply} />
            {filtered ? <Button title="Clear" variant="secondary" onPress={clear} /> : null}
          </View>
        </View>
      </Card>

      {rides.initialLoading ? (
        <SkeletonList rows={3} />
      ) : rides.error ? (
        <ErrorState message={rides.error.message} onRetry={rides.reload} />
      ) : results.length === 0 ? (
        <EmptyState
          title="No rides match"
          text={
            filtered
              ? 'Try widening the date or dropping the seat requirement.'
              : 'Nobody in your organisation has published a ride yet. You could publish the first one.'
          }
          action={
            <Button
              title="Publish a ride"
              variant="accent"
              onPress={() => navigation.getParent()?.navigate('PublishRide')}
            />
          }
        />
      ) : (
        <>
          <Text style={styles.caption}>
            {rides.data?.total} ride{rides.data?.total === 1 ? '' : 's'} available
          </Text>
          {results.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              onPress={() => navigation.getParent()?.navigate('RideDetail', { rideId: ride.id })}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
