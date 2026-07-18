/*
  Warnings:

  - You are about to drop the column `variant` on the `templates` table. All the data in the column will be lost.
  - Added the required column `subject` to the `templates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "therapists" ADD COLUMN "email" TEXT;
ALTER TABLE "therapists" ADD COLUMN "note" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variants" TEXT NOT NULL DEFAULT '["不適用"]',
    "requiredFields" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT NOT NULL,
    CONSTRAINT "templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_templates" ("body", "category", "id", "requiredFields", "updatedAt", "updatedById") SELECT "body", "category", "id", "requiredFields", "updatedAt", "updatedById" FROM "templates";
DROP TABLE "templates";
ALTER TABLE "new_templates" RENAME TO "templates";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
