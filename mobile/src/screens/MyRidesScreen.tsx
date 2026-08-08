import { Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { formatDateTime } from '@carpool/shared';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  Screen,
  SkeletonList,
  styles,
} from '../components/ui';
import { RideCard } from '../components/RideCard';
import { space } from '../theme/tokens';
import { api } from '../services/api';
import { useApi, useMutation } from '../hooks/useApi';
import type { TabParamList } from '../navigation/types';

type Props = BottomTabScreenProps<TabParamList, 'MyRides'>;

/**
 * Rides the employee is driving or riding on, plus the seat requests waiting on
 * their decision. Accept and reject go straight to the API — the seat-capacity
 * and status rules live there.
 */
export function MyRidesScreen({ navigation }: Props) {
  const mine = useApi(() => api.employee.rides.mine(), []);
  const requests = useApi(() => api.employee.rides.incomingRequests(), []);

  const respond = useMutation((rideId: string, requestId: string, action: 'accept' | 'reject') =>
    api.employee.rides.respond(rideId, requestId, action),
  );

  async function decide(rideId: string, requestId: string, action: 'accept' | 'reject') {
    const result = await respond.run(rideId, requestId, action);
    if (result) {
      mine.reload();
      requests.reload();
    }
  }

  const open = navigation.getParent();

  return (
    <Screen>
      {respond.error ? <Alert tone="danger">{respond.error.message}</Alert> : null}

      <Text style={styles.title}>Requests for your rides</Text>
      {requests.initialLoading ? (
        <SkeletonList rows={1} />
      ) : requests.error ? (
        <ErrorState message={requests.error.message} onRetry={requests.reload} />
      ) : (requests.data?.length ?? 0) === 0 ? (
        <Card>
          <Text style={styles.caption}>No seat requests waiting on you.</Text>
        </Card>
      ) : (
        requests.data!.map((request) => (
          <Card key={request.id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subtitle}>{request.passenger.name}</Text>
                <Text style={styles.caption}>
                  {request.seats} seat{request.seats === 1 ? '' : 's'} · asked {formatDateTime(request.createdAt)}
                </Text>
              </View>
              <Badge tone="warning">Pending</Badge>
            </View>
            {request.note ? (
              <Text style={[styles.caption, { marginTop: space[3] }]}>“{request.note}”</Text>
            ) : null}
            <Divider />
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <Button
                title="Accept"
                variant="primary"
                style={{ flex: 1 }}
                loading={respond.busy}
                onPress={() => decide(request.rideId, request.id, 'accept')}
              />
              <Button
                title="Reject"
                variant="secondary"
                style={{ flex: 1 }}
                loading={respond.busy}
                onPress={() => decide(request.rideId, request.id, 'reject')}
              />
            </View>
          </Card>
        ))
      )}

      <Text style={[styles.title, { marginTop: space[6] }]}>Driving</Text>
      {mine.initialLoading ? (
        <SkeletonList rows={2} />
      ) : mine.error ? (
        <ErrorState message={mine.error.message} onRetry={mine.reload} />
      ) : (mine.data?.driving.length ?? 0) === 0 ? (
        <EmptyState
          title="You have not published a ride"
          text="Publish the drive you were making anyway and RideSync prices the empty seats."
          action={<Button title="Publish a ride" variant="accent" onPress={() => open?.navigate('PublishRide')} />}
        />
      ) : (
        mine.data!.driving.map((ride) => (
          <RideCard key={ride.id} ride={ride} onPress={() => open?.navigate('RideDetail', { rideId: ride.id })} />
        ))
      )}

      <Text style={[styles.title, { marginTop: space[6] }]}>Riding</Text>
      {mine.data && mine.data.riding.length === 0 ? (
        <Card>
          <Text style={styles.caption}>No confirmed or pending seats right now.</Text>
        </Card>
      ) : (
        (mine.data?.riding ?? []).map((ride) => (
          <RideCard key={ride.id} ride={ride} onPress={() => open?.navigate('RideDetail', { rideId: ride.id })} />
        ))
      )}
    </Screen>
  );
}
