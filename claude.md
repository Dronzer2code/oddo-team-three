# Carpool Management Platform
## CLAUDE.md — Implementation Contract

You are a senior full-stack engineer working on an organization-based carpool platform with three separate experiences:

1. Passenger Panel
2. Driver Panel
3. Admin Panel

The platform must use real backend data. Remove production mock cards, fake metrics, static maps, fake wallet values, and disconnected forms.

> The most important requirement: after every successful create, update, approval, booking, cancellation, or trip action, all affected tabs must update immediately without a browser refresh.

---

## 1. Core Product Flow

```text
Passenger:
Search ride → View map → Request seat → Get approval → Track trip → View history

Driver:
Register vehicle → Wait for approval → Publish ride → Approve passengers → Start trip → Complete trip

Admin:
Manage organization → Approve employees → Approve vehicles → Monitor rides → Review trips → Configure costs → View reports
```

All panels must use the same backend, database, authentication, organization scope, and business rules.

Do not create separate fake data sources for each dashboard.

---

## 2. Strict Separation of Responsibilities

### Passenger can

- Search available rides.
- View rides on a map.
- View allowed driver and vehicle information.
- Request seats.
- Cancel a booking when allowed.
- View confirmed bookings.
- View upcoming and active trips.
- View driver last-known location when available.
- View trip history and trip costs.
- Manage their own profile.

### Driver can

- Complete a driver profile.
- Register a vehicle.
- Submit a vehicle for approval.
- View approval status.
- Publish rides after vehicle approval.
- Edit or cancel future rides.
- View passenger requests.
- Accept or reject requests.
- Start and complete trips.
- View driver history.

### Admin can

- Manage organization settings.
- Approve, reject, suspend, and reactivate employees.
- Approve, reject, deactivate, and review vehicles.
- View derived drivers.
- Monitor rides, bookings, and active trips.
- Configure travel costs.
- View reports and audit logs.

The admin must not book rides or publish rides for employees in the MVP.

---

## 3. Route Structure

### Passenger

```text
/passenger/home
/passenger/rides
/passenger/rides/:id
/passenger/bookings
/passenger/bookings/:id
/passenger/live-trip
/passenger/history
/passenger/wallet
/passenger/notifications
/passenger/profile
/passenger/help
```

### Driver

```text
/driver/home
/driver/vehicle
/driver/vehicle/register
/driver/vehicle/:id
/driver/rides
/driver/rides/new
/driver/rides/:id
/driver/rides/:id/requests
/driver/active-trip
/driver/history
/driver/notifications
/driver/profile
```

### Admin

```text
/admin/dashboard
/admin/employees
/admin/employees/:id
/admin/employee-approvals
/admin/vehicles
/admin/vehicles/:id
/admin/vehicle-approvals
/admin/drivers
/admin/rides
/admin/rides/:id
/admin/ride-requests
/admin/active-trips
/admin/completed-trips
/admin/organization
/admin/costs
/admin/participation
/admin/reports
/admin/notifications
/admin/audit-logs
/admin/settings
```

Protect routes on both frontend and backend. Never rely only on hiding navigation items.

---

## 4. Authentication and Context

After login, call:

```http
GET /api/auth/me
```

Expected response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "organizationId": "org_001",
      "name": "Rahul Roy",
      "email": "rahul@example.com",
      "role": "EMPLOYEE",
      "accountStatus": "ACTIVE"
    },
    "availableContexts": ["PASSENGER", "DRIVER"],
    "defaultContext": "PASSENGER"
  }
}
```

Use:

```ts
type SystemRole = "ADMIN" | "EMPLOYEE";
type DashboardContext = "ADMIN" | "PASSENGER" | "DRIVER";
type AccountStatus =
  | "PENDING"
  | "ACTIVE"
  | "SUSPENDED"
  | "DEACTIVATED"
  | "REJECTED";
