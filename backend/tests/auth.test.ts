import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createTestContext, login, type TestContext } from './helpers.js';
import { env } from '../src/config/env.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.db.close();
});

describe('authentication', () => {
  it('rejects unauthenticated access to protected routes', async () => {
    for (const path of ['/api/employee/home', '/api/employee/rides', '/api/admin/dashboard', '/api/admin/employees']) {
      const response = await request(ctx.app).get(path);
      expect(response.status, path).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('rejects a wrong password without revealing whether the account exists', async () => {
    const known = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: ctx.demo.adminEmail, password: 'not-the-password' });
    const unknown = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'not-the-password' });

    expect(known.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(known.body.error.message).toBe(unknown.body.error.message);
  });

  it('signs an admin in and reports the resolved organization', async () => {
    const response = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: ctx.demo.adminEmail, password: ctx.demo.password });

    expect(response.status).toBe(200);
    expect(response.body.data.user.role).toBe('admin');
    expect(response.body.data.user.organizationId).toBe(ctx.demo.organizationId);
    expect(response.body.data.token).toBeTruthy();
  });

  it('stops employees from reaching admin routes', async () => {
    const token = await login(ctx.app, ctx.demo.driverEmail);
    const response = await request(ctx.app).get('/api/admin/employees').set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    // The failure is explicit, not hidden behind a generic error.
    expect(response.body.error.message).toMatch(/administrator/i);
  });

  it('stops admins from reaching employee ride operations', async () => {
    const token = await login(ctx.app, ctx.demo.adminEmail);
    const response = await request(ctx.app).get('/api/employee/rides').set('authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it('blocks protected actions for a suspended employee but still allows reading the profile', async () => {
    const token = await login(ctx.app, ctx.demo.suspendedEmail);

    const profile = await request(ctx.app).get('/api/employee/profile').set('authorization', `Bearer ${token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.status).toBe('suspended');

    const publish = await request(ctx.app)
      .post('/api/employee/rides')
      .set('authorization', `Bearer ${token}`)
      .send({
        vehicleId: ctx.demo.vehicleIds[0],
        startLocation: 'A',
        destination: 'B',
        departureAt: new Date(Date.now() + 86_400_000).toISOString(),
        seats: 2,
        estimatedDistanceKm: 10,
      });

    expect(publish.status).toBe(403);
    expect(publish.body.error.code).toBe('ACCOUNT_NOT_OPERATIONAL');
    expect(publish.body.error.message).toMatch(/suspended/i);
  });

  it('blocks protected actions for a pending employee', async () => {
    const token = await login(ctx.app, ctx.demo.pendingEmail);
    const response = await request(ctx.app)
      .post('/api/employee/vehicles')
      .set('authorization', `Bearer ${token}`)
      .send({
        make: 'Kia',
        model: 'Seltos',
        registrationNumber: 'WB 11 ZZ 0001',
        vehicleType: 'suv',
        seatingCapacity: 5,
      });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCOUNT_NOT_OPERATIONAL');
  });

  it('rejects an expired session', async () => {
    const { rows } = await ctx.db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
      ctx.demo.adminEmail,
    ]);
    const expired = jwt.sign({ sub: rows[0]!.id, org: ctx.demo.organizationId, role: 'admin' }, env.jwtSecret, {
      expiresIn: -10,
    });

    const response = await request(ctx.app).get('/api/admin/dashboard').set('authorization', `Bearer ${expired}`);
    expect(response.status).toBe(401);
    expect(response.body.error.message).toMatch(/expired/i);
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ sub: ctx.demo.employeeIds[0], org: ctx.demo.organizationId, role: 'admin' }, 'wrong');
    const response = await request(ctx.app).get('/api/admin/dashboard').set('authorization', `Bearer ${forged}`);
    expect(response.status).toBe(401);
  });

  it('refuses a token whose role claim was tampered with', async () => {
    // Same user, but claiming to be an admin.
    const forged = jwt.sign(
      { sub: ctx.demo.employeeIds[0], org: ctx.demo.organizationId, role: 'admin' },
      env.jwtSecret,
    );
    const response = await request(ctx.app).get('/api/admin/dashboard').set('authorization', `Bearer ${forged}`);
    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/access level changed/i);
  });

  it('refuses a token whose organization claim was tampered with', async () => {
    const forged = jwt.sign(
      { sub: ctx.demo.employeeIds[0], org: ctx.other.organizationId, role: 'employee' },
      env.jwtSecret,
    );
    const response = await request(ctx.app).get('/api/employee/home').set('authorization', `Bearer ${forged}`);
    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/organization mismatch/i);
  });

  it('registers a new employee as pending, not active', async () => {
    const response = await request(ctx.app).post('/api/auth/register').send({
      organizationSlug: ctx.demo.slug,
      name: 'Arjun Pillai',
      email: 'arjun.pillai@example.com',
      password: 'Password123!',
      department: 'Engineering',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.status).toBe('pending');
    expect(response.body.data.user.organizationId).toBe(ctx.demo.organizationId);
  });

  it('rejects registration against an unknown organization code', async () => {
    const response = await request(ctx.app).post('/api/auth/register').send({
      organizationSlug: 'does-not-exist',
      name: 'Nobody Here',
      email: 'nobody.here@example.com',
      password: 'Password123!',
    });
    expect(response.status).toBe(404);
  });

  it('changes a password and invalidates the old one', async () => {
    const token = await login(ctx.app, ctx.demo.passengerEmail);

    const wrong = await request(ctx.app)
      .post('/api/auth/change-password')
      .set('authorization', `Bearer ${token}`)
      .send({ currentPassword: 'nope-nope', newPassword: 'BrandNewPass1!' });
    expect(wrong.status).toBe(422);

    const changed = await request(ctx.app)
      .post('/api/auth/change-password')
      .set('authorization', `Bearer ${token}`)
      .send({ currentPassword: ctx.demo.password, newPassword: 'BrandNewPass1!' });
    expect(changed.status).toBe(200);

    const oldLogin = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: ctx.demo.passengerEmail, password: ctx.demo.password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: ctx.demo.passengerEmail, password: 'BrandNewPass1!' });
    expect(newLogin.status).toBe(200);
  });
});
