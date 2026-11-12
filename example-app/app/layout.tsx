import type { Metadata } from 'next';
import 'mapbox-gl/dist/mapbox-gl.css';
import './globals.css';
import './journey.css';
export const metadata: Metadata = {
    title: 'Open dMRV · Protocol in practice',
    description: 'Explore the people, evidence and signed objects behind an environmental claim.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang='en'>
            <body>
                <a className='skip' href='#main'>
                    Skip to content
                </a>
                {children}
            </body>
        </html>
    );
}
