import Knex from 'knex'

export default {
  up: async (knex: Knex) => {
    await knex.schema.table('news_sources', table => {
      table.dateTime('lastParsedAt')
    })
  },

  down: async (knex: Knex) => {
    await knex.schema.table('news_sources', table => {
      table.dropColumn('lastParsedAt')
    })
  }
}
