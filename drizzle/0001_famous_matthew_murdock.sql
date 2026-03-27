CREATE TABLE `gamemodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gamemodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `gamemodes_name_unique` UNIQUE(`name`),
	CONSTRAINT `gamemodes_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `playerGamemodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playerId` int NOT NULL,
	`gamemodeId` int NOT NULL,
	`tier` varchar(16) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`isRetired` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `playerGamemodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`uuid` varchar(36),
	`isRetired` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `players_id` PRIMARY KEY(`id`),
	CONSTRAINT `players_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `tierHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playerId` int NOT NULL,
	`gamemodeId` int NOT NULL,
	`previousTier` varchar(16),
	`newTier` varchar(16) NOT NULL,
	`changedBy` int,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tierHistory_id` PRIMARY KEY(`id`)
);
