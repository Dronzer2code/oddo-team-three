# Carpool Management Platform
## Detailed Build Instruction Prompt

You are a senior full-stack architect and implementation engineer. Build a production-quality MVP for an organization-based carpool management platform for an Odoo hackathon.

The platform must support four connected applications:

1. Admin Panel
2. Employee Web Application
3. Public Marketing Website
4. React Native Mobile Application

The system must use a shared backend and a consistent authorization model. If Odoo is being used as the primary business platform, Odoo should remain the source of truth for organization, employee, vehicle, ride, trip, cost, payment, and audit data. The frontend applications must never directly modify database records.

---

## 1. Product Objective

Build a carpool platform that allows employees within an organization to share rides and allows company administrators to manage organization-level data, configuration, participation, and analytics.

The product must clearly separate operational and administrative responsibilities:

```text
Employee Web and Mobile Applications
    = Daily carpool operations

Admin Panel
    = Organization management, configuration, monitoring, and reporting

Public Website
    = Product discovery and access entry

Backend or Odoo Layer
    = Authentication, authorization, business logic, data, and audit history
```

Do not turn the Admin Panel into a second employee application.

---

## 2. Core Product Rules

Follow these rules throughout the implementation:

- Every organization-owned record must contain an organization reference.
- A company administrator can access only their own organization.
- Employees can access only their own private data and the organization data required for carpooling.
- Authorization must be enforced on the backend, not only in the user interface.
- An employee can act as both a driver and a passenger.
- Driver must not be implemented as a separate account type for the MVP.
- Suspended or deactivated employees must not publish or request rides.
- Inactive vehicles must not be selectable for new rides.
- Historical trips must preserve the vehicle and cost information used at the time of the trip.
- Do not hard-delete records that are referenced by historical rides, trips, payments, or reports.
- Configuration changes must be versioned using effective dates.
- All important administrative changes must produce audit logs.
- The frontend must communicate through backend APIs or controlled Odoo endpoints.
- Do not expose sensitive employee, payment, or organization data unnecessarily.

---

## 3. Recommended Repository Structure

Use a monorepo structure where practical:

```text
carpool-platform/
│
├── admin/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── dashboard/
│   │   ├── employees/
│   │   ├── vehicles/
│   │   ├── drivers/
│   │   ├── organization/
│   │   ├── costs/
│   │   ├── participation/
│   │   ├── reports/
│   │   └── audit-logs/
│   ├── lib/
│   └── types/
│
├── employee-web/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── onboarding/
│   │   ├── rides/
│   │   ├── trips/
│   │   ├── vehicles/
│   │   ├── wallet/
│   │   └── profile/
│   ├── lib/
│   └── types/
│
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   ├── navigation/
│   │   ├── components/
│   │   ├── features/
│   │   ├── services/
│   │   ├── store/
│   │   └── types/
│   └── app.json
│
├── web/
│   ├── app/
│   ├── components/
│   ├── sections/
│   ├── pages/
│   └── lib/
│
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── organizations/
│   │   │   ├── employees/
│   │   │   ├── vehicles/
│   │   │   ├── rides/
│   │   │   ├── trips/
│   │   │   ├── payments/
│   │   │   ├── costs/
│   │   │   ├── reports/
│   │   │   └── audit-logs/
│   │   ├── middleware/
│   │   ├── database/
│   │   ├── jobs/
│   │   └── shared/
│   └── tests/
│
├── packages/
│   ├── api-client/
│   ├── types/
│   ├── validation/
│   └── constants/
│
└── README.md
```

If the existing repository uses a different structure, preserve the current conventions where possible. Do not reorganize the entire codebase without first inspecting it.

---

## 4. Technology Expectations

Use the technologies already selected by the project. Prefer the following where compatible:

- React or Next.js for the Admin Panel and web applications.
- React Native for the mobile application.
- TypeScript for frontend and backend code.
- Odoo models and APIs if Odoo is the required backend platform.
- PostgreSQL or the database already configured by the project.
- Shared validation schemas for client and server validation.
- A shared API client for all frontend applications.
- Responsive layouts for desktop, tablet, and mobile interfaces.

Do not introduce unnecessary dependencies. Before installing a package, check whether the current stack already provides the required functionality.

