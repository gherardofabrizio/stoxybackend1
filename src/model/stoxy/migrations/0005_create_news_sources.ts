import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('news_sources', table => {
      table.increments('id').primary()
      table.string('title', 255)
      table.string('siteURL', 255)
      table.string('rssFeedURL', 255)
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('news_sources')
}
