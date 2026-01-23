import { Model } from '@nozbe/watermelondb'
import { field, relation } from '@nozbe/watermelondb/decorators'
import Goal from './Goal'

export default class Task extends Model {
    static table = 'tasks'
    static associations = {
        goals: { type: 'belongs_to', key: 'goal_id' },
    }

    @field('title') title
    @field('is_completed') isCompleted
    @field('scheduled_date') scheduledDate
    @relation('goals', 'goal_id') goal
}