---

## 5. User Roles

### Company Administrator

A company administrator can:

- View the organization dashboard.
- View and manage organization employees.
- Activate, suspend, or reactivate employee access.
- Register and manage organization vehicles.
- Associate vehicles with employees.
- View driver information.
- Configure organization settings.
- Configure fuel and travel costs.
- View participation data.
- View reports and analytics.
- View administrative audit logs.

The administrator cannot book or publish rides for employees in the MVP.

### Employee

An employee can:

- Complete their profile.
- Register a vehicle if permitted.
- Publish rides as a driver.
- Search for available rides.
- Request a seat.
- Accept or reject requests for their rides.
- View upcoming rides.
- Manage active trips.
- View trip history.
- View permitted cost or payment information.

### System Administrator

Do not implement this role unless explicitly required. If implemented later, it must be separate from the company administrator and should support platform-level administration across organizations.

---

## 6. Authentication and Account Lifecycle

Implement secure authentication for all protected applications.

### Admin Authentication

```text
Admin Login
    |
    v
Authentication
    |
    v
Role Verification
    |
    v
Organization Verification
    |
    v
Admin Dashboard
```

### Employee Onboarding

Use an invitation or organization-controlled registration flow where possible:

```text
Invitation or Registration
    |
    v
Email or Phone Verification
    |
    v
Profile Completion
    |
    v
Organization Verification
    |
    v
Account Status Check
    |
    v
Employee Application
```

Use these account statuses:

```text
PENDING
ACTIVE
SUSPENDED
DEACTIVATED
```

The backend must reject protected employee actions for suspended or deactivated accounts.

---

## 7. Admin Panel Requirements

Create a professional organization-level Admin Panel with the following routes or equivalent screens:

```text
/admin/login
/admin/dashboard
/admin/employees
/admin/employees/:id
/admin/invitations
/admin/vehicles
/admin/vehicles/:id
/admin/drivers
/admin/organization
/admin/costs
/admin/participation
/admin/reports
/admin/audit-logs
/admin/settings
```

### Admin Layout

Implement:

- Protected admin layout.
- Desktop sidebar navigation.
- Responsive navigation for smaller screens.
- Organization name and logo.
- Admin profile menu.
- Logout action.
- Breadcrumbs where useful.
- Page title and contextual actions.
- Loading states.
- Empty states.
- Error states.
- Success and failure notifications.
- Confirmation dialogs for destructive or access-changing actions.

### Admin Dashboard

Show these metrics when data is available:

- Total employees.
- Active employees.
- Registered vehicles.
- Active participants.
- Total rides.
- Completed trips.
- Total distance travelled.
- Estimated fuel consumption.
- Estimated transportation cost.
- Participation trend.
- Recent administrative activity.

Use backend data. Do not hardcode important values.

Use separate API requests or optimized summary queries so that a slow report does not block the complete dashboard.

### Employee Management

Employee list features:

- Search by name, email, or employee ID.
- Filter by account status.
- Filter by participation status.
- Pagination.
- Sort by name, creation date, or activity date.
- Open employee details.
- Display current account status.

Employee detail features:

- Employee identity.
- Employee ID.
- Contact information required by the platform.
- Department, if available.
- Organization membership.
- Account status.
- Registered vehicles.
- Participation summary.
- Ride and trip summary.
- Account creation date.
- Last activity date.

Admin actions:

- Activate an employee.
- Suspend an employee.
- Reactivate an employee.
- Update permitted employee information.
- View employee-related audit history.

Do not permanently delete employees from normal administrative screens.

### Employee Invitations

If employee onboarding is organization-controlled, implement:

- Invite one employee.
- Import multiple employees if time allows.
- View pending invitations.
- Resend an invitation.
- Cancel an invitation.
- View invitation status.

### Vehicle Management

Vehicle list features:

- Search by model or registration number.
- Filter by status.
- Filter by associated driver.
- Pagination.
- Open vehicle details.

Vehicle details must include:

- Model.
- Registration number.
- Vehicle type.
- Seating capacity.
- Associated employee.
- Vehicle status.
- Number of published rides.
- Number of completed trips.
- Total distance.
- Creation date.

