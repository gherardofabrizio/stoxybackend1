import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('users_notification_topics', table => {
      table.integer('userId').unsigned().references('id').inTable('users').onDelete('CASCADE')
      table.string('topic', 255)
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
      table.unique(['userId', 'topic'])
    }),
  down: (knex: Knex) => knex.schema.dropTableIfExists('users_notification_topics')
}
