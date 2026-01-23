import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import { mySchema } from './schema'
import Goal from './models/Goal'
import Task from './models/Task'

const adapter = new SQLiteAdapter({
    schema: mySchema,
    // migrations, // Add migrations if needed later
    jsi: true,
    onSetUpError: error => {
        console.error('Database failed to load', error)
    }
})

export const database = new Database({
    adapter,
    modelClasses: [
        Goal,
        Task,
    ],
})
