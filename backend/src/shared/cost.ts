import { COST_CONFIG_TYPE } from '@carpool/shared';
import { num, round2, type Queryable } from '../database/client.js';

/**
 * Cost engine.
 *
 * A trip's cost is derived from the cost configuration that was *effective at
 * the moment the trip started*, then frozen onto the trip row. Editing today's
 * fuel price must never move yesterday's numbers.
 *
 *   fuel litres = distance / mileage
 *   fuel cost   = fuel litres x fuel price per litre
 *   running cost = distance x travel cost per km   (non-fuel wear, tolls, etc.)
 *   total cost  = fuel cost + running cost
 *   cost per km = total cost / distance
 */
export interface CostBasis {
  fuelCostPerLitre: number;
  travelCostPerKm: number;
  mileageKmpl: number;
  currency: string;
  costConfigurationId: string | null;
}

export interface CostBreakdown {
  fuelLitres: number;
  fuelCost: number;
  runningCost: number;
  totalCost: number;
  costPerKm: number;
}

interface OrgDefaultsRow {
  fuel_cost_per_litre: unknown;
  travel_cost_per_km: unknown;
  default_mileage_kmpl: unknown;
  currency: string;
}

/** Resolves the configuration in force at `at`, falling back to org settings. */
export async function resolveCostBasis(db: Queryable, organizationId: string, at: Date = new Date()): Promise<CostBasis> {
  const defaults = await db.query<OrgDefaultsRow>(
    `SELECT s.fuel_cost_per_litre, s.travel_cost_per_km, s.default_mileage_kmpl, o.currency
       FROM org_settings s
       JOIN organizations o ON o.id = s.organization_id
      WHERE s.organization_id = $1::uuid`,
    [organizationId],
  );

  const base = defaults.rows[0];
  const basis: CostBasis = {
    fuelCostPerLitre: num(base?.fuel_cost_per_litre),
    travelCostPerKm: num(base?.travel_cost_per_km),
    mileageKmpl: num(base?.default_mileage_kmpl, 12),
    currency: base?.currency?.trim() || 'INR',
    costConfigurationId: null,
  };

  const { rows } = await db.query<{
    id: string;
    type: string;
    value: unknown;
    mileage_kmpl: unknown;
    currency: string;
  }>(
    `SELECT id, type, value, mileage_kmpl, currency
       FROM cost_configurations
      WHERE organization_id = $1::uuid
        AND effective_from <= $2::timestamptz
        AND (effective_until IS NULL OR effective_until > $2::timestamptz)
      ORDER BY effective_from DESC`,
    [organizationId, at.toISOString()],
  );

  // Most recent effective row per type wins.
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.type)) continue;
    seen.add(row.type);
    if (row.type === COST_CONFIG_TYPE.FUEL_PRICE) {
      basis.fuelCostPerLitre = num(row.value, basis.fuelCostPerLitre);
      if (row.mileage_kmpl !== null && row.mileage_kmpl !== undefined) {
        basis.mileageKmpl = num(row.mileage_kmpl, basis.mileageKmpl);
      }
      basis.costConfigurationId = row.id;
      basis.currency = row.currency?.trim() || basis.currency;
    }
    if (row.type === COST_CONFIG_TYPE.TRAVEL_COST) {
      basis.travelCostPerKm = num(row.value, basis.travelCostPerKm);
      basis.costConfigurationId = basis.costConfigurationId ?? row.id;
    }
  }

  if (basis.mileageKmpl <= 0) basis.mileageKmpl = 12;
  return basis;
}

export function computeCost(distanceKm: number, basis: CostBasis): CostBreakdown {
  const distance = Math.max(0, distanceKm);
  const fuelLitres = basis.mileageKmpl > 0 ? distance / basis.mileageKmpl : 0;
  const fuelCost = fuelLitres * basis.fuelCostPerLitre;
  const runningCost = distance * basis.travelCostPerKm;
  const totalCost = fuelCost + runningCost;
  return {
    fuelLitres: round2(fuelLitres),
    fuelCost: round2(fuelCost),
    runningCost: round2(runningCost),
    totalCost: round2(totalCost),
    costPerKm: distance > 0 ? round2(totalCost / distance) : 0,
  };
}

/**
 * Per-seat estimate shown while a ride is still open: the driver counts as one
 * occupant, so the cost is spread across the driver plus every offered seat.
 */
export function costPerSeat(totalCost: number, offeredSeats: number): number {
  const occupants = Math.max(1, offeredSeats + 1);
  return round2(totalCost / occupants);
}

/**
 * Settlement split for a completed trip. The driver bears one occupant's
 * share; each passenger pays for the seats they actually occupied.
 */
export function splitTripCost(
  totalCost: number,
  passengers: Array<{ userId: string; seats: number }>,
): { driverShare: number; passengerShares: Array<{ userId: string; seats: number; amount: number }> } {
  const passengerSeats = passengers.reduce((sum, p) => sum + p.seats, 0);
  const occupants = passengerSeats + 1; // + driver
  const perOccupant = totalCost / occupants;

  const passengerShares = passengers.map((p) => ({
    userId: p.userId,
    seats: p.seats,
    amount: round2(perOccupant * p.seats),
  }));

  const distributed = passengerShares.reduce((sum, p) => sum + p.amount, 0);
  return { driverShare: round2(Math.max(0, totalCost - distributed)), passengerShares };
}