Use these statuses:

```text
ACTIVE
INACTIVE
UNDER_REVIEW
```

Vehicle registration numbers must be unique within the organization.

### Driver Management

Implement Drivers as a derived view of employees and vehicles.

Display:

- Employee name.
- Employee account status.
- Associated vehicle.
- Vehicle capacity.
- Published ride count.
- Completed trip count.
- Total distance.
- Participation status.

Do not create a separate driver account for the MVP.

### Organization Settings

Implement a focused settings screen containing:

- Organization name.
- Organization logo.
- Contact information.
- Service area or address.
- Time zone.
- Currency.
- Distance unit.
- Carpooling availability.
- Employee access policy, if required.
- Ride approval policy, if required.

Keep this module extensible but small. Do not create an overly complex generic settings system.

### Cost Configuration

Support configuration for:

- Fuel cost.
- Travel cost.
- Cost per kilometer.
- Currency.
- Fuel efficiency.
- Effective start date.
- Effective end date.
- Configuration status.

Configuration records must be versioned. Never overwrite historical values used in completed trips or reports.

### Participation Monitoring

Show:

- Total employees.
- Active participants.
- Participation rate.
- Employees who published rides.
- Employees who requested rides.
- Employees with completed trips.
- Weekly activity.
- Monthly activity.
- Participation trend.

Use this definition unless the product team specifies another one:

```text
Active participant = An employee who published, requested, or completed a ride during the selected period.
```

### Reports and Analytics

Implement reports for:

- Total rides.
- Completed trips.
- Total distance.
- Fuel consumption.
- Total transportation cost.
- Cost per kilometer.
- Vehicle-wise cost.
- Driver activity.
- Fuel efficiency.
- Participation trends.

Filters:

- Date range.
- Vehicle.
- Driver.
- Department, if available.
- Trip status.

Count completed trips separately from canceled rides. Do not include invalid or canceled records in completed-trip metrics.

### Audit Logs

Record these actions:

- Employee activated.
- Employee suspended.
- Employee reactivated.
- Employee information updated.
- Vehicle created.
- Vehicle updated.
- Vehicle status changed.
- Organization setting changed.
- Cost configuration changed.
- Admin account setting changed.

Display:

- Actor.
- Action.
- Entity type.
- Entity ID.
- Organization.
- Timestamp.
- Previous values.
- New values.

---

## 8. Employee Web Application Requirements

Implement the following screens or equivalent routes:

```text
/employee/login
/employee/register
/employee/onboarding
/employee/home
/employee/rides
/employee/rides/new
/employee/rides/:id
/employee/my-rides
/employee/trips
/employee/trips/:id
/employee/vehicles
/employee/wallet
/employee/notifications
/employee/profile
```

### Employee Home

Show:

- Upcoming ride.
- Available ride suggestions.
- Quick action to publish a ride.
- Quick action to find a ride.
- Current participation summary.
- Recent trip activity.

### Publish Ride

Collect:

- Start location.
- Destination.
- Date.
- Departure time.
- Available seats.
- Vehicle.
- Estimated distance.
- Estimated cost.
- Optional notes.

Validate on the server:

- The employee owns or can use the selected vehicle.
- The vehicle is active.
- The number of seats is valid.
- The departure time is valid.
- The ride belongs to the employee's organization.

### Find a Ride

Allow filtering by:

- Starting area.
- Destination.
- Date.
- Time range.
- Available seats.
- Vehicle type, if required.

### Ride Details

Display:

- Driver information allowed by privacy rules.
- Vehicle information.
- Start location.
- Destination.
- Departure time.
- Available seats.
- Estimated cost.
- Ride status.
- Request status.

### Active Trip

Support:

- Viewing trip participants.
- Viewing pickup and destination details.
- Starting the trip.
- Completing the trip.
- Canceling the trip when allowed.
- Viewing distance and estimated cost.

### Trip History

Show:

- Completed trips.
- Canceled trips.
- Employee role in each trip.
- Distance.
- Cost.
- Date.
- Driver or passenger information allowed by privacy rules.

---

## 9. React Native Mobile Requirements

The mobile application should use the same backend APIs and authorization rules as the Employee Web Application.

