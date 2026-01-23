import { Model } from '@nozbe/watermelondb'
import { field, children } from '@nozbe/watermelondb/decorators'

export default class Goal extends Model {
    static table = 'goals'
    static associations = {
        tasks: { type: 'has_many', foreignKey: 'goal_id' },
    }

    @field('title') title
    @field('category') category
    @field('status') status
    @field('deadline') deadline
    @field('progress') progress
    @children('tasks') tasks
}
