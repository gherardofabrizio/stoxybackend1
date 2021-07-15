import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('news_tickers', table => {
      table.integer('newsId').unsigned().references('id').inTable('news').onDelete('CASCADE')
      table.string('tickerId', 32).references('symbol').inTable('tickers').onDelete('CASCADE')
      table.unique(['newsId', 'tickerId'])
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('news_tickers')
}
