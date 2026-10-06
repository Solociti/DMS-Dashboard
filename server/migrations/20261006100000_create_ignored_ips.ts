import type { Knex } from "knex";

export const name = "20261006100000_create_ignored_ips";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("ignored_ips", (table) => {
    table.increments("id").primary();
    table.string("ip", 45).notNullable().unique();
    table.string("note", 200);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("ignored_ips");
}
