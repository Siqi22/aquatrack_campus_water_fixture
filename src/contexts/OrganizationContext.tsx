import { createContext, ReactNode, useContext, useState } from 'react';

export type OrganizationMode = 'uw' | 'school_district';

const STORAGE_KEY = 'aquatrack.organization-mode';

interface OrganizationContextValue {
  organizationMode: OrganizationMode;
  setOrganizationMode: (mode: OrganizationMode) => void;
  isSchoolDistrict: boolean;
  organizationName: string;
  locationLabel: string;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

function getSavedMode(): OrganizationMode {
  if (typeof window === 'undefined') return 'uw';
  return window.localStorage.getItem(STORAGE_KEY) === 'school_district' ? 'school_district' : 'uw';
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizationMode, setMode] = useState<OrganizationMode>(getSavedMode);

  function setOrganizationMode(mode: OrganizationMode) {
    window.localStorage.setItem(STORAGE_KEY, mode);
    setMode(mode);
  }

  const isSchoolDistrict = organizationMode === 'school_district';
  return (
    <OrganizationContext.Provider
      value={{
        organizationMode,
        setOrganizationMode,
        isSchoolDistrict,
        organizationName: isSchoolDistrict ? 'School District' : 'University of Washington',
        locationLabel: isSchoolDistrict ? 'School' : 'Campus',
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useOrganization must be used within OrganizationProvider');
  return context;
}
