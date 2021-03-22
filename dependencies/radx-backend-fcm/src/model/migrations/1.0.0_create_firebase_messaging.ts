import Knex from 'knex'

export default {
  up: (knex: Knex) =>
    knex.schema.alterTable('sessions', table => {
      table.string('fcmToken', 4096)
    }),
  down: () => {
    // do nothing
  }
}
