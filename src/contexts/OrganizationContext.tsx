import { createContext, ReactNode, useContext } from 'react';

export type OrganizationMode = 'uw' | 'school_district';

interface OrganizationContextValue {
  organizationMode: OrganizationMode;
  isSchoolDistrict: boolean;
  organizationName: string;
  locationLabel: string;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const organizationMode: OrganizationMode = 'school_district';
  const isSchoolDistrict = true;
  return (
    <OrganizationContext.Provider
      value={{
        organizationMode,
        isSchoolDistrict,
        organizationName: 'School District',
        locationLabel: 'School',
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
