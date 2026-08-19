import { getD1 } from "@/db";

export type StoreClickSummary = {
  store: string;
  clicks: number;
  lastClickAt: string | null;
};

export type ProductClickSummary = {
  store: string;
  productId: string | null;
  productName: string;
  targetUrl: string;
  clicks: number;
  lastClickAt: string | null;
};

const createClicksTableSql = `
CREATE TABLE IF NOT EXISTS outbound_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  target_url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'catalog',
  clicked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const createStoreIndexSql = "CREATE INDEX IF NOT EXISTS idx_outbound_clicks_store_clicked_at ON outbound_clicks (store, clicked_at)";
const createProductIndexSql = "CREATE INDEX IF NOT EXISTS idx_outbound_clicks_product_id ON outbound_clicks (product_id)";

export async function ensureOutboundClicksSchema() {
  const d1 = getD1();

  await d1.prepare(createClicksTableSql).run();
  await d1.prepare(createStoreIndexSql).run();
  await d1.prepare(createProductIndexSql).run();
}

export async function recordOutboundClick(input: {
  store: string;
  productId: string | null;
  productName: string | null;
  targetUrl: string;
  source: string;
}) {
  const d1 = getD1();

  await ensureOutboundClicksSchema();
  await d1
    .prepare(
      `INSERT INTO outbound_clicks (store, product_id, product_name, target_url, source)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(input.store, input.productId, input.productName, input.targetUrl, input.source)
    .run();
}

export async function getStoreClickSummaries(): Promise<StoreClickSummary[]> {
  const d1 = getD1();

  await ensureOutboundClicksSchema();
  const rows = await d1
    .prepare(
      `SELECT store, COUNT(*) AS clicks, MAX(clicked_at) AS lastClickAt
       FROM outbound_clicks
       GROUP BY store
       ORDER BY clicks DESC, store ASC`,
    )
    .all<StoreClickSummary>();

  return rows.results;
}

export async function getProductClickSummaries(): Promise<ProductClickSummary[]> {
  const d1 = getD1();

  await ensureOutboundClicksSchema();
  const rows = await d1
    .prepare(
      `SELECT
         store,
         product_id AS productId,
         COALESCE(product_name, target_url) AS productName,
         target_url AS targetUrl,
         COUNT(*) AS clicks,
         MAX(clicked_at) AS lastClickAt
       FROM outbound_clicks
       GROUP BY store, product_id, product_name, target_url
       ORDER BY clicks DESC, lastClickAt DESC
       LIMIT 100`,
    )
    .all<ProductClickSummary>();

  return rows.results;
}
