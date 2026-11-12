import { notFound } from 'next/navigation';
import { roles } from '@/lib/model';
import { ProjectBrowser } from '@/components/application';
export function generateStaticParams() {
    return roles.map((r) => ({ role: r.id }));
}
export default async function Page({ params }: { params: Promise<{ role: string }> }) {
    const { role } = await params;
    if (!roles.some((r) => r.id === role)) notFound();
    return <ProjectBrowser roleId={role} />;
}
