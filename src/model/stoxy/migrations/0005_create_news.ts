import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('news', table => {
      table.increments('id').primary()
      table.string('title', 255)
      table.text('description')
      table.string('link', 255)
      table.boolean('notificationsWasSent').defaultTo(false)
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('tickers')
}
