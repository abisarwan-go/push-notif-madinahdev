-- Room: drop slug, enforce globally unique `name` (canonical name = trim(slug)).
-- Deduplicate when trim(slug) collides (e.g. slug "foo" vs " foo ") so CREATE UNIQUE INDEX never fails.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerPasswordHash" TEXT NOT NULL,
    "joinPasswordHash" TEXT,
    "vapidPublicKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Room_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Room" ("id", "name", "ownerUserId", "ownerPasswordHash", "joinPasswordHash", "vapidPublicKey", "createdAt", "updatedAt")
SELECT
	"id",
	CASE
		WHEN ROW_NUMBER() OVER (PARTITION BY trim("slug") ORDER BY datetime("createdAt"), "id") = 1 THEN trim("slug")
		ELSE trim("slug") || '-' || replace("id", '-', '')
	END,
	"ownerUserId",
	"ownerPasswordHash",
	"joinPasswordHash",
	"vapidPublicKey",
	"createdAt",
	"updatedAt"
FROM "Room";

DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";

CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");

PRAGMA foreign_keys=ON;
