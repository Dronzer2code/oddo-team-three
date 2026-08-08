import { Pressable, Text, View } from 'react-native';
import {
  RIDE_STATUS_LABEL,
  VEHICLE_TYPE_LABEL,
  formatDate,
  formatDistance,
  formatMoney,
  formatTime,
  type Ride,
} from '@carpool/shared';
import { Badge, Card, Divider, Seats, styles } from './ui';
import { colors, space } from '../theme/tokens';

const STATUS_TONE = {
  published: 'accent',
  full: 'neutral',
  in_progress: 'ink',
  completed: 'success',
  canceled: 'danger',
} as const;

export function RideCard({ ride, onPress }: { ride: Ride; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.title}>{formatTime(ride.departureAt)}</Text>
            <Text style={styles.caption}>{formatDate(ride.departureAt)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: space[1] }}>
            <Badge tone={STATUS_TONE[ride.status]}>{RIDE_STATUS_LABEL[ride.status]}</Badge>
            {ride.viewer.isDriver ? <Badge tone="ink">You are driving</Badge> : null}
            {ride.viewer.requestStatus === 'accepted' ? <Badge tone="success">Seat confirmed</Badge> : null}
            {ride.viewer.requestStatus === 'pending' ? <Badge tone="warning">Pending</Badge> : null}
          </View>
        </View>

        <Divider />

        <Text style={styles.subtitle} numberOfLines={2}>
          {ride.startLocation} → {ride.destination}
        </Text>

        <View style={[styles.wrap, { marginTop: space[3] }]}>
          <Text style={styles.caption}>{formatDistance(ride.estimatedDistanceKm)}</Text>
          <Text style={styles.caption}>
            {ride.seatsAvailable} of {ride.totalSeats} free
          </Text>
          <Seats total={ride.totalSeats} taken={ride.seatsTaken} />
          <Text style={styles.caption}>
            {ride.vehicle.make} {ride.vehicle.model} · {VEHICLE_TYPE_LABEL[ride.vehicle.vehicleType]}
          </Text>
        </View>

        <View style={[styles.rowBetween, { marginTop: space[4], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space[3] }]}>
          <Text style={styles.caption}>
            {ride.viewer.isDriver ? 'You' : ride.driver.name}
            {ride.driver.department ? ` · ${ride.driver.department}` : ''}
          </Text>
          <Text style={[styles.subtitle]}>
            {formatMoney(ride.costPerSeat, ride.currency)}
            <Text style={styles.caption}> per seat</Text>
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
