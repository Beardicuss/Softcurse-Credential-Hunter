ALTER TABLE `api_keys` ADD `confidence` double;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `match_strength` varchar(32);--> statement-breakpoint
ALTER TABLE `api_keys` ADD `validation_tier` varchar(16);--> statement-breakpoint
ALTER TABLE `api_keys` ADD `validation_status` varchar(64);--> statement-breakpoint
ALTER TABLE `api_keys` ADD `validation_reason` text;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `source` varchar(64);--> statement-breakpoint
ALTER TABLE `api_keys` ADD `evidence_url` text;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `discovered_at` timestamp;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `last_validated_at` timestamp;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `freshness` varchar(16);--> statement-breakpoint
ALTER TABLE `api_keys` ADD `revalidation_suggested` boolean DEFAULT false NOT NULL;