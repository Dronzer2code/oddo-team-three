import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestContext, login, type TestContext } from './helpers.js';

let ctx: TestContext;
let driver: string;
let passenger: string;
let secondPassenger: string;

/** Tomorrow at 08:30 local time. */
function futureIso(days = 1, hour = 8, minute = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

async function publishRide(
  token: string,
  overrides: Partial<{
    vehicleId: string;
    startLocation: string;
    destination: string;
    departureAt: string;
    seats: number;
    estimatedDistanceKm: number;
  }> = {},
) {
  return request(ctx.app)
    .post('/api/employee/rides')
    .set('authorization', `Bearer ${token}`)
    .send({
      vehicleId: ctx.demo.vehicleIds[0],
      startLocation: 'Salt Lake Sector V',
      destination: 'Park Street Office',
      departureAt: futureIso(),
      seats: 2,
      estimatedDistanceKm: 12.4,
      ...overrides,
    });
}

beforeAll(async () => {
  ctx = await createTestContext();
  driver = await login(ctx.app, ctx.demo.driverEmail);
  passenger = await login(ctx.app, ctx.demo.passengerEmail);
  secondPassenger = await login(ctx.app, 'kavya.nair@example.com');
});

afterAll(async () => {
  await ctx.db.close();
});

describe('publishing a ride', () => {
  it('publishes with a valid active vehicle and computes a cost estimate', async () => {
    const response = await publishRide(driver);

    expect(response.status).toBe(201);
    const ride = response.body.data;
    expect(ride.status).toBe('published');
    expect(ride.seatsAvailable).toBe(2);
    // 12.4 km at 15.5 km/l and Rs 104.50/l plus Rs 2.20/km running cost.
    expect(ride.estimatedCost).toBeCloseTo(12.4 / 15.5 * 104.5 + 12.4 * 2.2, 1);
    expect(ride.costPerSeat).toBeGreaterThan(0);
    expect(ride.viewer.isDriver).toBe(true);
  });

  it('refuses a vehicle the employee does not own', async () => {
    const response = await publishRide(passenger, { vehicleId: ctx.demo.vehicleIds[0] });
    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/your own vehicle/i);
  });

  it('refuses a vehicle that is not active', async () => {
    // vehicleIds[4] is under review, vehicleIds[5] is inactive.
    const underReviewOwner = await login(ctx.app, 'meera.iyer@example.com');
    const underReview = await publishRide(underReviewOwner, { vehicleId: ctx.demo.vehicleIds[4] });
    expect(underReview.status).toBe(409);
    expect(underReview.body.error.message).toMatch(/under review/i);

    const inactiveOwner = await login(ctx.app, 'kavya.nair@example.com');
    const inactive = await publishRide(inactiveOwner, { vehicleId: ctx.demo.vehicleIds[5] });
    expect(inactive.status).toBe(409);
    expect(inactive.body.error.message).toMatch(/inactive/i);
  });

  it('refuses more seats than the vehicle can carry beside the driver', async () => {
    // The Honda City seats 5, so at most 4 passengers.
    const response = await publishRide(driver, { seats: 5 });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/at most 4 seats/i);
  });

  it('refuses a departure time in the past', async () => {
    const response = await publishRide(driver, { departureAt: new Date(Date.now() - 3600_000).toISOString() });
    expect(response.status).toBe(422);
    expect(response.body.error.details.departureAt).toBeTruthy();
  });

  it('refuses a vehicle id from another organization', async () => {
    const response = await publishRide(driver, { vehicleId: '00000000-0000-4000-8000-000000000000' });
    expect(response.status).toBe(404);
  });
});

