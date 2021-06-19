import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('subscription_info', table => {
      table.increments('id').primary()
      table.integer('profileId').unsigned().references('id').inTable('profiles').onDelete('CASCADE')
      table.integer('status')
      table.dateTime('until')
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('watchlist')
}
