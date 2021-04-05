import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.table('profile_news_sources', table => {
      table.string('title', 255)
    }),

  down: (knex: Knex) =>
    knex.schema.table('profile_news_sources', table => {
      table.dropColumn('title')
    })
}
