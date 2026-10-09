import type { Knex } from "knex";

export const name = "20261008100000_add_open_counts_to_messages";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("messages", (table) => {
    table.integer("open_count").notNullable().defaultTo(0);
    table.timestamp("last_opened_at");
    table.index(["last_opened_at"]);
    table.index(["sent_at"]);
  });

  const visibleOpens = `opens.msg_id = messages.uid
    AND (opens.ip_address IS NULL OR (
      opens.ip_address NOT IN (SELECT ip FROM ignored_ips)
      AND opens.ip_address NOT IN (SELECT '::ffff:' || ip FROM ignored_ips)))`;

  await knex.raw(`UPDATE messages SET
    open_count = (SELECT COUNT(*) FROM opens WHERE ${visibleOpens}),
    last_opened_at = (SELECT MAX(created_at) FROM opens WHERE ${visibleOpens})`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("messages", (table) => {
    table.dropIndex(["last_opened_at"]);
    table.dropIndex(["sent_at"]);
    table.dropColumn("open_count");
    table.dropColumn("last_opened_at");
  });
}
