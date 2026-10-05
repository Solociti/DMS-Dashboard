import type { Knex } from 'knex';

export const name = '20261005100000_create_messages';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('messages');
  if (exists) {
    return;
  }

  await knex.schema.createTable('messages', (table) => {
    table.increments('id').primary();
    // Rspamd task uid; matches opens.msg_id.
    table.string('uid').notNullable().unique();
    table.string('message_id');
    table.text('subject');
    table.string('sender');
    // JSON-encoded array of addresses.
    table.text('recipients');
    table.string('user');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('messages');
}
