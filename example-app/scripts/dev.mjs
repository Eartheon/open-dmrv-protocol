import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const production = process.argv.includes('--production');
const setup = spawn(process.execPath, ['--experimental-strip-types', 'scripts/migrate.ts'], { stdio: 'inherit' });
setup.on('exit', (code) => {
    if (code) {
        process.exitCode = code;
        return;
    }
    start();
});
function start() {
    const children = [
        spawn(
            process.execPath,
            [
                'node_modules/next/dist/bin/next',
                production ? 'start' : 'dev',
                ...(production ? [] : ['--webpack']),
                '--hostname',
                '127.0.0.1',
                '--port',
                '3000',
            ],
            { stdio: 'inherit' }
        ),
        spawn(process.execPath, ['--experimental-strip-types', 'scripts/worker.ts'], { stdio: 'inherit' }),
    ];
    let stopping = false;
    function stop(code = 0) {
        if (stopping) return;
        stopping = true;
        for (const child of children) child.kill();
        setTimeout(() => process.exit(code), 300).unref();
    }
    for (const child of children)
        child.on('exit', (code) => {
            if (!stopping) stop(code || 0);
        });
    process.on('SIGINT', () => stop());
    process.on('SIGTERM', () => stop());
    console.log('One application: http://localhost:3000 · Postgres persistence · durable signed callbacks');
}
