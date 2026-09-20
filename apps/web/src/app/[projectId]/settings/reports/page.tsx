import { ReportScheduleSettings } from "@/components/ReportScheduleSettings";
export default async function ReportSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <div className="geo-page-enter"><h1>Scheduled reports</h1><ReportScheduleSettings projectId={projectId} /></div>;
}
