import type { Knex } from "knex";

export const name = "20261005110000_add_sent_at_to_messages";

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasColumn("messages", "sent_at");
  if (!exists) {
    await knex.schema.alterTable("messages", (table) => {
      table.timestamp("sent_at").nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasColumn("messages", "sent_at");
  if (exists) {
    await knex.schema.alterTable("messages", (table) => {
      table.dropColumn("sent_at");
    });
  }
}
