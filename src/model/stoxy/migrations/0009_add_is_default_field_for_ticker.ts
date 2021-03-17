import Knex from 'knex'

export default {
  up: async (knex: Knex) => {
    await knex.schema.table('tickers', table => {
      table.boolean('isSuggested').defaultTo(false)
    })
  },

  down: async (knex: Knex) => {
    await knex.schema.table('tickers', table => {
      table.dropColumn('isSuggested')
    })
  }
}
