import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.table('watchlist', table => {
      table.integer('order').defaultTo(0)
    }),

  down: (knex: Knex) =>
    knex.schema.table('watchlist', table => {
      table.dropColumn('order')
    })
}
