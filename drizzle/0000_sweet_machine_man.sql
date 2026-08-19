CREATE TABLE `outbound_clicks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store` text NOT NULL,
	`product_id` text,
	`product_name` text,
	`target_url` text NOT NULL,
	`source` text DEFAULT 'catalog' NOT NULL,
	`clicked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
