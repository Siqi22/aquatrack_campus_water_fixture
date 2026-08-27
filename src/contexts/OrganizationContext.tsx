import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFixtureStore } from '@/store/fixtureStore';

export type OrganizationMode = 'uw' | 'school_district';

interface OrganizationContextValue {
  organizationMode: OrganizationMode;
  isSchoolDistrict: boolean;
  organizationName: string;
  districtId: string | null;
  locationLabel: string;
  loading: boolean;
  accessError: string | null;
  reloadDistrict: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const loadAll = useFixtureStore((state) => state.loadAll);
  const reset = useFixtureStore((state) => state.reset);
  const organizationMode: OrganizationMode = 'school_district';
  const isSchoolDistrict = true;
  const [organizationName, setOrganizationName] = useState('School District');
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const reloadDistrict = useCallback(async () => {
    if (!session) {
      setDistrictId(null);
      setOrganizationName('School District');
      setAccessError(null);
      setLoading(false);
      reset();
      return;
    }

    setLoading(true);
    setAccessError(null);
    const { data, error } = await supabase.rpc('current_user_district');
    const district = data?.[0];

    if (error) {
      setDistrictId(null);
      reset();
      setAccessError(error.message);
      setLoading(false);
      return;
    }
    if (!district?.district_id) {
      setDistrictId(null);
      reset();
      setAccessError('Your account has not been assigned to a school district. Contact an administrator.');
      setLoading(false);
      return;
    }

    setDistrictId(district.district_id);
    setOrganizationName(district.district_name);
    await loadAll(organizationMode, district.district_id, district.district_name);
    setLoading(false);
  }, [loadAll, organizationMode, reset, session]);

  useEffect(() => {
    void reloadDistrict();
  }, [reloadDistrict]);

  return (
    <OrganizationContext.Provider
      value={{
        organizationMode,
        isSchoolDistrict,
        organizationName,
        districtId,
        locationLabel: 'School',
        loading,
        accessError,
        reloadDistrict,
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
