import { initialize, pool } from '../server/db.ts';
try {
    await initialize();
    const result = await pool().query(
        'SELECT current_database() AS database,(SELECT count(*)::int FROM dmrv.projects) AS projects,(SELECT count(*)::int FROM dmrv.resources) AS signed_resources,(SELECT count(*)::int FROM dmrv.messages) AS messages'
    );
    console.log(result.rows[0]);
} catch (error) {
    console.error('Postgres check failed: ' + ((error as { code?: string }).code || 'configuration error'));
    process.exitCode = 1;
} finally {
    await pool().end();
}
