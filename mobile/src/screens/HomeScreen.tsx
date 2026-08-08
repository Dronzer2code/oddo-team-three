import { Pressable, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { formatDistance, formatMoney, formatNumber, formatRelative } from '@carpool/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  Metric,
  PageTitle,
  RouteRow,
  Screen,
  SkeletonList,
  styles,
} from '../components/ui';
import { RideCard } from '../components/RideCard';
import { Icon } from '../components/Icon';
import { colors, space } from '../theme/tokens';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../store/auth';
import type { TabParamList } from '../navigation/types';

type Props = BottomTabScreenProps<TabParamList, 'Home'>;

/**
 * Employee home: the active trip if there is one, the next rides, the
 * participation summary and recent activity — the same payload the web home
 * screen renders, from /api/employee/home.
 */
export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const home = useApi(() => api.employee.home(), []);

  const suspended = user?.status === 'suspended';

  return (
    <Screen>
      <PageTitle title={`Hello, ${user?.name.split(' ')[0] ?? 'there'}.`} lead="Where are you going?" />

      {suspended ? (
        <Alert tone="warning">
          Your carpooling access is suspended. You can still view history, but publishing and requesting rides
          is disabled until an administrator restores access.
        </Alert>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space[3], marginBottom: space[2] }}>
        <Button
          title="Find a ride"
          variant="primary"
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('FindRide')}
        />
        <Button
          title="Publish"
          variant="accent"
          style={{ flex: 1 }}
          disabled={suspended}
          onPress={() => navigation.getParent()?.navigate('PublishRide')}
        />
      </View>

      {home.initialLoading ? (
        <SkeletonList rows={3} />
      ) : home.error ? (
        <ErrorState message={home.error.message} onRetry={home.reload} />
      ) : home.data ? (
        <>
          {home.data.activeTrip ? (
            <Card>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.title}>Trip in progress</Text>
                  <Text style={styles.caption}>Started {formatRelative(home.data.activeTrip.startedAt)}</Text>
                </View>
                <Badge tone="ink">In progress</Badge>
              </View>
              <Divider />
              <RouteRow
                from={home.data.activeTrip.startLocation}
                to={home.data.activeTrip.destination}
                meta={`${home.data.activeTrip.participants.filter((p) => p.role === 'passenger').length} on board · ${home.data.activeTrip.vehicleSnapshot.model}`}
              />
              <Button
                title="Manage trip"
                variant="primary"
                style={{ marginTop: space[4] }}
                onPress={() =>
                  navigation.getParent()?.navigate('ActiveTrip', { tripId: home.data!.activeTrip!.id })
                }
              />
            </Card>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
            <Metric label="Trips completed" value={formatNumber(home.data.stats.tripsCompleted)} />
            <Metric label="Distance shared" value={formatDistance(home.data.stats.distanceKm)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
            <Metric label="Rides published" value={formatNumber(home.data.stats.ridesPublished)} />
            <Metric
              label="Saved by sharing"
              value={formatMoney(home.data.stats.savedAmount, home.data.stats.currency)}
              hint="versus driving alone"
            />
          </View>

          <Text style={[styles.title, { marginTop: space[5] }]}>Your next rides</Text>
          {home.data.upcomingRides.length === 0 ? (
            <Card>
              <Text style={styles.caption}>
                Nothing booked yet. Search for a ride, or publish the drive you were making anyway.
              </Text>
            </Card>
          ) : (
            home.data.upcomingRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                onPress={() => navigation.getParent()?.navigate('RideDetail', { rideId: ride.id })}
              />
            ))
          )}

          <View style={[styles.rowBetween, { marginTop: space[5] }]}>
            <Text style={styles.title}>Available near you</Text>
            <Pressable onPress={() => navigation.navigate('FindRide')} style={styles.row}>
              <Text style={styles.caption}>Search all</Text>
              <Icon name="arrowRight" size={15} color={colors.fgSecondary} />
            </Pressable>
          </View>
          {home.data.suggestions.length === 0 ? (
            <Card>
              <Text style={styles.caption}>No open rides in your organisation right now.</Text>
            </Card>
          ) : (
            home.data.suggestions.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                onPress={() => navigation.getParent()?.navigate('RideDetail', { rideId: ride.id })}
              />
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}
