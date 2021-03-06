import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('news', table => {
      table.increments('id').primary()
      table
        .integer('newsSourceId')
        .unsigned()
        .references('id')
        .inTable('news_sources')
        .onDelete('CASCADE')
      table.string('title', 255)
      table.text('description')
      table.string('link', 1024)
      table.dateTime('publicationDate')
      table.boolean('notificationsWasSent').defaultTo(false)
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('tickers')
}
