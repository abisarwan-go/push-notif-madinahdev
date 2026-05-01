-- Room: drop slug, enforce globally unique `name` (use former slug as name when migrating so existing rows stay unique).
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
SELECT "id", "slug", "ownerUserId", "ownerPasswordHash", "joinPasswordHash", "vapidPublicKey", "createdAt", "updatedAt"
FROM "Room";

DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";

CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");

PRAGMA foreign_keys=ON;
