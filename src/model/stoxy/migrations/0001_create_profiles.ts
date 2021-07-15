import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('profiles', table => {
      table.integer('id').unsigned().primary()
      table.string('firstName', 255)
      table.string('lastName', 255)
      table.date('birthday')
      table.dateTime('createdAt').notNullable().defaultTo(knex.fn.now())
      table.dateTime('updatedAt').notNullable().defaultTo(knex.fn.now())
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('profiles')
}
