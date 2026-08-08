import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestContext, login, type TestContext } from './helpers.js';

let ctx: TestContext;
let northwindAdmin: string;
let fairwindAdmin: string;

beforeAll(async () => {
  ctx = await createTestContext();
  northwindAdmin = await login(ctx.app, ctx.demo.adminEmail);
  fairwindAdmin = await login(ctx.app, ctx.other.adminEmail);
});

afterAll(async () => {
  await ctx.db.close();
});

describe('organization isolation', () => {
  it('an admin of organization B cannot read organization A employees', async () => {
    const theirs = await request(ctx.app).get('/api/admin/employees').set('authorization', `Bearer ${fairwindAdmin}`);
    expect(theirs.status).toBe(200);

    const emails = theirs.body.data.items.map((e: { email: string }) => e.email);
    expect(emails).toContain('leela.krishnan@example.com');
    expect(emails).not.toContain(ctx.demo.driverEmail);
  });

  it('fetching another organization employee by id is a 404, not a leak', async () => {
    const response = await request(ctx.app)
      .get(`/api/admin/employees/${ctx.demo.employeeIds[0]}`)
      .set('authorization', `Bearer ${fairwindAdmin}`);
    expect(response.status).toBe(404);
  });

  it('cannot change the status of an employee in another organization', async () => {
    const response = await request(ctx.app)
      .post(`/api/admin/employees/${ctx.demo.employeeIds[0]}/status`)
      .set('authorization', `Bearer ${fairwindAdmin}`)
      .send({ status: 'suspended' });
    expect(response.status).toBe(404);

    // And the target is untouched.
    const check = await request(ctx.app)
      .get(`/api/admin/employees/${ctx.demo.employeeIds[0]}`)
      .set('authorization', `Bearer ${northwindAdmin}`);
    expect(check.body.data.status).toBe('active');
  });

  it('cannot read or mutate a vehicle from another organization', async () => {
    const read = await request(ctx.app)
      .get(`/api/admin/vehicles/${ctx.demo.vehicleIds[0]}`)
      .set('authorization', `Bearer ${fairwindAdmin}`);
    expect(read.status).toBe(404);

    const write = await request(ctx.app)
      .post(`/api/admin/vehicles/${ctx.demo.vehicleIds[0]}/status`)
      .set('authorization', `Bearer ${fairwindAdmin}`)
      .send({ status: 'inactive' });
    expect(write.status).toBe(404);
  });

  it('dashboard metrics only count the caller organization', async () => {
    const mine = await request(ctx.app).get('/api/admin/dashboard').set('authorization', `Bearer ${northwindAdmin}`);
    const theirs = await request(ctx.app).get('/api/admin/dashboard').set('authorization', `Bearer ${fairwindAdmin}`);

    expect(mine.body.data.trips.completed).toBeGreaterThan(0);
    expect(theirs.body.data.trips.completed).toBe(0);
    expect(theirs.body.data.employees.total).toBe(1);
  });

  it('audit logs never cross organizations', async () => {
    const theirs = await request(ctx.app).get('/api/admin/audit-logs').set('authorization', `Bearer ${fairwindAdmin}`);
    expect(theirs.status).toBe(200);
    expect(theirs.body.data.items).toHaveLength(0);

    const mine = await request(ctx.app).get('/api/admin/audit-logs').set('authorization', `Bearer ${northwindAdmin}`);
    expect(mine.body.data.items.length).toBeGreaterThan(0);
    for (const entry of mine.body.data.items) {
      expect(entry.organizationId).toBe(ctx.demo.organizationId);
    }
  });

  it('an employee cannot search rides published in another organization', async () => {
    const leela = await login(ctx.app, 'leela.krishnan@example.com');
    const response = await request(ctx.app).get('/api/employee/rides').set('authorization', `Bearer ${leela}`);
    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(0);
  });

  it('an employee cannot open another employee private wallet or trips', async () => {
    const passenger = await login(ctx.app, ctx.demo.passengerEmail);
    const driver = await login(ctx.app, ctx.demo.driverEmail);

    const driverTrips = await request(ctx.app).get('/api/employee/trips').set('authorization', `Bearer ${driver}`);
    const otherTripId = driverTrips.body.data.find(
      (t: { participants: Array<{ id: string }> }) =>
        !t.participants.some((p) => p.id === ctx.demo.employeeIds[3]),
    )?.id;

    if (otherTripId) {
      const response = await request(ctx.app)
        .get(`/api/employee/trips/${otherTripId}`)
        .set('authorization', `Bearer ${passenger}`);
      expect(response.status).toBe(403);
    }

    const wallet = await request(ctx.app).get('/api/employee/payments').set('authorization', `Bearer ${passenger}`);
    expect(wallet.status).toBe(200);
    for (const payment of wallet.body.data.payments) {
      const involved =
        payment.payerId === ctx.demo.employeeIds[3] || payment.receiverId === ctx.demo.employeeIds[3];
      expect(involved).toBe(true);
    }
  });

  it('refuses a request body that tries to override the organization scope', async () => {
    const response = await request(ctx.app)
      .patch('/api/admin/organization/settings')
      .set('authorization', `Bearer ${fairwindAdmin}`)
      .send({ organizationId: ctx.demo.organizationId, name: 'Hijacked Name' });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/cannot be supplied by the client/i);

    // Target organization untouched.
    const check = await request(ctx.app).get('/api/admin/organization').set('authorization', `Bearer ${northwindAdmin}`);
    expect(check.body.data.organization.name).toBe('Northwind Logistics');
  });

  it('refuses snake_case organization overrides as well', async () => {
    const response = await request(ctx.app)
      .post('/api/employee/vehicles')
      .set('authorization', `Bearer ${await login(ctx.app, ctx.demo.driverEmail)}`)
      .send({
        organization_id: ctx.other.organizationId,
        make: 'Skoda',
        model: 'Slavia',
        registrationNumber: 'WB 09 QQ 1111',
        vehicleType: 'sedan',
        seatingCapacity: 5,
      });
    expect(response.status).toBe(403);
  });
});
