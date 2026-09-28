import type { Knex } from 'knex';

export const name = '20260928100000_create_opens';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('opens');
  if (exists) {
    return;
  }

  await knex.schema.createTable('opens', (table) => {
    table.increments('id').primary();
    table.string('msg_id').notNullable().index();
    table.string('ip_address');
    table.text('user_agent');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('opens');
}
