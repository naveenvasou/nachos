import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { Platform } from 'react-native'

import { mySchema } from './schema'
import Goal from './models/Goal'
import Task from './models/Task'

let adapter;

if (Platform.OS !== 'web') {
    adapter = new SQLiteAdapter({
        schema: mySchema,
        jsi: true,
        onSetUpError: error => {
            console.error('Database failed to load', error)
        }
    });
} else {
    // Mock adapter for Web Preview (LokiJS or just null)
    // For now, we avoid crashing. Watermelon requires an adapter.
    // Ideally use LokiJSAdapter for web persistence.
    // For MVP Preview, we will just let it fail gracefully or use a dummy.
    adapter = new SQLiteAdapter({
        schema: mySchema,
        jsi: false, // Disable JSI on web
    });
}

export const database = new Database({
    adapter,
    modelClasses: [
        Goal,
        Task,
    ],
})
