import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('tickers', table => {
      table.increments('id').primary()
      table.string('symbol', 16)
      table.string('description', 64)
      table.string('displaySymbol', 16)
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
      table.unique(['symbol'])
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('tickers')
}
