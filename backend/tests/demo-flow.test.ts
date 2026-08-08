import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestContext, login, type TestContext } from './helpers.js';

/**
 * The exact demonstration workflow from the specification, end to end, against
 * real HTTP calls and persisted rows.
 */

let ctx: TestContext;
let admin: string;
let driver: string;
let passenger: string;

let rideId: string;
let tripId: string;
let baselineTrips: number;
let baselineDistance: number;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.db.close();
});

describe('demonstration workflow', () => {
  it('1. the administrator signs in', async () => {
    const response = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: ctx.demo.adminEmail, password: ctx.demo.password });
    expect(response.status).toBe(200);
    admin = response.body.data.token;
  });

  it('2. the organization dashboard loads with real metrics', async () => {
    const response = await request(ctx.app).get('/api/admin/dashboard').set('authorization', `Bearer ${admin}`);
    expect(response.status).toBe(200);
    baselineTrips = response.body.data.trips.completed;
    baselineDistance = response.body.data.distance.totalKm;
    expect(baselineTrips).toBeGreaterThan(0);
  });

  it('3-4. the administrator reviews the employee list and suspends, then restores, access', async () => {
    const list = await request(ctx.app).get('/api/admin/employees').set('authorization', `Bearer ${admin}`);
    expect(list.body.data.items.length).toBeGreaterThan(0);

    const target = ctx.demo.employeeIds[5]!;
    const suspended = await request(ctx.app)
      .post(`/api/admin/employees/${target}/status`)
      .set('authorization', `Bearer ${admin}`)
      .send({ status: 'suspended', reason: 'Demo suspension' });
    expect(suspended.body.data.status).toBe('suspended');

    const restored = await request(ctx.app)
      .post(`/api/admin/employees/${target}/status`)
      .set('authorization', `Bearer ${admin}`)
      .send({ status: 'active' });
    expect(restored.body.data.status).toBe('active');
  });

  it('5-6. the administrator confirms the vehicle and driver association', async () => {
    const vehicles = await request(ctx.app).get('/api/admin/vehicles').set('authorization', `Bearer ${admin}`);
    expect(vehicles.body.data.items.length).toBeGreaterThan(0);

    const drivers = await request(ctx.app).get('/api/admin/drivers').set('authorization', `Bearer ${admin}`);
    const association = drivers.body.data.items.find(
      (d: { employeeId: string }) => d.employeeId === ctx.demo.employeeIds[0],
    );
    expect(association.vehicles[0].registrationNumber).toBe('WB 06 AK 4412');
  });

  it('7-8. the driver signs in and completes their profile', async () => {
    driver = await login(ctx.app, ctx.demo.driverEmail);

    const profile = await request(ctx.app)
      .patch('/api/employee/profile')
      .set('authorization', `Bearer ${driver}`)
      .send({ homeLocation: 'Salt Lake Sector V', workLocation: 'Park Street Office', phone: '+91 90000 10001' });

    expect(profile.status).toBe(200);
    expect(profile.body.data.profileComplete).toBe(true);
  });

  it('9. the driver publishes a ride', async () => {
    const departure = new Date();
    departure.setDate(departure.getDate() + 1);
    departure.setHours(8, 45, 0, 0);

    const response = await request(ctx.app)
      .post('/api/employee/rides')
      .set('authorization', `Bearer ${driver}`)
      .send({
        vehicleId: ctx.demo.vehicleIds[0],
        startLocation: 'Salt Lake Sector V',
        destination: 'Park Street Office',
        departureAt: departure.toISOString(),
        seats: 3,
        estimatedDistanceKm: 12.4,
        notes: 'Demo ride',
      });

    expect(response.status).toBe(201);
    rideId = response.body.data.id;
    expect(response.body.data.estimatedCost).toBeGreaterThan(0);
  });

  it('10-11. another employee finds the ride and requests a seat', async () => {
    passenger = await login(ctx.app, ctx.demo.passengerEmail);

    const search = await request(ctx.app)
      .get('/api/employee/rides')
      .query({ from: 'Salt Lake', to: 'Park Street' })
      .set('authorization', `Bearer ${passenger}`);
    expect(search.body.data.items.map((r: { id: string }) => r.id)).toContain(rideId);

    const requested = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests`)
      .set('authorization', `Bearer ${passenger}`)
      .send({ seats: 1, note: 'Demo request' });
    expect(requested.status).toBe(201);
  });

  it('12. the driver accepts the request', async () => {
    const incoming = await request(ctx.app)
      .get('/api/employee/rides/requests/incoming')
      .set('authorization', `Bearer ${driver}`);
    const pending = incoming.body.data.find((r: { rideId: string }) => r.rideId === rideId);
    expect(pending).toBeTruthy();

    const accepted = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests/${pending.id}/respond`)
      .set('authorization', `Bearer ${driver}`)
      .send({ action: 'accept' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.seatsTaken).toBe(1);
  });

  it('13. the trip is started and completed', async () => {
    const started = await request(ctx.app)
      .post('/api/employee/trips')
      .set('authorization', `Bearer ${driver}`)
      .send({ rideId });
    expect(started.status).toBe(201);
    tripId = started.body.data.id;

    const activeForPassenger = await request(ctx.app)
      .get('/api/employee/trips/active')
      .set('authorization', `Bearer ${passenger}`);
    expect(activeForPassenger.body.data.id).toBe(tripId);

    const completed = await request(ctx.app)
      .post(`/api/employee/trips/${tripId}/complete`)
      .set('authorization', `Bearer ${driver}`)
      .send({ distanceKm: 12.4 });
    expect(completed.status).toBe(200);
    expect(completed.body.data.status).toBe('completed');
  });

  it('14. the administrator dashboard metrics move', async () => {
    const response = await request(ctx.app).get('/api/admin/dashboard').set('authorization', `Bearer ${admin}`);
    expect(response.body.data.trips.completed).toBe(baselineTrips + 1);
    expect(response.body.data.distance.totalKm).toBeCloseTo(baselineDistance + 12.4, 1);
  });

  it('15-16. reports show the new trip with distance, fuel and cost', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const response = await request(ctx.app)
      .get('/api/admin/reports')
      .query({ from: today, to: today })
      .set('authorization', `Bearer ${admin}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totals.completedTrips).toBeGreaterThanOrEqual(1);
    expect(response.body.data.totals.fuelLitres).toBeGreaterThan(0);
    expect(response.body.data.totals.totalCost).toBeGreaterThan(0);
    expect(response.body.data.totals.averageOccupancy).toBeGreaterThanOrEqual(2);
  });

  it('17. the audit log records the administrative actions taken during the demo', async () => {
    const response = await request(ctx.app).get('/api/admin/audit-logs').set('authorization', `Bearer ${admin}`);
    const actions = response.body.data.items.map((e: { action: string }) => e.action);
    expect(actions).toContain('employee.reactivated');
    expect(actions).toContain('employee.suspended');
  });

  it('the trip history and wallet reflect the completed trip for both sides', async () => {
    const driverTrips = await request(ctx.app).get('/api/employee/trips').set('authorization', `Bearer ${driver}`);
    const driverTrip = driverTrips.body.data.find((t: { id: string }) => t.id === tripId);
    expect(driverTrip.viewerRole).toBe('driver');

    const passengerTrips = await request(ctx.app).get('/api/employee/trips').set('authorization', `Bearer ${passenger}`);
    const passengerTrip = passengerTrips.body.data.find((t: { id: string }) => t.id === tripId);
    expect(passengerTrip.viewerRole).toBe('passenger');
    expect(passengerTrip.viewerShare).toBeGreaterThan(0);

    const wallet = await request(ctx.app).get('/api/employee/payments').set('authorization', `Bearer ${passenger}`);
    expect(wallet.body.data.owed).toBeGreaterThan(0);

    const home = await request(ctx.app).get('/api/employee/home').set('authorization', `Bearer ${driver}`);
    expect(home.status).toBe(200);
    expect(home.body.data.stats.tripsCompleted).toBeGreaterThan(0);
    expect(home.body.data.recentTrips.length).toBeGreaterThan(0);
  });
});
