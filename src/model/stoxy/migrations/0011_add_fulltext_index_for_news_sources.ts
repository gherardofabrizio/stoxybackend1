import Knex from 'knex'

export default {
  up: async (knex: Knex) => {
    await knex.schema.table('news_sources', table => {
      table.index(['title'], 'titleIndex', 'FULLTEXT')
    })
  },

  down: async (knex: Knex) => {}
}
