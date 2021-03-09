import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('tickers', table => {
      table.string('symbol', 16).primary()
      table.string('description', 64)
      table.string('displaySymbol', 16)
      table
        .string('stockMarketId', 16)
        .references('mic')
        .inTable('stock_markets')
        .onDelete('CASCADE')
      table.string('currency', 16)
      table.string('type', 32)
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
      table.index('type')
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('tickers')
}
