import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.table('watchlist', table => {
      table.unique(['profileId', 'tickerId'])
    }),

  down: (knex: Knex) => {}
}
