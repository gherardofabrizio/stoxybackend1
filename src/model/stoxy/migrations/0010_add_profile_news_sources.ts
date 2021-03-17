import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('profile_news_sources', table => {
      table.integer('profileId').unsigned().references('id').inTable('profiles').onDelete('CASCADE')
      table
        .integer('newsSourceId')
        .unsigned()
        .references('id')
        .inTable('news_sources')
        .onDelete('CASCADE')
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
      table.unique(['profileId', 'newsSourceId'])
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('profile_news_sources')
}
