import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const mySchema = appSchema({
    version: 1,
    tables: [
        tableSchema({
            name: 'goals',
            columns: [
                { name: 'title', type: 'string' },
                { name: 'category', type: 'string' },
                { name: 'status', type: 'string' },
                { name: 'deadline', type: 'number' },
                { name: 'progress', type: 'number' },
            ]
        }),
        tableSchema({
            name: 'tasks',
            columns: [
                { name: 'goal_id', type: 'string', isIndexed: true },
                { name: 'title', type: 'string' },
                { name: 'is_completed', type: 'boolean' },
                { name: 'scheduled_date', type: 'number' },
            ]
        }),
    ]
})
