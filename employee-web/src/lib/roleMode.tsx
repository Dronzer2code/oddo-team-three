import { createContext, useContext, useState, type ReactNode } from 'react';

export type RoleMode = 'passenger' | 'driver';

interface RoleModeContextType {
  roleMode: RoleMode;
  setRoleMode: (mode: RoleMode) => void;
  isDriverMode: boolean;
  isPassengerMode: boolean;
}

const RoleModeContext = createContext<RoleModeContextType>({
  roleMode: 'passenger',
  setRoleMode: () => {},
  isDriverMode: false,
  isPassengerMode: true,
});

export function RoleModeProvider({ children }: { children: ReactNode }) {
  const [roleMode, setRoleModeState] = useState<RoleMode>(() => {
    const saved = localStorage.getItem('employee_role_mode');
    return (saved === 'driver' ? 'driver' : 'passenger') as RoleMode;
  });

  const setRoleMode = (mode: RoleMode) => {
    setRoleModeState(mode);
    localStorage.setItem('employee_role_mode', mode);
  };

  return (
    <RoleModeContext.Provider
      value={{
        roleMode,
        setRoleMode,
        isDriverMode: roleMode === 'driver',
        isPassengerMode: roleMode === 'passenger',
      }}
    >
      {children}
    </RoleModeContext.Provider>
  );
}

export function useRoleMode() {
  return useContext(RoleModeContext);
}
