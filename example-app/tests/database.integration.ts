import { test } from 'node:test';
import assert from 'node:assert/strict';
const testUrl = process.env.TEST_DATABASE_URL;
test('Postgres request, immutable resources, callback correlation and revision transactions', { skip: !testUrl }, async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testUrl;
    const { initialize, pool } = await import('../server/db.ts');
    const { createProject, authorise, projectSnapshot } = await import('../server/repository.ts');
    const { prepareRequest, acceptRequest, processMessage, acceptCallback } = await import('../server/workflow.ts');
    try {
        await initialize();
        const db = await pool().query('SELECT current_database() AS name');
        assert.match(db.rows[0].name, /test/i, 'Use a dedicated test database whose name includes test.');
        const p = await createProject('Integration test ' + Date.now(), 'field-042', 'implementer');
        await authorise(p.id, 'controller');
        const prepared = await prepareRequest(p.id, 'implementer', 'register');
        const ack = await acceptRequest('register', 'implementer', prepared.envelope, prepared.envelope.context.messageId);
        assert.equal(ack.ack.status, 'ACK');
        assert.deepEqual(await acceptRequest('register', 'implementer', prepared.envelope), ack);
        await processMessage(prepared.envelope.context.messageId);
        let state = await projectSnapshot(p.id, 'implementer');
        assert.ok(state.current.register);
        const callback = state.messages.find((m: any) => m.direction === 'callback');
        assert.equal(callback.correlation_id, prepared.envelope.context.messageId);
        await acceptCallback('register', callback.envelope);
        await acceptCallback('register', callback.envelope);
        state = await projectSnapshot(p.id, 'implementer');
        assert.equal(state.project.pending_message_id, null);
        assert.equal(state.project.next_action, 'monitor');
        await assert.rejects(() => pool().query("UPDATE dmrv.resources SET document='{}'::jsonb WHERE id=$1", [state.current.register.id]), /immutable/);
        await assert.rejects(
            () => pool().query("UPDATE dmrv.messages SET envelope='{}'::jsonb WHERE message_id=$1", [prepared.envelope.context.messageId]),
            /immutable/
        );
    } finally {
        await pool().end();
        process.env.DATABASE_URL = original;
    }
});
