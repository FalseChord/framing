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
    "optionalFields" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT NOT NULL,
    CONSTRAINT "templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_templates" ("body", "category", "id", "requiredFields", "subject", "updatedAt", "updatedById", "variantLabel") SELECT "body", "category", "id", "requiredFields", "subject", "updatedAt", "updatedById", "variantLabel" FROM "templates";
DROP TABLE "templates";
ALTER TABLE "new_templates" RENAME TO "templates";
CREATE UNIQUE INDEX "templates_category_variantLabel_key" ON "templates"("category", "variantLabel");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
