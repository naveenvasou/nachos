import { synchronize } from '@nozbe/watermelondb/sync'
import { database } from './index'

const API_URL = 'http://10.0.2.2:8000'; // Android Emulator localhost alias

export async function syncData() {
    await synchronize({
        database,
        pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
            const response = await fetch(`${API_URL}/sync/pull?last_pulled_at=${lastPulledAt}&schema_version=${schemaVersion}`)
            if (!response.ok) {
                throw new Error(await response.text())
            }
            const { changes, timestamp } = await response.json()
            return { changes, timestamp }
        },
        pushChanges: async ({ changes, lastPulledAt }) => {
            const response = await fetch(`${API_URL}/sync/push?last_pulled_at=${lastPulledAt}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(changes),
            })
            if (!response.ok) {
                throw new Error(await response.text())
            }
        },
        migrationsEnabledAtVersion: 1,
    })
}
