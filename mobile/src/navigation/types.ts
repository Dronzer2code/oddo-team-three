export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ProfileSetup: undefined;
  Tabs: undefined;
  RideDetail: { rideId: string };
  PublishRide: undefined;
  ActiveTrip: { tripId: string };
  Vehicles: undefined;
  Wallet: undefined;
  Notifications: undefined;
};

export type TabParamList = {
  Home: undefined;
  FindRide: undefined;
  MyRides: undefined;
  Trips: undefined;
  Profile: undefined;
};
