import { PageHeader } from '@/components/layout/PageHeader';
import { LeadTestingModuleNav } from '@/components/LeadTestingModuleNav';
import { BulkSampling } from '@/components/BulkSampling';
export default function LeadTestingSampling(){return <div className="page-shell max-w-4xl"><PageHeader title="Sampling" subtitle="Document lead sampling for fixtures"/><LeadTestingModuleNav/><BulkSampling/></div>}
