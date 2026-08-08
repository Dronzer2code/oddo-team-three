import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { colors, type as typeScale } from '../theme/tokens';
import { Icon, type IconName } from '../components/Icon';
import { useAuth } from '../store/auth';
import type { RootStackParamList, TabParamList } from './types';

import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { FindRideScreen } from '../screens/FindRideScreen';
import { MyRidesScreen } from '../screens/MyRidesScreen';
import { TripsScreen } from '../screens/TripsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RideDetailScreen } from '../screens/RideDetailScreen';
import { PublishRideScreen } from '../screens/PublishRideScreen';
import { ActiveTripScreen } from '../screens/ActiveTripScreen';
import { VehiclesScreen } from '../screens/VehiclesScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const navTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.forest,
    background: colors.bg,
    card: colors.surface,
    text: colors.fg,
    border: colors.border,
    notification: colors.forest,
  },
};

const TAB_ICON: Record<keyof TabParamList, IconName> = {
  Home: 'home',
  FindRide: 'search',
  MyRides: 'car',
  Trips: 'route',
  Profile: 'user',
};

const TAB_LABEL: Record<keyof TabParamList, string> = {
  Home: 'Home',
  FindRide: 'Find ride',
  MyRides: 'My rides',
  Trips: 'Trips',
  Profile: 'Profile',
};

/** Home | Find ride | My rides | Trips | Profile — the brief's tab set. */
function TabNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { ...typeScale.subtitle, color: colors.fg },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: colors.fgMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62 },
        tabBarLabelStyle: { ...typeScale.label, textTransform: 'none', letterSpacing: 0 },
        tabBarLabel: TAB_LABEL[route.name],
        tabBarIcon: ({ color }) => <Icon name={TAB_ICON[route.name]} size={21} color={color} />,
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Tabs.Screen name="FindRide" component={FindRideScreen} options={{ title: 'Find a ride' }} />
      <Tabs.Screen name="MyRides" component={MyRidesScreen} options={{ title: 'My rides' }} />
      <Tabs.Screen name="Trips" component={TripsScreen} options={{ title: 'Trips' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile and settings' }} />
    </Tabs.Navigator>
  );
}

/**
 * Which stack is mounted depends on the session, and — once signed in — on
 * whether the profile is complete. The same rule the web app applies, so an
 * employee cannot skip onboarding by starting on the phone.
 */
export function Navigation() {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.forest} />
      </View>
    );
  }

  const needsProfile = Boolean(user && !user.profileComplete);

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { ...typeScale.subtitle, color: colors.fg },
          headerTintColor: colors.forest,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Join your organisation' }} />
          </>
        ) : needsProfile ? (
          <Stack.Screen
            name="ProfileSetup"
            component={ProfileSetupScreen}
            options={{ title: 'Complete your profile' }}
          />
        ) : (
          <>
            <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="RideDetail" component={RideDetailScreen} options={{ title: 'Ride' }} />
            <Stack.Screen name="PublishRide" component={PublishRideScreen} options={{ title: 'Publish a ride' }} />
            <Stack.Screen name="ActiveTrip" component={ActiveTripScreen} options={{ title: 'Active trip' }} />
            <Stack.Screen name="Vehicles" component={VehiclesScreen} options={{ title: 'My vehicles' }} />
            <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Payments' }} />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: 'Notifications' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