```

Driver is not a separate account. An employee receives the DRIVER context only when they have an approved active vehicle.

```text
ADMIN → Admin panel
ACTIVE employee without vehicle → Passenger panel
ACTIVE employee with approved active vehicle → Passenger + Driver panels
SUSPENDED employee → Restricted account screen
DEACTIVATED employee → Access denied
```

---

## 5. No Production Mock Data

Remove or disable all hardcoded:

- Ride cards.
- Driver names.
- Passenger names.
- Vehicle numbers.
- Costs.
- Dashboard metrics.
- Wallet balances.
- Trip history.
- Map coordinates.
- Notifications.
- Approval records.
- Charts.

Mock data may be used only behind an explicit development/demo flag and should preferably be inserted into the database using seed scripts.

Never render production data like this:

```ts
const rides = [
  { driver: "Arjun", vehicle: "Honda City", cost: 37 }
];
```

Every important screen must use:

```text
Database → API → Query/state → UI
```

---

## 6. Immediate Data Updates

Every mutation must follow:

```text
User clicks action
→ Validate form
→ Show loading state
→ Call API
→ Backend validates and persists
→ Return updated record
→ Update or invalidate affected queries
→ Refresh related tabs
→ Show success notification
```

Never show success before the API succeeds.

### After passenger requests a seat

Refresh:

```text
Passenger Home
Passenger Find Ride
Passenger My Bookings
Ride details
Available seat count
Driver pending requests
Admin metrics
```

### After driver publishes a ride

Refresh:

```text
Driver My Rides
Driver Dashboard
Passenger Find Ride
Admin Rides
Admin Dashboard
```

### After driver accepts a request

Refresh:

```text
Passenger My Bookings
Passenger Home
Driver Requests
Available seats
Notifications
Admin booking metrics
```

### After a trip is completed

Refresh:

```text
Passenger History
Driver History
Admin Completed Trips
Admin Reports
Cost summaries
Dashboard metrics
```

### After admin approves a vehicle

Refresh:

```text
Driver Vehicle page
Driver Dashboard
Driver context availability
Publish Ride form
Admin Vehicle list
Pending approval counts
```

Use TanStack Query or an equivalent centralized data layer. Recommended query keys:

```ts
["passenger", "dashboard"]
["passenger", "rides", filters]
["passenger", "bookings"]
["passenger", "active-trip"]
["driver", "dashboard"]
["driver", "vehicles"]
["driver", "rides"]
["driver", "ride-requests"]
["admin", "dashboard"]
["admin", "employees"]
["admin", "vehicles"]
["admin", "rides"]
["admin", "reports"]
```

Do not solve synchronization with scattered `window.location.reload()` calls.

---

## 7. Passenger Panel

### Navigation

```text
Home
Find a Ride
My Bookings
Wallet / Trip Costs
Profile
```

Optional pages:

```text
Live Trip
History
Notifications
Help & Safety
```

### Passenger Home

Show:

- Welcome message.
- Find a Ride button.
- Upcoming booking.
- Active trip.
- Recent activity.
- Suggested rides.
- Booking summary.

Do not show:

```text
You are driving
Published ride
My vehicle
Manage passenger requests
Driver earnings
Vehicle registration
```

API:

```http
GET /api/passenger/dashboard
```

Passenger booking card:

```text
Park Street Office → Salt Lake Sector V
12 August 2026, 18:30
Driver: Arjun Das
Vehicle: Hyundai i20
Seats booked: 1
Estimated cost: ₹37
Status: Confirmed
[View Booking] [Cancel Booking]
```

### Find a Ride

Search fields:

```text
Pickup location
Destination
Date
Departure time
Number of seats
Maximum estimated cost
```

Buttons:

```text
[Use current location]
[Search rides]
[Clear filters]
```

APIs:

```http
GET /api/passenger/rides
GET /api/passenger/rides/:id
```

Only return rides that are:

```text
In the passenger's organization
PUBLISHED
In the future
Using an ACTIVE vehicle
Owned by an ACTIVE driver
Not full
```

### Request Seat Modal

Fields:

```text
Ride route
Departure time
Driver
Vehicle
Available seats
Number of seats
Estimated total cost
Optional note
```

Buttons:

```text
[Cancel]
[Confirm Request]
```

API:

```http
POST /api/passenger/rides/:rideId/request
```

On submit:

1. Disable the button.
2. Show a loading state.
3. Call the API.
4. Display backend errors.
5. Show success only after success.
6. Close the modal.
7. Refresh dashboard, bookings, ride details, and seat count.
8. Notify the driver.

Reject duplicate requests, full rides, canceled rides, completed rides, invalid seat counts, and suspended accounts.

### My Bookings

Filters:

```text
All
Pending
Confirmed
Rejected
Canceled
Completed
```

APIs:

```http
GET /api/passenger/bookings
GET /api/passenger/bookings/:id
PATCH /api/passenger/bookings/:id/cancel
```

Bookings must be filtered server-side by:

```text
passengerId = authenticatedUser.id
```

### Live Trip

Show:

- Map.
- Pickup marker.
- Destination marker.
- Driver location or last-known location.
- Route.
- Estimated arrival.
- Distance remaining.
- Driver and vehicle details.
- Trip status.

Statuses:

```text
CONFIRMED
DRIVER_APPROACHING
DRIVER_ARRIVED
STARTED
COMPLETED
CANCELED
```

Do not show fake moving GPS markers. If GPS is unavailable, show the last known location and timestamp.

### Wallet

Use the Wallet tab only if payment data exists. Otherwise rename it to `Trip Costs`.

Show only:

- Total completed trip cost.
- Current period cost.
- Pending cost.
- Transaction history.

APIs:

```http
GET /api/passenger/wallet
GET /api/passenger/wallet/transactions
```

Never show fake balances.

---

## 8. Driver Panel

### Navigation

```text
Home
My Vehicle
Publish Ride
My Rides
Requests
Active Trip
Trip History
Profile
```

### Register Vehicle

Route:

```text
/driver/vehicle/register
```

Fields:

```text
Vehicle model
Vehicle type
Registration number
Vehicle color
Seating capacity
Manufacturing year, optional
Vehicle document, optional
```

Buttons:

```text
[Cancel]
[Save as Draft]
[Submit for Approval]
```

API:

```http
POST /api/driver/vehicles
```

New vehicles start with:

```text
PENDING
```

After submission:

```text
Driver sees pending status
Admin sees a vehicle approval task
Admin pending count increases immediately
```

### Driver Vehicle Page

Show:

- Model.
- Registration number.
- Type.
- Color.
- Capacity.
- Approval status.
- Vehicle status.
- Published ride count.
- Completed trip count.

Actions:

```text
[Edit Vehicle]
[Submit Documents]
[Deactivate Vehicle]
```

Only an approved active vehicle may be used for new rides.

### Publish Ride

Route:

```text
/driver/rides/new
```

Fields:

```text
Pickup location
Destination
Date
Departure time
Available seats
Vehicle
Estimated distance
Estimated cost
Optional notes
```

Map:

- Pickup marker.
- Destination marker.
- Route preview.
- Distance.
- Estimated duration.

Buttons:

```text
[Cancel]
[Save Draft]
[Publish Ride]
```

API:

```http
POST /api/driver/rides
```

Validate:

- Driver is authenticated and active.
- Vehicle belongs to the driver.
- Vehicle is approved and active.
- Departure is in the future.
- Seats do not exceed capacity.
- Route is valid.
- Organization comes from the session.
- Cost uses the active cost configuration.

After success, the ride must appear immediately in:

```text
Driver My Rides
Driver Dashboard
Passenger Find a Ride
Admin Rides
Admin Dashboard
```

### Driver My Rides

Driver card:

```text
You are driving
Park Street Office → Salt Lake Sector V
12 August 2026, 18:30
Honda City · WB 06 AK 4412
Available seats: 2 of 2
Status: Published
[View Ride] [Manage Requests] [Edit Ride] [Cancel Ride]
```

This card must never appear in the Passenger Panel.

### Requests

Request card:

```text
Passenger: Rahul Roy
Employee ID: EMP-102
Seats requested: 1
Status: Pending
[Accept] [Reject] [View Passenger]
```

APIs:

```http
GET /api/driver/rides/:rideId/requests
PATCH /api/driver/requests/:requestId
```

After accepting or rejecting, refresh driver requests, passenger bookings, seat count, notifications, and admin metrics.

### Start and Complete Trip

```http
POST /api/driver/trips/:tripId/start
POST /api/driver/trips/:tripId/complete
```

Completed trips must store vehicle snapshot, actual distance, fuel, cost, cost per kilometer, start time, and completion time.

---

## 9. Admin Panel

### Navigation

```text
Dashboard
Employees
Employee Approvals
Vehicles
Vehicle Approvals
Drivers
Rides
Ride Requests
Active Trips
Completed Trips
Organization
Costs
Participation
Reports
Notifications
Audit Logs
Settings
```

### Admin Dashboard

API:

```http
GET /api/admin/dashboard
```

Show real values for:

```text
Total employees
Active employees
Pending employee approvals
Registered vehicles
Pending vehicle approvals
Active drivers
Published rides
Active trips
Completed trips
Participation rate
Total distance
Estimated fuel
Estimated cost
Pending actions
Recent activity
```

No hardcoded values.

### Employee Approvals

Admin can:

- Review employee registration.
- Approve employee.
- Reject employee.
- Request more information.
- Suspend employee.
- Reactivate employee.
- Deactivate employee.

APIs:

```http
GET  /api/admin/employee-approvals
POST /api/admin/employee-approvals/:id/approve
POST /api/admin/employee-approvals/:id/reject
PATCH /api/admin/employees/:id/status
```

### Vehicle Approvals

Vehicle approval card:

```text
Employee: Rahul Roy
Vehicle: Honda City
Registration: WB 06 AK 4412
Capacity: 4
Status: Pending
[View Details] [Approve] [Reject] [Request Documents]
```

APIs:

```http
GET  /api/admin/vehicle-approvals
POST /api/admin/vehicle-approvals/:id/approve
POST /api/admin/vehicle-approvals/:id/reject
PATCH /api/admin/vehicles/:id/status
```

After approval:

```text
Vehicle becomes ACTIVE
Driver can publish rides
Driver dashboard updates
Publish Ride becomes enabled
Admin pending count decreases
```

### Admin Rides

Admin can:

- View all rides.
- Filter by driver, vehicle, date, and status.
- Approve or reject rides if required.
- Cancel unsafe rides.
- View passengers.
- View route and trip history.

### Admin Reports

Reports:

```text
Total rides
Completed trips
Canceled rides
Distance traveled
Fuel consumption
Total cost
Cost per kilometer
Vehicle utilization
Driver activity
Participation rate
Department activity
```

Filters:

```text
Date range
Driver
Vehicle
Department
Ride status
Trip status
```

### Admin Audit Logs

Record:

```text
Employee approval/rejection
Employee activation/suspension
Vehicle approval/rejection
Vehicle status changes
Ride approval/rejection/cancellation
Cost configuration changes
Organization setting changes
Report exports
Admin login/logout
Permission failures
```

Fields:

```ts
{
  id: string;
  organizationId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValues?: object;
  newValues?: object;
  reason?: string;
  createdAt: string;
}
```

---

## 10. Core APIs

### Passenger

```http
GET    /api/passenger/dashboard
GET    /api/passenger/rides
GET    /api/passenger/rides/:id
POST   /api/passenger/rides/:id/request
GET    /api/passenger/bookings
GET    /api/passenger/bookings/:id
PATCH  /api/passenger/bookings/:id/cancel
GET    /api/passenger/active-trip
GET    /api/passenger/trips
GET    /api/passenger/trips/:id
GET    /api/passenger/trips/:id/location
GET    /api/passenger/wallet
GET    /api/passenger/wallet/transactions
GET    /api/passenger/notifications
GET    /api/passenger/profile
PATCH  /api/passenger/profile
```

### Driver

```http
GET    /api/driver/dashboard
GET    /api/driver/vehicles
POST   /api/driver/vehicles
PATCH  /api/driver/vehicles/:id
GET    /api/driver/rides
POST   /api/driver/rides
GET    /api/driver/rides/:id
PATCH  /api/driver/rides/:id
DELETE /api/driver/rides/:id
GET    /api/driver/rides/:id/requests
PATCH  /api/driver/requests/:id
POST   /api/driver/trips/:id/start
POST   /api/driver/trips/:id/complete
```

### Admin

```http
GET    /api/admin/dashboard
GET    /api/admin/employees
PATCH  /api/admin/employees/:id/status
GET    /api/admin/employee-approvals
POST   /api/admin/employee-approvals/:id/approve
POST   /api/admin/employee-approvals/:id/reject
GET    /api/admin/vehicles
PATCH  /api/admin/vehicles/:id/status
GET    /api/admin/vehicle-approvals
POST   /api/admin/vehicle-approvals/:id/approve
POST   /api/admin/vehicle-approvals/:id/reject
GET    /api/admin/drivers
GET    /api/admin/rides
POST   /api/admin/rides/:id/approve
POST   /api/admin/rides/:id/reject
POST   /api/admin/rides/:id/cancel
GET    /api/admin/active-trips
GET    /api/admin/completed-trips
GET    /api/admin/organization
PATCH  /api/admin/organization
GET    /api/admin/costs
POST   /api/admin/costs
GET    /api/admin/reports
GET    /api/admin/audit-logs
```

---

## 11. Data Models

Every organization-owned record must include `organizationId`.

### User

```ts
interface User {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone?: string;
  employeeId?: string;
  department?: string;
  role: "ADMIN" | "EMPLOYEE";
  accountStatus: AccountStatus;
  createdAt: string;
  updatedAt: string;
}
```

### Vehicle

```ts
interface Vehicle {
  id: string;
  organizationId: string;
  ownerId: string;
  model: string;
  vehicleType: string;
  registrationNumber: string;
  color?: string;
  seatingCapacity: number;
  status: "PENDING" | "ACTIVE" | "INACTIVE" | "UNDER_REVIEW" | "REJECTED" | "SUSPENDED";
  createdAt: string;
  updatedAt: string;
}
```

### Ride

```ts
interface Ride {
  id: string;
  organizationId: string;
  driverId: string;
  vehicleId: string;
  pickup: {
    address: string;
    latitude?: number;
    longitude?: number;
  };
  destination: {
    address: string;
    latitude?: number;
    longitude?: number;
  };
  departureTime: string;
  totalSeats: number;
  availableSeats: number;
  estimatedDistanceKm?: number;
  estimatedCost?: number;
  status: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "FULL" | "STARTED" | "COMPLETED" | "CANCELED" | "REJECTED";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Booking

```ts
interface Booking {
  id: string;
  organizationId: string;
  rideId: string;
  passengerId: string;
  requestedSeats: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED" | "COMPLETED";
  estimatedCost?: number;
  createdAt: string;
  updatedAt: string;
}
```

### Trip

```ts
interface Trip {
  id: string;
  organizationId: string;
  rideId: string;
  driverId: string;
  passengerIds: string[];
  vehicleSnapshot: {
    model: string;
    registrationNumber: string;
    seatingCapacity: number;
  };
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELED";
  actualDistanceKm?: number;
  fuelConsumedLiters?: number;
  totalCost?: number;
  costPerKm?: number;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}
```

---

## 12. API Response Format

Success:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The selected vehicle is not active"
  }
}
```

Use consistent error codes:

```text
UNAUTHENTICATED
FORBIDDEN
ORGANIZATION_MISMATCH
RESOURCE_NOT_FOUND
VALIDATION_ERROR
DUPLICATE_REQUEST
VEHICLE_NOT_ACTIVE
RIDE_FULL
INVALID_STATUS_TRANSITION
ACCOUNT_SUSPENDED
```

---

## 13. Authorization

Every protected request must:

```text
1. Authenticate the user.
2. Resolve the organization from the session.
3. Resolve role and context.
4. Verify account status.
5. Verify target organization.
6. Verify ownership where required.
7. Validate input.
8. Execute business logic.
9. Create audit log when required.
10. Return the updated record.
```

Never trust these values from the browser for authorization:

```text
organizationId
userId
driverId
passengerId
```

Resolve them from the authenticated session or trusted backend context.

---

## 14. Component Separation

Create separate components:

```text
PassengerBookingCard
AvailableRideCard
DriverRideCard
AdminRideRow
VehicleApprovalCard
PassengerTripCard
DriverTripCard
AdminTripRow
```

### Passenger card must show

```text
Driver
Vehicle
Pickup
Destination
Departure
Booking status
Requested seats
Cost
View details
Cancel booking
```

### Driver card must show

```text
You are driving
Vehicle
Published status
Available seats
Passenger requests
Edit ride
Cancel ride
Start trip
```

### Admin row must show

```text
Driver
Vehicle
Ride status
Passenger count
Organization
Created date
Admin actions
```

Never render `DriverRideCard` in the passenger application.

---

## 15. Required Modals

### Passenger

```text
Request Seat
Cancel Booking
Ride Details
Report Problem
```

### Driver

```text
Register Vehicle
Submit Vehicle
Publish Ride
Edit Ride
Accept Request
Reject Request
Cancel Ride
Start Trip
Complete Trip
```

### Admin

```text
Approve Employee
Reject Employee
Suspend Employee
Approve Vehicle
Reject Vehicle
Deactivate Vehicle
Approve Ride
Reject Ride
Cancel Ride
Change Cost Configuration
```

Every modal must:

- Validate input.
- Disable duplicate submission.
- Show a loading state.
- Display backend errors.
- Close only after success.
- Refresh affected queries.
- Show a success or error toast.

---

## 16. Required Testing

### Passenger

```text
Passenger logs in
→ Home has no driver cards
→ Searches for ride
→ Results come from API
→ Opens ride details
→ Sees route map
→ Requests seat
→ Booking is persisted
→ My Bookings updates without refresh
→ Driver accepts request
→ Passenger sees Confirmed status
→ Driver starts trip
→ Passenger sees Live Trip
→ Driver completes trip
→ Passenger sees trip history
```

### Driver

```text
Driver logs in
→ Registers vehicle
→ Vehicle shows Pending
→ Admin sees approval task
→ Admin approves vehicle
→ Driver sees Active vehicle
→ Publish Ride becomes available
→ Driver publishes ride
→ Ride appears in My Rides
→ Ride appears in passenger search
→ Passenger requests seat
→ Driver sees request
→ Driver accepts request
→ Passenger booking updates
→ Driver starts and completes trip
```

### Admin

```text
Admin logs in
→ Dashboard loads real API values
→ Approves employee
→ Approves vehicle
→ Views driver
→ Views published ride
→ Views booking request
→ Monitors active trip
→ Reviews completed trip
→ Views updated reports
→ Reviews audit logs
```

---

## 17. Definition of Done

The platform is complete only when:

- Passenger, Driver, and Admin panels are separate.
- Each panel has separate navigation and data queries.
- Passenger pages never show driver-owned cards.
- Driver pages never show admin controls.
- Admin pages never show passenger booking actions.
- Vehicle registration uses a real API.
- Vehicle approval uses a real API.
- Ride publishing uses a real API.
- Booking uses a real API.
- Driver request approval uses a real API.
- Trip start and completion use real APIs.
- Wallet or trip costs use persisted data.
- Maps use real coordinates or clearly show unavailable state.
- No production mock data remains.
- Mutations update all affected tabs immediately.
- Loading, empty, error, and retry states work.
- Duplicate actions are prevented.
- Organization isolation is enforced.
- Audit logs are created.
- Historical trip information is preserved.
- All three end-to-end workflows work with database records.

Do not mark a feature complete because a page or button exists. A feature is complete only when:

```text
UI → API → Authorization → Database → API response → Updated UI
```

works correctly.

---

## 18. Implementation Order

Implement in this exact order:

```text
Phase 1: Inspect repository, routes, APIs, database, and existing mock data.

Phase 2: Fix authentication, roles, account status, and organization scope.

Phase 3: Remove incorrect shared cards and separate Passenger components.

Phase 4: Complete Passenger Home, Find Ride, My Bookings, and Trip Costs.

Phase 5: Fix booking API, booking modal, cancellation, and immediate refresh.

Phase 6: Implement vehicle registration and Driver Panel.

Phase 7: Implement Admin approvals and Admin Panel.

Phase 8: Add query invalidation, polling, notifications, and live trip state.

Phase 9: Add reports, audit logs, and historical cost protection.

Phase 10: Run the complete Passenger, Driver, and Admin test workflows.
```

Do not start with visual redesign while the data flow is broken. First fix:

```text
Database → API → Frontend query → UI
```

Then improve styling and animations.
