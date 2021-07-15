import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('watchlist', table => {
      table.increments('id').primary()
      table.integer('profileId').unsigned().references('id').inTable('profiles').onDelete('CASCADE')
      table.string('tickerId', 32).references('symbol').inTable('tickers').onDelete('CASCADE')
      table.boolean('isNotificationsEnabled').defaultTo('true')
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('watchlist')
}
