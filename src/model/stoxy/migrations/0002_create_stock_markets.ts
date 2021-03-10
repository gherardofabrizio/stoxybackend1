import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('stock_markets', table => {
      table.string('mic', 16).primary()
      table.string('operatingMic', 16)
      table.string('name', 255)
      table.string('acronym', 32)
      table.string('countryCode', 2)
      table.string('website', 255)
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('stock_markets')
}