describe('requesting a seat', () => {
  let rideId: string;

  beforeAll(async () => {
    const published = await publishRide(driver, { departureAt: futureIso(4), seats: 2 });
    rideId = published.body.data.id;
  });

  it('lets another employee find the ride and request a seat', async () => {
    const search = await request(ctx.app)
      .get('/api/employee/rides')
      .query({ to: 'Park Street', minSeats: 1 })
      .set('authorization', `Bearer ${passenger}`);
    expect(search.status).toBe(200);
    expect(search.body.data.items.map((r: { id: string }) => r.id)).toContain(rideId);

    const requested = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests`)
      .set('authorization', `Bearer ${passenger}`)
      .send({ seats: 1, note: 'Pickup at the crossing please' });

    expect(requested.status).toBe(201);
    expect(requested.body.data.status).toBe('pending');
  });

  it('rejects a duplicate request from the same passenger', async () => {
    const response = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests`)
      .set('authorization', `Bearer ${passenger}`)
      .send({ seats: 1 });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/already have an open request/i);
  });

  it('refuses a seat request on your own ride', async () => {
    const response = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests`)
      .set('authorization', `Bearer ${driver}`)
      .send({ seats: 1 });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/your own ride/i);
  });

  it('refuses more seats than remain', async () => {
    const response = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests`)
      .set('authorization', `Bearer ${secondPassenger}`)
      .send({ seats: 5 });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/only 2 seats left/i);
  });

  it('only the driver can accept or reject', async () => {
    const detail = await request(ctx.app)
      .get(`/api/employee/rides/${rideId}`)
      .set('authorization', `Bearer ${driver}`);
    const requestId = detail.body.data.requests[0].id;

    const asPassenger = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests/${requestId}/respond`)
      .set('authorization', `Bearer ${passenger}`)
      .send({ action: 'accept' });
    expect(asPassenger.status).toBe(403);

    const asDriver = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests/${requestId}/respond`)
      .set('authorization', `Bearer ${driver}`)
      .send({ action: 'accept' });
    expect(asDriver.status).toBe(200);
    expect(asDriver.body.data.seatsTaken).toBe(1);
    expect(asDriver.body.data.seatsAvailable).toBe(1);

    // The same request cannot be answered twice.
    const again = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests/${requestId}/respond`)
      .set('authorization', `Bearer ${driver}`)
      .send({ action: 'reject' });
    expect(again.status).toBe(409);
  });

  it('marks the ride full once every seat is accepted and stops new requests', async () => {
    const second = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests`)
      .set('authorization', `Bearer ${secondPassenger}`)
      .send({ seats: 1 });
    expect(second.status).toBe(201);

    const accepted = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests/${second.body.data.id}/respond`)
      .set('authorization', `Bearer ${driver}`)
      .send({ action: 'accept' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('full');
    expect(accepted.body.data.seatsAvailable).toBe(0);

    const late = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests`)
      .set('authorization', `Bearer ${await login(ctx.app, 'rohit.menon@example.com')}`)
      .send({ seats: 1 });
    expect(late.status).toBe(409);
    expect(late.body.error.message).toMatch(/no longer accepting requests/i);
  });

  it('frees the seat again when an accepted passenger withdraws', async () => {
    const detail = await request(ctx.app)
      .get(`/api/employee/rides/${rideId}`)
      .set('authorization', `Bearer ${driver}`);
    const accepted = detail.body.data.requests.find(
      (r: { status: string; passenger: { id: string } }) =>
        r.status === 'accepted' && r.passenger.id === ctx.demo.employeeIds[5],
    );

    const withdrawn = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests/${accepted.id}/cancel`)
      .set('authorization', `Bearer ${secondPassenger}`)
      .send({});

    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.data.status).toBe('published');
    expect(withdrawn.body.data.seatsAvailable).toBe(1);
  });

  it('will not let a passenger withdraw somebody else request', async () => {
    const detail = await request(ctx.app)
      .get(`/api/employee/rides/${rideId}`)
      .set('authorization', `Bearer ${driver}`);
    const someone = detail.body.data.requests.find((r: { status: string }) => r.status === 'accepted');

    const response = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests/${someone.id}/cancel`)
      .set('authorization', `Bearer ${secondPassenger}`)
      .send({});
    expect(response.status).toBe(403);
  });

  it('hides the driver phone number from employees without an accepted seat', async () => {
    const outsider = await login(ctx.app, 'rohit.menon@example.com');
    const asOutsider = await request(ctx.app)
      .get(`/api/employee/rides/${rideId}`)
      .set('authorization', `Bearer ${outsider}`);
    expect(asOutsider.body.data.driver.phone).toBeUndefined();

    const asAcceptedPassenger = await request(ctx.app)
      .get(`/api/employee/rides/${rideId}`)
      .set('authorization', `Bearer ${passenger}`);
    expect(asAcceptedPassenger.body.data.driver.phone).toBeTruthy();
  });
});

