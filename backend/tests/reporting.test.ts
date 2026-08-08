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

const asAdmin = (path: string) => request(ctx.app).get(path).set('authorization', `Bearer ${admin}`);

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe('dashboard', () => {
  it('reports real counts from the database', async () => {
    const response = await asAdmin('/api/admin/dashboard');
    expect(response.status).toBe(200);

    const data = response.body.data;
    const dbCounts = await ctx.db.query<Record<string, unknown>>(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE organization_id = $1::uuid AND role = 'employee') AS employees,
         (SELECT COUNT(*) FROM vehicles WHERE organization_id = $1::uuid) AS vehicles,
         (SELECT COUNT(*) FROM trips WHERE organization_id = $1::uuid AND status = 'completed') AS trips`,
      [ctx.demo.organizationId],
    );

    expect(data.employees.total).toBe(Number(dbCounts.rows[0]!.employees));
    expect(data.vehicles.total).toBe(Number(dbCounts.rows[0]!.vehicles));
    expect(data.trips.completed).toBe(Number(dbCounts.rows[0]!.trips));
    expect(data.cost.currency).toBe('INR');
    expect(data.cost.perKm).toBeCloseTo(data.cost.total / data.distance.totalKm, 1);
    expect(data.participation.participationRate).toBeGreaterThan(0);
  });

  it('returns a six month trend and recent activity separately', async () => {
    const trend = await asAdmin('/api/admin/dashboard/trend');
    expect(trend.status).toBe(200);
    expect(trend.body.data).toHaveLength(6);
    expect(trend.body.data.some((point: { trips: number }) => point.trips > 0)).toBe(true);

    const activity = await asAdmin('/api/admin/dashboard/activity');
    expect(activity.status).toBe(200);
    expect(activity.body.data.length).toBeGreaterThan(0);
    expect(activity.body.data[0].action).toBeTruthy();
  });
});

describe('reports', () => {
  it('never counts canceled rides or canceled trips as completed trips', async () => {
    const response = await asAdmin('/api/admin/reports').query({ from: '2000-01-01', to: ymd(new Date()) });
    const totals = response.body.data.totals;

    const dbCounts = await ctx.db.query<Record<string, unknown>>(
      `SELECT
         (SELECT COUNT(*) FROM trips WHERE organization_id = $1::uuid AND status = 'completed') AS completed,
         (SELECT COUNT(*) FROM rides WHERE organization_id = $1::uuid AND status = 'canceled') AS canceled_rides`,
      [ctx.demo.organizationId],
    );

    expect(totals.completedTrips).toBe(Number(dbCounts.rows[0]!.completed));
    expect(totals.canceledRides).toBe(Number(dbCounts.rows[0]!.canceled_rides));
    expect(totals.canceledRides).toBeGreaterThan(0);
    expect(totals.canceledTrips).toBe(0);
  });

  it('totals distance, fuel and cost consistently', async () => {
    const response = await asAdmin('/api/admin/reports').query({ from: '2000-01-01', to: ymd(new Date()) });
    const totals = response.body.data.totals;

    const sums = await ctx.db.query<Record<string, unknown>>(
      `SELECT COALESCE(SUM(distance_km),0) AS distance, COALESCE(SUM(fuel_consumed_litres),0) AS fuel,
              COALESCE(SUM(total_cost),0) AS cost
         FROM trips WHERE organization_id = $1::uuid AND status = 'completed'`,
      [ctx.demo.organizationId],
    );

    expect(totals.distanceKm).toBeCloseTo(Number(sums.rows[0]!.distance), 1);
    expect(totals.fuelLitres).toBeCloseTo(Number(sums.rows[0]!.fuel), 1);
    expect(totals.totalCost).toBeCloseTo(Number(sums.rows[0]!.cost), 1);
    expect(totals.costPerKm).toBeCloseTo(totals.totalCost / totals.distanceKm, 2);

    // Vehicle rows must add up to the same totals.
    const vehicleDistance = response.body.data.vehicles.reduce(
      (sum: number, v: { distanceKm: number }) => sum + v.distanceKm,
      0,
    );
    expect(vehicleDistance).toBeCloseTo(totals.distanceKm, 0);
  });

  it('applies the effective cost configuration per trip, not today price', async () => {
    // Trips older than 30 days were priced at 101.20 or 96.40 per litre.
    const { rows } = await ctx.db.query<Record<string, unknown>>(
      `SELECT DISTINCT cost_snapshot->>'fuelCostPerLitre' AS fuel
         FROM trips WHERE organization_id = $1::uuid AND status = 'completed'`,
      [ctx.demo.organizationId],
    );
    const prices = rows.map((r) => Number(r.fuel)).sort((a, b) => a - b);
    expect(prices.length).toBeGreaterThan(1);
    expect(prices).toContain(104.5);

    // Each trip's stored cost must match its own snapshot, not the live config.
    const mismatches = await ctx.db.query<{ total: unknown }>(
      `SELECT COUNT(*) AS total FROM trips
        WHERE organization_id = $1::uuid AND status = 'completed'
          AND abs(total_cost - (
                distance_km / (cost_snapshot->>'mileageKmpl')::numeric * (cost_snapshot->>'fuelCostPerLitre')::numeric
                + distance_km * (cost_snapshot->>'travelCostPerKm')::numeric
              )) > 0.05`,
      [ctx.demo.organizationId],
    );
    expect(Number(mismatches.rows[0]!.total)).toBe(0);
  });

  it('keeps historical trip figures unchanged after a cost configuration change', async () => {
    const before = await asAdmin('/api/admin/reports').query({ from: '2000-01-01', to: ymd(new Date()) });

    const published = await request(ctx.app)
      .post('/api/admin/costs')
      .set('authorization', `Bearer ${admin}`)
      .send({
        type: 'fuel_price',
        value: 250,
        unit: 'per litre',
        currency: 'INR',
        mileageKmpl: 8,
        effectiveFrom: new Date().toISOString(),
        note: 'Deliberate spike to prove history is immutable',
      });
    expect(published.status).toBe(201);

    const after = await asAdmin('/api/admin/reports').query({ from: '2000-01-01', to: ymd(new Date()) });
    expect(after.body.data.totals.totalCost).toBe(before.body.data.totals.totalCost);
    expect(after.body.data.totals.fuelLitres).toBe(before.body.data.totals.fuelLitres);
    expect(after.body.data.totals.costPerKm).toBe(before.body.data.totals.costPerKm);
  });

  it('includes both range boundaries', async () => {
    const { rows } = await ctx.db.query<{ completed_at: unknown }>(
      `SELECT completed_at FROM trips
        WHERE organization_id = $1::uuid AND status = 'completed'
        ORDER BY completed_at DESC LIMIT 1`,
      [ctx.demo.organizationId],
    );
    const latest = new Date(String(rows[0]!.completed_at));
    const day = ymd(latest);

    // A single-day window that starts and ends on that day must find the trip,
    // even though it completed part-way through the day.
    const sameDay = await asAdmin('/api/admin/reports').query({ from: day, to: day });
    expect(sameDay.body.data.totals.completedTrips).toBeGreaterThan(0);

    // The day before must not include it.
    const dayBefore = ymd(new Date(latest.getTime() - 24 * 60 * 60 * 1000));
    const previous = await asAdmin('/api/admin/reports').query({ from: dayBefore, to: dayBefore });
    const sameDayCount = sameDay.body.data.totals.completedTrips;
    const previousCount = previous.body.data.totals.completedTrips;
    expect(previousCount).toBeLessThan(sameDayCount + 1);

    const twoDays = await asAdmin('/api/admin/reports').query({ from: dayBefore, to: day });
    expect(twoDays.body.data.totals.completedTrips).toBe(sameDayCount + previousCount);
  });

  it('filters by vehicle, driver and department', async () => {
    const all = await asAdmin('/api/admin/reports').query({ from: '2000-01-01', to: ymd(new Date()) });

    const vehicleId = all.body.data.vehicles[0].vehicleId;
    const byVehicle = await asAdmin('/api/admin/reports').query({
      from: '2000-01-01',
      to: ymd(new Date()),
      vehicleId,
    });
    expect(byVehicle.body.data.vehicles).toHaveLength(1);
    expect(byVehicle.body.data.totals.completedTrips).toBeLessThan(all.body.data.totals.completedTrips);
    expect(byVehicle.body.data.filters.vehicleId).toBe(vehicleId);

    const driverId = all.body.data.drivers[0].driverId;
    const byDriver = await asAdmin('/api/admin/reports').query({
      from: '2000-01-01',
      to: ymd(new Date()),
      driverId,
    });
    expect(byDriver.body.data.drivers).toHaveLength(1);
    expect(byDriver.body.data.drivers[0].driverId).toBe(driverId);

    const byDepartment = await asAdmin('/api/admin/reports').query({
      from: '2000-01-01',
      to: ymd(new Date()),
      department: 'Engineering',
    });
    expect(byDepartment.body.data.totals.completedTrips).toBeGreaterThan(0);
    expect(byDepartment.body.data.totals.completedTrips).toBeLessThanOrEqual(all.body.data.totals.completedTrips);
  });

  it('computes fuel efficiency per vehicle', async () => {
    const response = await asAdmin('/api/admin/reports').query({ from: '2000-01-01', to: ymd(new Date()) });
    for (const vehicle of response.body.data.vehicles) {
      if (vehicle.fuelLitres > 0) {
        expect(vehicle.efficiencyKmpl).toBeCloseTo(vehicle.distanceKm / vehicle.fuelLitres, 1);
        expect(vehicle.costPerKm).toBeCloseTo(vehicle.cost / vehicle.distanceKm, 1);
      }
    }
  });
});

describe('participation', () => {
  it('counts publishers, requesters and completers within the period', async () => {
    const response = await asAdmin('/api/admin/participation').query({ from: '2000-01-01', to: ymd(new Date()) });
    expect(response.status).toBe(200);

    const data = response.body.data;
    expect(data.totalEmployees).toBeGreaterThan(0);
    expect(data.activeParticipants).toBeGreaterThan(0);
    expect(data.activeParticipants).toBeLessThanOrEqual(data.totalEmployees);
    expect(data.participationRate).toBeCloseTo((data.activeParticipants / data.totalEmployees) * 100, 1);
    expect(data.publishers).toBeGreaterThan(0);
    expect(data.requesters).toBeGreaterThan(0);
    expect(data.completers).toBeGreaterThan(0);
    expect(data.weekly).toHaveLength(8);
    expect(data.monthly).toHaveLength(6);
    expect(data.topParticipants.length).toBeGreaterThan(0);
  });

  it('reports nobody active for a period with no activity', async () => {
    const response = await asAdmin('/api/admin/participation').query({ from: '2001-01-01', to: '2001-01-31' });
    expect(response.body.data.activeParticipants).toBe(0);
    expect(response.body.data.participationRate).toBe(0);
    expect(response.body.data.publishers).toBe(0);
  });
});

describe('audit log', () => {
  it('filters by action, entity and date, and paginates', async () => {
    const all = await asAdmin('/api/admin/audit-logs');
    expect(all.status).toBe(200);
    expect(all.body.data.pagination.total).toBeGreaterThan(0);

    const actions = await asAdmin('/api/admin/audit-logs/actions');
    expect(actions.body.data).toContain('organization.setting_changed');

    const filtered = await asAdmin('/api/admin/audit-logs').query({ action: 'employee.suspended' });
    expect(filtered.body.data.items.every((e: { action: string }) => e.action === 'employee.suspended')).toBe(true);

    const byEntity = await asAdmin('/api/admin/audit-logs').query({ entityType: 'vehicle' });
    expect(byEntity.body.data.items.every((e: { entityType: string }) => e.entityType === 'vehicle')).toBe(true);

    const today = await asAdmin('/api/admin/audit-logs').query({ from: ymd(new Date()), to: ymd(new Date()) });
    expect(today.body.data.items.length).toBeGreaterThan(0);

    const paged = await asAdmin('/api/admin/audit-logs').query({ page: 1, pageSize: 2 });
    expect(paged.body.data.items).toHaveLength(2);
    expect(paged.body.data.pagination.pageSize).toBe(2);
  });
});