Implement these screens:

```text
Welcome
Login
Registration or Invitation
Profile Setup
Home
Find a Ride
Publish a Ride
Ride Details
Ride Requests
My Rides
Active Trip
Trip History
Vehicles
Wallet or Payments
Notifications
Profile and Settings
```

Use mobile-appropriate navigation, such as a stack navigator with bottom tabs.

Recommended bottom tabs:

```text
Home | Find Ride | My Rides | Trips | Profile
```

The mobile application must handle:

- Loading states.
- Offline or weak-network errors.
- Retry actions.
- Authentication expiry.
- Permission errors.
- Form validation.
- Empty lists.
- Push notification integration only if already available.

Do not duplicate business logic in the mobile application. Business rules must remain on the backend.

---

## 10. Public Website Requirements

Build a clean responsive public website with these sections:

- Hero section.
- Product explanation.
- How it works.
- Benefits for companies.
- Benefits for employees.
- Safety and privacy section.
- Sustainability or cost-saving section.
- Call to action.
- Login entry points.
- Contact section.

The public website must not expose private application data.

The website should provide clear links to:

- Admin login.
- Employee login.
- Mobile application information.
- Contact or demo request.

---

## 11. Data Model

Create or map the following entities:

### Organization

- ID.
- Name.
- Logo.
- Contact information.
- Currency.
- Time zone.
- Status.
- Created date.

### User or Employee

- ID.
- Organization ID.
- Name.
- Email.
- Phone.
- Employee ID.
- Role.
- Account status.
- Department.
- Created date.
- Last activity date.

### Vehicle

- ID.
- Organization ID.
- Owner employee ID.
- Model.
- Registration number.
- Vehicle type.
- Seating capacity.
- Status.
- Created date.

### Ride

- ID.
- Organization ID.
- Driver ID.
- Vehicle ID.
- Start location.
- Destination.
- Departure time.
- Available seats.
- Estimated distance.
- Estimated cost.
- Status.
- Created date.

### Ride Request

- ID.
- Ride ID.
- Passenger ID.
- Requested seats.
- Status.
- Created date.
- Updated date.

Suggested statuses:

```text
PENDING
ACCEPTED
REJECTED
CANCELED
```

### Trip

- ID.
- Organization ID.
- Ride ID.
- Driver ID.
- Passenger IDs.
- Vehicle snapshot.
- Distance travelled.
- Fuel consumed.
- Total cost.
- Cost per kilometer.
- Started date.
- Completed date.
- Status.

### Payment

- ID.
- Organization ID.
- Trip ID.
- Payer ID.
- Receiver ID.
- Amount.
- Currency.
- Status.
- Payment date.

### Cost Configuration

- ID.
- Organization ID.
- Type.
- Value.
- Unit.
- Currency.
- Effective from.
- Effective until.
- Created by.
- Created date.

### Audit Log

- ID.
- Organization ID.
- Actor ID.
- Action.
- Entity type.
- Entity ID.
- Previous values.
- New values.
- Timestamp.
- Metadata.

---

## 12. API Requirements

Use API modules similar to:

```text
/auth
/organizations
/employee/profile
/employee/rides
/employee/rides/:id/requests
/employee/trips
/employee/vehicles
/employee/payments

/admin/dashboard
/admin/employees
/admin/employees/:id
/admin/invitations
/admin/vehicles
/admin/vehicles/:id
/admin/drivers
/admin/organization
/admin/organization/settings
/admin/costs
/admin/participation
/admin/reports
/admin/audit-logs
```

Every protected request must perform:

```text
1. Authenticate the user.
2. Resolve the user's role.
3. Resolve the user's organization.
4. Validate the requested resource organization.
5. Validate the required permission.
6. Validate the request data.
7. Execute business logic.
8. Create an audit log when required.
9. Return a consistent response.
```

Do not trust an organization ID supplied by the browser. Resolve it from the authenticated user or trusted server-side context.

Use consistent response shapes. For example:

```json
{
  "success": true,
  "data": {},
  "message": "Request completed successfully"
}
```

