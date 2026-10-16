import { AutomationForm } from '@/components/AutomationForm';
import { PageHeader } from '@/components/ui';
import { DEFAULTS } from '@/lib/automationDefaults';
import { loadMedia } from '../media';

export default async function NewAutomationPage() {
  const media = await loadMedia();
  return (
    <>
      <PageHeader title="Neue Automation" description="Stichwort unter einem Beitrag → automatische DM → Lead-Magnet." />
      <AutomationForm id={null} initial={DEFAULTS} media={media} />
    </>
  );
}
