import { PageHeader } from '@/components/layout/PageHeader';
import { LeadTestingModuleNav } from '@/components/LeadTestingModuleNav';
import { BulkSampling } from '@/components/BulkSampling';
export default function LeadTestingSampling(){return <div className="page-shell"><PageHeader title="Sampling" subtitle="Document lead sampling for existing fixtures" backTo="/lead-testing"/><LeadTestingModuleNav/><BulkSampling/></div>}
