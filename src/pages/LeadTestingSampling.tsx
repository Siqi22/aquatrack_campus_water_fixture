import { PageHeader } from '@/components/layout/PageHeader';
import { LeadTestingModuleNav } from '@/components/LeadTestingModuleNav';
import { BulkSampling } from '@/components/BulkSampling';
import { useFixtureStore } from '@/store/fixtureStore';
import { useOrganization } from '@/contexts/OrganizationContext';
import { resolveWorkspaceSchoolDistrict } from '@/lib/schoolDistrict';

export default function LeadTestingSampling(){const{campuses}=useFixtureStore();const{organizationName}=useOrganization();const districtName=resolveWorkspaceSchoolDistrict(campuses,organizationName);return <div className="page-shell max-w-4xl"><PageHeader title={`Lead Sampling for ${districtName}`} subtitle="Document lead sampling for fixtures"/><LeadTestingModuleNav/><BulkSampling/></div>}
