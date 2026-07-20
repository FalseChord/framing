/*
  Warnings:

  - You are about to drop the `letters_log` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `variants` on the `templates` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "letters_log";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL DEFAULT '不適用',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "requiredFields" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT NOT NULL,
    CONSTRAINT "templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_templates" ("body", "category", "id", "requiredFields", "subject", "updatedAt", "updatedById") SELECT "body", "category", "id", "requiredFields", "subject", "updatedAt", "updatedById" FROM "templates";
DROP TABLE "templates";
ALTER TABLE "new_templates" RENAME TO "templates";
CREATE UNIQUE INDEX "templates_category_variantLabel_key" ON "templates"("category", "variantLabel");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
