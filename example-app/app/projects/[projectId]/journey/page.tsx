import { Journey } from '@/components/application';
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    return <Journey projectId={projectId} />;
}
