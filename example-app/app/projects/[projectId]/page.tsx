import { ProjectArchive } from '@/components/application';
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    return <ProjectArchive projectId={projectId} />;
}
