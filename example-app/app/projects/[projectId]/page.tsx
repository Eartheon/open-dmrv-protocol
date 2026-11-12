import { ProjectArchive } from '@/components/application';
import { roles } from '@/lib/model';
export default async function Page({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ profile?: string }> }) {
    const { projectId } = await params;
    const query = await searchParams;
    const profile = roles.find((r) => r.id === query.profile)?.id || 'implementer';
    return <ProjectArchive projectId={projectId} initialProfile={profile} />;
}