describe('trip lifecycle', () => {
  let rideId: string;
  let tripId: string;

  beforeAll(async () => {
    const published = await publishRide(driver, { departureAt: futureIso(6), seats: 2, estimatedDistanceKm: 20 });
    rideId = published.body.data.id;

    const requested = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests`)
      .set('authorization', `Bearer ${passenger}`)
      .send({ seats: 1 });
    await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests/${requested.body.data.id}/respond`)
      .set('authorization', `Bearer ${driver}`)
      .send({ action: 'accept' });
  });

  it('only the driver can start the trip', async () => {
    const asPassenger = await request(ctx.app)
      .post('/api/employee/trips')
      .set('authorization', `Bearer ${passenger}`)
      .send({ rideId });
    expect(asPassenger.status).toBe(403);

    const asDriver = await request(ctx.app)
      .post('/api/employee/trips')
      .set('authorization', `Bearer ${driver}`)
      .send({ rideId });
    expect(asDriver.status).toBe(201);
    tripId = asDriver.body.data.id;

    expect(asDriver.body.data.status).toBe('in_progress');
    expect(asDriver.body.data.participants).toHaveLength(2);
    // The vehicle and the cost basis are frozen onto the trip.
    expect(asDriver.body.data.vehicleSnapshot.registrationNumber).toBe('WB 06 AK 4412');
    expect(asDriver.body.data.costSnapshot.fuelCostPerLitre).toBe(104.5);
    expect(asDriver.body.data.costSnapshot.mileageKmpl).toBe(15.5);
  });

  it('refuses to start the same ride twice', async () => {
    const response = await request(ctx.app)
      .post('/api/employee/trips')
      .set('authorization', `Bearer ${driver}`)
      .send({ rideId });
    expect(response.status).toBe(409);
  });

  it('refuses to cancel a ride that is already in progress', async () => {
    const response = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/cancel`)
      .set('authorization', `Bearer ${driver}`)
      .send({});
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/no longer be canceled/i);
  });

  it('completes the trip, splits the cost, and creates a payment', async () => {
    const completed = await request(ctx.app)
      .post(`/api/employee/trips/${tripId}/complete`)
      .set('authorization', `Bearer ${driver}`)
      .send({ distanceKm: 21.5 });

    expect(completed.status).toBe(200);
    const trip = completed.body.data;
    expect(trip.status).toBe('completed');
    expect(trip.distanceKm).toBe(21.5);
    expect(trip.fuelConsumedLitres).toBeCloseTo(21.5 / 15.5, 2);
    expect(trip.totalCost).toBeCloseTo((21.5 / 15.5) * 104.5 + 21.5 * 2.2, 1);
    expect(trip.costPerKm).toBeCloseTo(trip.totalCost / 21.5, 1);

    // One driver + one passenger, so the passenger pays half.
    const share = trip.participants.find((p: { role: string }) => p.role === 'passenger').shareAmount;
    expect(share).toBeCloseTo(trip.totalCost / 2, 1);

    const wallet = await request(ctx.app).get('/api/employee/payments').set('authorization', `Bearer ${passenger}`);
    const payment = wallet.body.data.payments.find((p: { tripId: string }) => p.tripId === tripId);
    expect(payment.direction).toBe('outgoing');
    expect(payment.status).toBe('pending');
    expect(payment.amount).toBeCloseTo(share, 2);
  });

  it('closes the ride so a completed trip cannot be edited as an active ride', async () => {
    const ride = await request(ctx.app)
      .get(`/api/employee/rides/${rideId}`)
      .set('authorization', `Bearer ${driver}`);
    expect(ride.body.data.status).toBe('completed');

    const request2 = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/requests`)
      .set('authorization', `Bearer ${secondPassenger}`)
      .send({ seats: 1 });
    expect(request2.status).toBe(409);

    const cancel = await request(ctx.app)
      .post(`/api/employee/rides/${rideId}/cancel`)
      .set('authorization', `Bearer ${driver}`)
      .send({});
    expect(cancel.status).toBe(409);
  });

  it('refuses to complete a trip twice', async () => {
    const response = await request(ctx.app)
      .post(`/api/employee/trips/${tripId}/complete`)
      .set('authorization', `Bearer ${driver}`)
      .send({ distanceKm: 30 });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/already completed/i);
  });

  it('lets only the receiving driver settle a payment', async () => {
    const wallet = await request(ctx.app).get('/api/employee/payments').set('authorization', `Bearer ${passenger}`);
    const payment = wallet.body.data.payments.find((p: { tripId: string }) => p.tripId === tripId);

    const asPayer = await request(ctx.app)
      .post(`/api/employee/payments/${payment.id}/settle`)
      .set('authorization', `Bearer ${passenger}`)
      .send({});
    expect(asPayer.status).toBe(403);

    const asDriver = await request(ctx.app)
      .post(`/api/employee/payments/${payment.id}/settle`)
      .set('authorization', `Bearer ${driver}`)
      .send({});
    expect(asDriver.status).toBe(200);
    expect(asDriver.body.data.status).toBe('settled');
  });
});

