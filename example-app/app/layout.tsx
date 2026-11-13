import type { Metadata } from 'next';
import 'mapbox-gl/dist/mapbox-gl.css';
import './globals.css';
import './journey.css';
export const metadata: Metadata = {
    title: 'Open dMRV · Project workspace',
    description: 'Coordinate evidence, claims, independent verification and attestations in one project implementer workspace.',
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
