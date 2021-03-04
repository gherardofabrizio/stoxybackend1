import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.createTable('profiles', table => {
      table.integer('id').unsigned().primary()
      table.string('firstName', 255)
      table.string('lastName', 255)
      table.date('birthday')
    }),

  down: (knex: Knex) => knex.schema.dropTableIfExists('profiles')
}
