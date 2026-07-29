import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { LeadTestingModuleNav } from '@/components/LeadTestingModuleNav';
import { LeadReportUpload } from '@/components/LeadReportUpload';

export default function LeadTestingUpload(){const navigate=useNavigate();const[params]=useSearchParams();const reviewUnresolved=params.get('review')==='unresolved';return <div className="page-shell max-w-5xl"><PageHeader title={reviewUnresolved?'Unresolved Matches':'Upload Test Report'} subtitle={reviewUnresolved?'Review and confirm unmatched laboratory results':'Extract, match, review, and import laboratory results'}/><LeadTestingModuleNav/><LeadReportUpload reviewUnresolved={reviewUnresolved} onImported={()=>navigate('/lead-testing/results')}/></div>}
