import { createContext, useContext, type ReactNode } from 'react';
import { VEHICLE_STATUS, type Vehicle } from '@carpool/shared';
import { api } from './api';
import { useApi } from './hooks';

/**
 * Driver is not a separate account. An employee gains the driver panel only
 * once they own an approved, active vehicle — so panel availability is derived
 * from the vehicle register rather than stored on the user.
 *
 * The result is shared through context so the layout, the panel switch and the
 * driver guards all read the same answer and refresh together the moment an
 * administrator approves a vehicle.
 */
interface PanelAccess {
  vehicles: Vehicle[];
  /** At least one vehicle exists, whatever its status. */
  hasVehicle: boolean;
  /** At least one ACTIVE vehicle — the condition for the driver panel. */
  hasDriverContext: boolean;
  /** A vehicle is sitting with the administrator. */
  awaitingApproval: boolean;
  loading: boolean;
  reload: () => void;
}

const PanelAccessContext = createContext<PanelAccess>({
  vehicles: [],
  hasVehicle: false,
  hasDriverContext: false,
  awaitingApproval: false,
  loading: true,
  reload: () => {},
});

export function PanelAccessProvider({ children }: { children: ReactNode }) {
  const vehicles = useApi(() => api.employee.vehicles.list(), []);
  const list = vehicles.data ?? [];

  const value: PanelAccess = {
    vehicles: list,
    hasVehicle: list.length > 0,
    hasDriverContext: list.some((vehicle) => vehicle.status === VEHICLE_STATUS.ACTIVE),
    awaitingApproval: list.some((vehicle) => vehicle.status === VEHICLE_STATUS.UNDER_REVIEW),
    loading: vehicles.initialLoading,
    reload: vehicles.reload,
  };

  return <PanelAccessContext.Provider value={value}>{children}</PanelAccessContext.Provider>;
}

export function usePanelAccess(): PanelAccess {
  return useContext(PanelAccessContext);
}
