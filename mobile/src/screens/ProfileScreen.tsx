import { Pressable, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { ACCOUNT_STATUS_LABEL, formatDate } from '@carpool/shared';
import { Badge, Button, Card, Divider, ErrorState, Screen, SkeletonList, styles } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { colors, space } from '../theme/tokens';
import { api } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../store/auth';
import type { TabParamList } from '../navigation/types';

type Props = BottomTabScreenProps<TabParamList, 'Profile'>;

const STATUS_TONE = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
  deactivated: 'neutral',
} as const;

function Row({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.rowBetween, { paddingVertical: space[4] }]}>
      <View style={styles.row}>
        <Icon name={icon} size={19} color={colors.fgSecondary} />
        <Text style={styles.body}>{label}</Text>
      </View>
      <Icon name="chevronRight" size={17} color={colors.fgMuted} />
    </Pressable>
  );
}

export function ProfileScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const profile = useApi(() => api.employee.profile.get(), []);
  const open = navigation.getParent();

  return (
    <Screen>
      {profile.initialLoading ? (
        <SkeletonList rows={2} />
      ) : profile.error ? (
        <ErrorState message={profile.error.message} onRetry={profile.reload} />
      ) : profile.data ? (
        <Card>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heading}>{profile.data.name}</Text>
              <Text style={styles.caption}>{profile.data.email}</Text>
            </View>
            <Badge tone={STATUS_TONE[profile.data.status]}>{ACCOUNT_STATUS_LABEL[profile.data.status]}</Badge>
          </View>

          <Divider />

          <View style={{ gap: space[3] }}>
            <View style={styles.rowBetween}>
              <Text style={styles.caption}>Organisation</Text>
              <Text style={styles.body}>{profile.data.organizationName}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.caption}>Department</Text>
              <Text style={styles.body}>{profile.data.department ?? '—'}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.caption}>Phone</Text>
              <Text style={styles.body}>{profile.data.phone ?? '—'}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.caption}>Usual route</Text>
              <Text style={styles.body} numberOfLines={1}>
                {profile.data.homeLocation && profile.data.workLocation
                  ? `${profile.data.homeLocation} → ${profile.data.workLocation}`
                  : '—'}
              </Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.caption}>Joined</Text>
              <Text style={styles.body}>{formatDate(profile.data.createdAt)}</Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Card style={{ paddingVertical: space[1] }}>
        <Row icon="car" label="My vehicles" onPress={() => open?.navigate('Vehicles')} />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Row icon="wallet" label="Payments" onPress={() => open?.navigate('Wallet')} />
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Row icon="bell" label="Notifications" onPress={() => open?.navigate('Notifications')} />
      </Card>

      <Button title="Sign out" variant="secondary" onPress={signOut} />

      <Text style={[styles.caption, { textAlign: 'center', marginTop: space[4] }]}>
        ridesync · demo environment{user ? ` · ${user.organizationName}` : ''}
      </Text>
    </Screen>
  );
}