For errors:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found"
  }
}
```

Use pagination for large lists:

```text
?page=1&pageSize=20
```

Return pagination metadata:

```json
{
  "page": 1,
  "pageSize": 20,
  "total": 100,
  "totalPages": 5
}
```

---

## 13. Odoo Implementation Guidance

If Odoo is used, create clear custom modules and models for the carpool domain.

Suggested models:

```text
res.company
res.users
carpool.employee
carpool.vehicle
carpool.ride
carpool.ride.request
carpool.trip
carpool.payment
carpool.cost.configuration
carpool.audit.log
```

Use Odoo company or organization references for data isolation. Add access rules and record rules where appropriate, but also enforce authorization in the API layer.

The API layer must not expose unrestricted model methods. Create purpose-specific endpoints for:

- Employee listing.
- Employee status changes.
- Vehicle management.
- Ride publishing.
- Ride discovery.
- Ride requests.
- Trip completion.
- Dashboard metrics.
- Reports.
- Cost configuration.

If Odoo is not being used as the backend, keep the same domain structure and authorization rules in the selected backend technology.

---

## 14. UI and UX Requirements

The interface should be suitable for a polished hackathon demonstration.

Follow these principles:

- Use a consistent design system.
- Use clear page titles and action buttons.
- Keep navigation simple.
- Use responsive layouts.
- Show useful empty states.
- Show skeleton loading states for data-heavy pages.
- Display clear validation errors.
- Confirm access changes and destructive actions.
- Avoid excessive dashboard widgets.
- Use tables for administrative records.
- Use cards for summary metrics.
- Use charts only when they communicate a useful trend.
- Keep employee workflows short and easy to understand.
- Use accessible labels and keyboard navigation on web interfaces.
- Do not hide important authorization failures behind generic errors.

Recommended Admin Panel navigation:

```text
Dashboard
Employees
Vehicles
Drivers
Organization
Costs
Participation
Reports
Audit Logs
Admin Settings
```

Recommended Employee navigation:

```text
Home
Find a Ride
Publish a Ride
My Rides
Trips
Vehicles
Profile
```

---

## 15. MVP Scope

Prioritize one complete flow over a large number of incomplete features.

### Admin MVP

- Admin login.
- Organization-scoped authorization.
- Dashboard with real counts.
- Employee list and search.
- Employee activation and suspension.
- Vehicle list and management.
- Driver association.
- Basic organization settings.
- Fuel and travel cost configuration.
- Basic reports.
- Audit logs for important actions.

### Employee MVP

- Employee login.
- Profile completion.
- Vehicle registration.
- Find available rides.
- Publish a ride.
- Request a ride.
- Accept or reject a request.
- View upcoming rides.
- Complete a trip.
- View trip history.

### Public Website MVP

- Landing page.
- Product explanation.
- Benefits.
- How it works.
- Login links.
- Contact section.

### Mobile MVP

- Login.
- Home.
- Find a ride.
- Publish a ride.
- Ride details.
- Active trip.
- Trip history.

---

## 16. Features to Exclude From the MVP

Do not implement these unless they are explicitly required:

- Admin booking rides for employees.
- Admin publishing rides for employees.
- Admin-controlled employee wallets.
- Complex payment settlement.
- Advanced route optimization.
- AI-based ride matching.
- Large configurable permission systems.
- Multi-level approval workflows.
- Full notification campaign management.
- Full enterprise compliance tooling.
- Vehicle maintenance management.
- Real-time GPS tracking.

Create extension points where useful, but do not allow future features to complicate the first working version.

---

## 17. Development Order

Implement in this order:

### Phase 1: Inspect and Plan

Before writing code:

1. Inspect the existing repository.
2. Identify the current frontend and backend frameworks.
3. Identify whether Odoo is already configured.
4. Review existing authentication.
5. Review existing database models.
6. Identify reusable components.
7. Create or update the implementation plan.
8. Identify missing environment variables.

Do not replace existing working architecture without a strong reason.

### Phase 2: Foundation

Implement:

- Authentication.
- User roles.
- Organization model.
- Organization isolation.
- Shared types.
- Shared validation schemas.
- API client.
- Error response format.
- Protected routes.

### Phase 3: Employee Carpool Flow

Implement:

- Employee profile.
- Vehicle registration.
- Ride publishing.
- Ride discovery.
- Ride requests.
- Request acceptance or rejection.
- Trip start and completion.
- Trip history.

### Phase 4: Admin Panel

Implement:

- Admin login.
- Admin layout.
- Dashboard.
- Employees.
- Vehicles.
- Drivers.
- Organization settings.
- Costs.

### Phase 5: Analytics

Implement:

- Dashboard metrics.
- Participation.
- Trip reports.
- Distance reports.
- Fuel reports.
- Cost per kilometer.
- Vehicle activity.

### Phase 6: Mobile Application

Implement the employee workflows using the same backend APIs.

### Phase 7: Hardening

Test and improve:

- Authorization.
- Organization isolation.
- Input validation.
- Pagination.
- Error handling.
- Audit logging.
- Historical cost accuracy.
- Loading states.
- Empty states.
- Mobile responsiveness.
- API consistency.

---

## 18. Testing Requirements

Create tests for:

### Authentication

- Unauthenticated users cannot access protected routes.
- Employees cannot access admin routes.
- Suspended employees cannot perform protected employee actions.
- Admin sessions expire correctly.

### Organization Isolation

- Admin A cannot view Organization B data.
- Employee A cannot view Employee B private data.
- API requests cannot override organization scope using a request body value.

### Employee Operations

- Employees can publish rides only for valid active vehicles.
- Employees cannot exceed vehicle seating capacity.
- Employees cannot request a seat on their own ride if the workflow does not allow it.
- Duplicate ride requests are rejected.
- Invalid ride transitions are rejected.
- Completed trips cannot be edited as active rides.

### Admin Operations

- Employee status changes are authorized.
- Vehicle registration numbers are unique within an organization.
- Inactive vehicles cannot be used for new rides.
- Cost configuration changes create audit records.
- Historical trips preserve previous cost values.

### Reporting

- Canceled rides are not counted as completed trips.
- Distance totals are calculated correctly.
- Fuel calculations use the applicable effective cost configuration.
- Date filters include the correct start and end boundaries.

---

## 19. Demo Data

Create seed data for the hackathon demonstration:

- One organization.
- One company administrator.
- Five to ten employees.
- Three or more vehicles.
- Several published rides.
- Several ride requests.
- Completed and canceled trips.
- Multiple cost configuration versions.
- Audit log records.

Make the seed data realistic but clearly artificial. Do not use real personal information.

The demo should make the dashboard, employee management, vehicle management, and reports appear populated without hardcoding the dashboard metrics.

---

## 20. Demonstration Workflow

The final demo should follow this flow:

```text
1. Admin logs in.
2. Admin views the organization dashboard.
3. Admin opens the employee list.
4. Admin activates or suspends an employee.
5. Admin opens the vehicle list.
6. Admin verifies a driver and vehicle association.
7. Employee logs in from the employee application.
8. Employee completes their profile.
9. Employee publishes a ride.
10. Another employee searches for the ride.
11. Passenger requests a seat.
12. Driver accepts the request.
13. The trip is started and completed.
14. Admin dashboard metrics update.
15. Admin opens the reports page.
16. Admin reviews trip, distance, fuel, and cost data.
17. Admin opens the audit log.
```

Ensure this workflow works with real API calls and persisted records.

---

## 21. Definition of Done

A feature is complete only when:

- The user interface is implemented.
- The API endpoint exists.
- Backend authorization is implemented.
- Organization scope is validated.
- Input validation is implemented.
- Loading, empty, and error states are handled.
- Important actions create audit records.
- Data is persisted correctly.
- Historical records are protected from accidental rewriting.
- The feature works with seeded data.
- The feature has at least basic tests.
- The feature works on the required screen sizes.

Do not mark a feature complete simply because its page or form exists.

---

## 22. Final Instruction

Build the platform incrementally. Start by inspecting the existing codebase and identifying the current architecture. Do not create mock screens that are disconnected from the backend unless a temporary UI prototype is explicitly requested.

Use real API data for the main demo flow. Keep the Admin Panel focused on organizational control, configuration, monitoring, and reporting. Keep employee web and mobile applications focused on ride and trip operations.

The final product should be secure, organization-scoped, responsive, understandable, and easy to demonstrate during the Odoo hackathon.