import { Text, View } from 'react-native';
import { formatDateTime, formatRelative } from '@carpool/shared';
import {
  Badge,
  Card,
  Divider,
  EmptyState,
  ErrorState,
  PageTitle,
  Screen,
  SkeletonList,
  styles,
} from '../components/ui';
import { space } from '../theme/tokens';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';

/**
 * Activity feed derived from what the API already returns — incoming seat
 * requests and the employee's own ride states. Push notifications are out of
 * MVP scope, so nothing is registered with a device token here.
 */
export function NotificationsScreen() {
  const requests = useApi(() => api.employee.rides.incomingRequests(), []);
  const mine = useApi(() => api.employee.rides.mine(), []);

  const loading = requests.initialLoading || mine.initialLoading;
  const error = requests.error ?? mine.error;

  const pendingSeats = (mine.data?.riding ?? []).filter((ride) => ride.viewer.requestStatus === 'pending');
  const confirmedSeats = (mine.data?.riding ?? []).filter((ride) => ride.viewer.requestStatus === 'accepted');

  const empty =
    (requests.data?.length ?? 0) === 0 && pendingSeats.length === 0 && confirmedSeats.length === 0;

  return (
    <Screen>
      <PageTitle title="Activity" lead="Requests waiting on you, and the state of your own seats." />

      {loading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <ErrorState
          message={error.message}
          onRetry={() => {
            requests.reload();
            mine.reload();
          }}
        />
      ) : empty ? (
        <EmptyState title="Nothing new" text="Seat requests and confirmations will show up here." />
      ) : (
        <>
          {(requests.data ?? []).map((request) => (
            <Card key={request.id}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subtitle}>{request.passenger.name} asked for a seat</Text>
                  <Text style={styles.caption}>
                    {request.seats} seat{request.seats === 1 ? '' : 's'} · {formatRelative(request.createdAt)}
                  </Text>
                </View>
                <Badge tone="warning">Action needed</Badge>
              </View>
            </Card>
          ))}

          {confirmedSeats.map((ride) => (
            <Card key={ride.id}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subtitle}>Seat confirmed</Text>
                  <Text style={styles.caption} numberOfLines={2}>
                    {ride.startLocation} → {ride.destination}
                  </Text>
                </View>
                <Badge tone="success">Confirmed</Badge>
              </View>
              <Divider />
              <Text style={styles.caption}>Departs {formatDateTime(ride.departureAt)}</Text>
            </Card>
          ))}

          {pendingSeats.map((ride) => (
            <Card key={ride.id}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subtitle}>Waiting on {ride.driver.name}</Text>
                  <Text style={styles.caption} numberOfLines={2}>
                    {ride.startLocation} → {ride.destination}
                  </Text>
                </View>
                <Badge tone="warning">Pending</Badge>
              </View>
              <Divider />
              <Text style={[styles.caption, { marginTop: -space[2] }]}>
                Departs {formatDateTime(ride.departureAt)}
              </Text>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
