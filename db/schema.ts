import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const outboundClicks = sqliteTable("outbound_clicks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  store: text("store").notNull(),
  productId: text("product_id"),
  productName: text("product_name"),
  targetUrl: text("target_url").notNull(),
  source: text("source").notNull().default("catalog"),
  clickedAt: text("clicked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_outbound_clicks_store_clicked_at").on(table.store, table.clickedAt),
  index("idx_outbound_clicks_product_id").on(table.productId),
]);
