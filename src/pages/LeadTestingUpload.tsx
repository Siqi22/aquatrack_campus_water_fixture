import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { LeadTestingModuleNav } from '@/components/LeadTestingModuleNav';
import { LeadReportUpload } from '@/components/LeadReportUpload';
import { useFixtureStore } from '@/store/fixtureStore';
import { useOrganization } from '@/contexts/OrganizationContext';
import { resolveWorkspaceSchoolDistrict } from '@/lib/schoolDistrict';

export default function LeadTestingUpload(){const navigate=useNavigate();const[params]=useSearchParams();const{campuses}=useFixtureStore();const{organizationName}=useOrganization();const districtName=resolveWorkspaceSchoolDistrict(campuses,organizationName);const reviewUnresolved=params.get('review')==='unresolved';return <div className="page-shell max-w-5xl"><PageHeader title={reviewUnresolved?`Unresolved Lead Testing Matches for ${districtName}`:`Record Lead Testing Results for ${districtName}`} subtitle={reviewUnresolved?'Review and confirm unmatched laboratory results':'Extract, match, review, and import laboratory results'}/><LeadTestingModuleNav/><LeadReportUpload reviewUnresolved={reviewUnresolved} onImported={()=>navigate('/lead-testing/results')}/></div>}
