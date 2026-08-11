import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { LeadTestingModuleNav } from '@/components/LeadTestingModuleNav';
import { LeadReportUpload } from '@/components/LeadReportUpload';

export default function LeadTestingUpload(){const navigate=useNavigate();const[params]=useSearchParams();const reviewUnresolved=params.get('review')==='unresolved';return <div className="page-shell"><PageHeader title={reviewUnresolved?'Unresolved Lead Testing Matches':'Record Lead Testing Results'} subtitle={reviewUnresolved?'Review and confirm unmatched laboratory results':'Extract, match, review, and import laboratory results'}/><LeadTestingModuleNav/><LeadReportUpload reviewUnresolved={reviewUnresolved} onImported={()=>navigate('/lead-testing/results')}/></div>}