describe('employee profile and vehicles', () => {
  it('completes a profile and reports profileComplete', async () => {
    const token = await login(ctx.app, 'rohit.menon@example.com');
    const response = await request(ctx.app)
      .patch('/api/employee/profile')
      .set('authorization', `Bearer ${token}`)
      .send({ phone: '+91 90000 10002', homeLocation: 'New Town Action Area I', workLocation: 'Park Street Office' });

    expect(response.status).toBe(200);
    expect(response.body.data.profileComplete).toBe(true);
  });

  it('registers a vehicle as under review while approval is required', async () => {
    const token = await login(ctx.app, 'rohit.menon@example.com');
    const response = await request(ctx.app)
      .post('/api/employee/vehicles')
      .set('authorization', `Bearer ${token}`)
      .send({
        make: 'Volkswagen',
        model: 'Virtus',
        registrationNumber: 'wb 07 pp 2244',
        vehicleType: 'sedan',
        seatingCapacity: 5,
        color: 'Reflex Silver',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('under_review');
    // Registration numbers are normalised to upper case.
    expect(response.body.data.registrationNumber).toBe('WB 07 PP 2244');
  });

  it('refuses a duplicate registration number inside the organization', async () => {
    const token = await login(ctx.app, 'rohit.menon@example.com');
    const response = await request(ctx.app)
      .post('/api/employee/vehicles')
      .set('authorization', `Bearer ${token}`)
      .send({
        make: 'Honda',
        model: 'City',
        registrationNumber: 'wb 06 ak 4412',
        vehicleType: 'sedan',
        seatingCapacity: 5,
      });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/already exists/i);
  });

  it('does not let an employee approve their own vehicle', async () => {
    const token = await login(ctx.app, 'rohit.menon@example.com');
    const vehicles = await request(ctx.app).get('/api/employee/vehicles').set('authorization', `Bearer ${token}`);
    const pending = vehicles.body.data.find((v: { status: string }) => v.status === 'under_review');

    const response = await request(ctx.app)
      .post(`/api/employee/vehicles/${pending.id}/status`)
      .set('authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/administrator/i);
  });

  it('does not let an employee manage a vehicle owned by somebody else', async () => {
    const token = await login(ctx.app, 'rohit.menon@example.com');
    const response = await request(ctx.app)
      .patch(`/api/employee/vehicles/${ctx.demo.vehicleIds[0]}`)
      .set('authorization', `Bearer ${token}`)
      .send({ color: 'Repainted' });
    expect(response.status).toBe(403);
  });
});
