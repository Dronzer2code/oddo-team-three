import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestContext, login, type TestContext } from './helpers.js';

let ctx: TestContext;
let admin: string;

beforeAll(async () => {
  ctx = await createTestContext();
  admin = await login(ctx.app, ctx.demo.adminEmail);
});

afterAll(async () => {
  await ctx.db.close();
});

const asAdmin = (method: 'get' | 'post' | 'patch', path: string) =>
  request(ctx.app)[method](path).set('authorization', `Bearer ${admin}`);

describe('employee administration', () => {
  it('searches, filters, paginates and sorts', async () => {
    const search = await asAdmin('get', '/api/admin/employees').query({ search: 'ananya' });
    expect(search.status).toBe(200);
    expect(search.body.data.items).toHaveLength(1);
    expect(search.body.data.items[0].email).toBe(ctx.demo.driverEmail);

    const byCode = await asAdmin('get', '/api/admin/employees').query({ search: 'EMP-1004' });
    expect(byCode.body.data.items[0].email).toBe(ctx.demo.passengerEmail);

    const suspended = await asAdmin('get', '/api/admin/employees').query({ status: 'suspended' });
    expect(suspended.body.data.items.every((e: { status: string }) => e.status === 'suspended')).toBe(true);

    const page = await asAdmin('get', '/api/admin/employees').query({ page: 2, pageSize: 3 });
    expect(page.body.data.pagination).toMatchObject({ page: 2, pageSize: 3 });
    expect(page.body.data.pagination.total).toBe(8);
    expect(page.body.data.pagination.totalPages).toBe(3);
    expect(page.body.data.items).toHaveLength(3);

    const sorted = await asAdmin('get', '/api/admin/employees').query({ sort: 'name', direction: 'desc' });
    const names = sorted.body.data.items.map((e: { name: string }) => e.name);
    expect([...names].sort().reverse()).toEqual(names);

    const participating = await asAdmin('get', '/api/admin/employees').query({ participation: 'active' });
    expect(participating.body.data.items.every((e: { isActiveParticipant: boolean }) => e.isActiveParticipant)).toBe(
      true,
    );
  });

  it('exposes derived counters and vehicles on the detail view', async () => {
    const detail = await asAdmin('get', `/api/admin/employees/${ctx.demo.employeeIds[0]}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.vehicles.length).toBeGreaterThan(0);
    expect(detail.body.data.ridesPublished).toBeGreaterThan(0);
    expect(detail.body.data.tripsCompleted).toBeGreaterThan(0);
    expect(detail.body.data.totalDistanceKm).toBeGreaterThan(0);
  });

  it('suspends an employee, writes an audit record, and blocks their operations', async () => {
    const target = ctx.demo.employeeIds[1]!;

    const suspended = await asAdmin('post', `/api/admin/employees/${target}/status`).send({
      status: 'suspended',
      reason: 'Licence expired',
    });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.status).toBe('suspended');

    const audit = await asAdmin('get', '/api/admin/audit-logs').query({ entityId: target });
    const entry = audit.body.data.items[0];
    expect(entry.action).toBe('employee.suspended');
    expect(entry.previousValues.status).toBe('active');
    expect(entry.newValues.status).toBe('suspended');
    expect(entry.metadata.reason).toBe('Licence expired');
    expect(entry.actorName).toBe('Priya Raghavan');

    const employeeToken = await login(ctx.app, 'rohit.menon@example.com');
    const publish = await request(ctx.app)
      .post('/api/employee/rides')
      .set('authorization', `Bearer ${employeeToken}`)
      .send({
        vehicleId: ctx.demo.vehicleIds[1],
        startLocation: 'A',
        destination: 'B',
        departureAt: new Date(Date.now() + 86_400_000).toISOString(),
        seats: 1,
        estimatedDistanceKm: 5,
      });
    expect(publish.status).toBe(403);

    const reactivated = await asAdmin('post', `/api/admin/employees/${target}/status`).send({ status: 'active' });
    expect(reactivated.status).toBe(200);

    const reactivateAudit = await asAdmin('get', '/api/admin/audit-logs').query({ entityId: target });
    expect(reactivateAudit.body.data.items[0].action).toBe('employee.reactivated');
  });

  it('refuses a no-op status change', async () => {
    const response = await asAdmin('post', `/api/admin/employees/${ctx.demo.employeeIds[0]}/status`).send({
      status: 'active',
    });
    expect(response.status).toBe(409);
  });

  it('updates permitted employee fields and audits the diff', async () => {
    const target = ctx.demo.employeeIds[2]!;
    const response = await asAdmin('patch', `/api/admin/employees/${target}`).send({ department: 'Product Design' });

    expect(response.status).toBe(200);
    expect(response.body.data.department).toBe('Product Design');

    const audit = await asAdmin('get', `/api/admin/employees/${target}/audit-logs`);
    expect(audit.body.data[0].action).toBe('employee.updated');
    expect(audit.body.data[0].previousValues.department).toBe('Design');
    expect(audit.body.data[0].newValues.department).toBe('Product Design');
  });

  it('refuses to manage the administrator account through the employee endpoints', async () => {
    const { rows } = await ctx.db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
      ctx.demo.adminEmail,
    ]);
    const response = await asAdmin('post', `/api/admin/employees/${rows[0]!.id}/status`).send({ status: 'suspended' });
    expect(response.status).toBe(403);
  });
});

describe('invitations', () => {
  it('invites, lists, resends and cancels', async () => {
    const invited = await asAdmin('post', '/api/admin/invitations').send({
      email: 'new.joiner@example.com',
      name: 'New Joiner',
      department: 'Finance',
    });
    expect(invited.status).toBe(201);
    expect(invited.body.data.status).toBe('pending');
    expect(invited.body.data.link).toContain(invited.body.data.token);

    const duplicate = await asAdmin('post', '/api/admin/invitations').send({
      email: 'new.joiner@example.com',
      name: 'New Joiner',
    });
    expect(duplicate.status).toBe(409);

    const existing = await asAdmin('post', '/api/admin/invitations').send({
      email: ctx.demo.driverEmail,
      name: 'Ananya Bose',
    });
    expect(existing.status).toBe(409);
    expect(existing.body.error.message).toMatch(/already has an account/i);

    const firstToken = invited.body.data.token;
    const resent = await asAdmin('post', `/api/admin/invitations/${invited.body.data.id}/resend`).send({});
    expect(resent.status).toBe(200);
    expect(resent.body.data.token).not.toBe(firstToken);

    const audit = await asAdmin('get', '/api/admin/audit-logs').query({ action: 'employee.invite_resent' });
    expect(audit.body.data.items.length).toBe(1);

    // The invited employee can accept and lands active.
    const preview = await request(ctx.app).get(`/api/auth/invitations/${resent.body.data.token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.data.organizationName).toBe('Northwind Logistics');

    const accepted = await request(ctx.app).post('/api/auth/invitations/accept').send({
      token: resent.body.data.token,
      password: 'Password123!',
      phone: '+91 90000 11111',
    });
    expect(accepted.status).toBe(201);
    expect(accepted.body.data.user.status).toBe('active');
    expect(accepted.body.data.user.organizationId).toBe(ctx.demo.organizationId);

    // The token is single use.
    const replay = await request(ctx.app).post('/api/auth/invitations/accept').send({
      token: resent.body.data.token,
      password: 'Password123!',
    });
    expect(replay.status).toBe(409);
  });

  it('cancels a pending invitation', async () => {
    const list = await asAdmin('get', '/api/admin/invitations');
    const pending = list.body.data.items.find((i: { status: string }) => i.status === 'pending');

    const canceled = await asAdmin('post', `/api/admin/invitations/${pending.id}/cancel`).send({});
    expect(canceled.status).toBe(200);
    expect(canceled.body.data.status).toBe('canceled');

    const again = await asAdmin('post', `/api/admin/invitations/${pending.id}/cancel`).send({});
    expect(again.status).toBe(409);
  });

  it('imports several invitations and reports per-row outcomes', async () => {
    const response = await asAdmin('post', '/api/admin/invitations/bulk').send({
      invitations: [
        { email: 'bulk.one@example.com', name: 'Bulk One' },
        { email: 'bulk.two@example.com', name: 'Bulk Two' },
        { email: ctx.demo.driverEmail, name: 'Already Here' },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.data.invited).toBe(2);
    expect(response.body.data.failed).toBe(1);
  });
});

describe('vehicle administration', () => {
  it('enforces registration uniqueness inside the organization', async () => {
    const response = await asAdmin('post', '/api/admin/vehicles').send({
      ownerId: ctx.demo.employeeIds[0],
      make: 'Honda',
      model: 'City',
      registrationNumber: 'WB 06 AK 4412',
      vehicleType: 'sedan',
      seatingCapacity: 5,
    });
    expect(response.status).toBe(409);
  });

  it('allows the same registration number in a different organization', async () => {
    const otherAdmin = await login(ctx.app, ctx.other.adminEmail);
    const { rows } = await ctx.db.query<{ id: string }>(
      `SELECT id FROM users WHERE organization_id = $1::uuid AND role = 'employee' LIMIT 1`,
      [ctx.other.organizationId],
    );

    const response = await request(ctx.app)
      .post('/api/admin/vehicles')
      .set('authorization', `Bearer ${otherAdmin}`)
      .send({
        ownerId: rows[0]!.id,
        make: 'Honda',
        model: 'City',
        registrationNumber: 'WB 06 AK 4412',
        vehicleType: 'sedan',
        seatingCapacity: 5,
      });
    expect(response.status).toBe(201);
  });

  it('refuses an owner from another organization', async () => {
    const response = await asAdmin('post', '/api/admin/vehicles').send({
      ownerId: '00000000-0000-4000-8000-000000000000',
      make: 'Kia',
      model: 'Carens',
      registrationNumber: 'WB 99 XX 1010',
      vehicleType: 'van',
      seatingCapacity: 7,
    });
    expect(response.status).toBe(422);
  });

  it('approves a vehicle under review, audits it, and unlocks ride publishing', async () => {
    const underReview = ctx.demo.vehicleIds[4]!;
    const owner = await login(ctx.app, ctx.demo.passengerEmail);

    const blocked = await request(ctx.app)
      .post('/api/employee/rides')
      .set('authorization', `Bearer ${owner}`)
      .send({
        vehicleId: underReview,
        startLocation: 'Howrah Maidan',
        destination: 'Park Street Office',
        departureAt: new Date(Date.now() + 86_400_000).toISOString(),
        seats: 2,
        estimatedDistanceKm: 9.8,
      });
    expect(blocked.status).toBe(409);

    const approved = await asAdmin('post', `/api/admin/vehicles/${underReview}/status`).send({
      status: 'active',
      reason: 'Documents verified',
    });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('active');

    const audit = await asAdmin('get', `/api/admin/vehicles/${underReview}/audit-logs`);
    expect(audit.body.data[0].action).toBe('vehicle.status_changed');
    expect(audit.body.data[0].newValues.status).toBe('active');

    const allowed = await request(ctx.app)
      .post('/api/employee/rides')
      .set('authorization', `Bearer ${owner}`)
      .send({
        vehicleId: underReview,
        startLocation: 'Howrah Maidan',
        destination: 'Park Street Office',
        departureAt: new Date(Date.now() + 86_400_000).toISOString(),
        seats: 2,
        estimatedDistanceKm: 9.8,
      });
    expect(allowed.status).toBe(201);
  });

  it('retiring a vehicle stops new rides but keeps its history', async () => {
    const vehicleId = ctx.demo.vehicleIds[0]!;
    const before = await asAdmin('get', `/api/admin/vehicles/${vehicleId}`);
    expect(before.body.data.tripsCompleted).toBeGreaterThan(0);

    await asAdmin('post', `/api/admin/vehicles/${vehicleId}/status`).send({ status: 'inactive' });

    const driver = await login(ctx.app, ctx.demo.driverEmail);
    const blocked = await request(ctx.app)
      .post('/api/employee/rides')
      .set('authorization', `Bearer ${driver}`)
      .send({
        vehicleId,
        startLocation: 'Salt Lake Sector V',
        destination: 'Park Street Office',
        departureAt: new Date(Date.now() + 86_400_000).toISOString(),
        seats: 2,
        estimatedDistanceKm: 12,
      });
    expect(blocked.status).toBe(409);

    const after = await asAdmin('get', `/api/admin/vehicles/${vehicleId}`);
    expect(after.body.data.tripsCompleted).toBe(before.body.data.tripsCompleted);
    expect(after.body.data.totalDistanceKm).toBe(before.body.data.totalDistanceKm);

    await asAdmin('post', `/api/admin/vehicles/${vehicleId}/status`).send({ status: 'active' });
  });

  it('derives the drivers view from employees and vehicles', async () => {
    const response = await asAdmin('get', '/api/admin/drivers');
    expect(response.status).toBe(200);

    const driver = response.body.data.items.find((d: { employeeId: string }) => d.employeeId === ctx.demo.employeeIds[0]);
    expect(driver.vehicles.length).toBeGreaterThan(0);
    expect(driver.vehicles[0].registrationNumber).toBeTruthy();
    expect(driver.tripsCompleted).toBeGreaterThan(0);
    expect(driver.accountStatus).toBe('active');
  });
});

describe('organization settings', () => {
  it('saves profile and policy changes with one audit record', async () => {
    const response = await asAdmin('patch', '/api/admin/organization/settings').send({
      contactPhone: '+91 33 4000 9999',
      distanceUnit: 'km',
      vehicleApprovalRequired: false,
      defaultMileageKmpl: 16,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.organization.contactPhone).toBe('+91 33 4000 9999');
    expect(response.body.data.settings.vehicleApprovalRequired).toBe(false);
    expect(response.body.data.settings.defaultMileageKmpl).toBe(16);

    const audit = await asAdmin('get', '/api/admin/audit-logs').query({ action: 'organization.setting_changed' });
    const latest = audit.body.data.items[0];
    expect(latest.newValues.vehicleApprovalRequired).toBe(false);
    expect(latest.previousValues.vehicleApprovalRequired).toBe(true);
  });

  it('honours the approval policy for newly registered vehicles', async () => {
    const token = await login(ctx.app, 'kavya.nair@example.com');
    const response = await request(ctx.app)
      .post('/api/employee/vehicles')
      .set('authorization', `Bearer ${token}`)
      .send({
        make: 'Mahindra',
        model: 'XUV700',
        registrationNumber: 'WB 15 RR 8080',
        vehicleType: 'suv',
        seatingCapacity: 7,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('active');
  });

  it('blocks all ride publishing when carpooling is switched off', async () => {
    await asAdmin('patch', '/api/admin/organization/settings').send({ carpoolingEnabled: false });

    const driver = await login(ctx.app, ctx.demo.driverEmail);
    const response = await request(ctx.app)
      .post('/api/employee/rides')
      .set('authorization', `Bearer ${driver}`)
      .send({
        vehicleId: ctx.demo.vehicleIds[0],
        startLocation: 'Salt Lake Sector V',
        destination: 'Park Street Office',
        departureAt: new Date(Date.now() + 86_400_000).toISOString(),
        seats: 2,
        estimatedDistanceKm: 12,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/carpooling is currently disabled/i);

    await asAdmin('patch', '/api/admin/organization/settings').send({ carpoolingEnabled: true });
  });

  it('rejects invalid settings values', async () => {
    const response = await asAdmin('patch', '/api/admin/organization/settings').send({ logoUrl: 'not-a-url' });
    expect(response.status).toBe(422);
    expect(response.body.error.details.logoUrl).toBeTruthy();
  });
});

describe('cost configuration', () => {
  it('lists versions and reports the basis currently in force', async () => {
    const response = await asAdmin('get', '/api/admin/costs');
    expect(response.status).toBe(200);
    expect(response.body.data.configurations.length).toBeGreaterThanOrEqual(5);
    expect(response.body.data.current.fuelCostPerLitre).toBe(104.5);
    expect(response.body.data.current.travelCostPerKm).toBe(2.2);

    const currentVersions = response.body.data.configurations.filter((c: { isCurrent: boolean }) => c.isCurrent);
    expect(currentVersions).toHaveLength(2);
  });

  it('publishing a new version closes the previous one and writes an audit record', async () => {
    const created = await asAdmin('post', '/api/admin/costs').send({
      type: 'fuel_price',
      value: 109.9,
      unit: 'per litre',
      currency: 'INR',
      mileageKmpl: 15.5,
      effectiveFrom: new Date().toISOString(),
      note: 'Price revision',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.effectiveUntil).toBeNull();
    expect(created.body.data.isCurrent).toBe(true);

    const list = await asAdmin('get', '/api/admin/costs');
    const openFuelVersions = list.body.data.configurations.filter(
      (c: { type: string; effectiveUntil: string | null }) => c.type === 'fuel_price' && c.effectiveUntil === null,
    );
    expect(openFuelVersions).toHaveLength(1);
    expect(list.body.data.current.fuelCostPerLitre).toBe(109.9);

    const audit = await asAdmin('get', '/api/admin/audit-logs').query({ action: 'cost_configuration.created' });
    expect(audit.body.data.items[0].newValues.value).toBe(109.9);
  });

  it('requires fuel efficiency for a fuel price version', async () => {
    const response = await asAdmin('post', '/api/admin/costs').send({
      type: 'fuel_price',
      value: 111,
      unit: 'per litre',
      currency: 'INR',
      effectiveFrom: new Date().toISOString(),
    });
    expect(response.status).toBe(422);
    expect(response.body.error.details.mileageKmpl).toBeTruthy();
  });

  it('rejects an end date before the start date', async () => {
    const response = await asAdmin('post', '/api/admin/costs').send({
      type: 'travel_cost',
      value: 3,
      unit: 'per km',
      currency: 'INR',
      effectiveFrom: '2026-05-01',
      effectiveUntil: '2026-04-01',
    });
    expect(response.status).toBe(422);
  });

  it('closes an open version instead of editing it', async () => {
    const list = await asAdmin('get', '/api/admin/costs');
    const open = list.body.data.configurations.find(
      (c: { type: string; effectiveUntil: string | null }) => c.type === 'travel_cost' && c.effectiveUntil === null,
    );

    const closed = await asAdmin('post', `/api/admin/costs/${open.id}/close`).send({});
    expect(closed.status).toBe(200);
    expect(closed.body.data.effectiveUntil).not.toBeNull();

    const again = await asAdmin('post', `/api/admin/costs/${open.id}/close`).send({});
    expect(again.status).toBe(409);
  });
});
