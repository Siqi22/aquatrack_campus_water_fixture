import { PageHeader } from '@/components/layout/PageHeader';
import { LeadTestingModuleNav } from '@/components/LeadTestingModuleNav';
import { BulkSampling } from '@/components/BulkSampling';

export default function LeadTestingSampling(){return <div className="page-shell"><PageHeader title="Record Lead Sampling Events" subtitle="Select fixtures and record collection details"/><LeadTestingModuleNav/><BulkSampling/></div>}
