ALTER TABLE "User"
  ADD COLUMN "accessKeyHash" TEXT,
  ADD COLUMN "keyPrefix" TEXT,
  ADD COLUMN "keySuffix" TEXT,
  ADD COLUMN "note" TEXT,
  ADD COLUMN "lastUsedAt" TIMESTAMP(3);

UPDATE "User" SET "enabled" = false;

DROP INDEX "User_normalizedUsername_key";
ALTER TABLE "User"
  DROP COLUMN "username",
  DROP COLUMN "normalizedUsername",
  DROP COLUMN "passwordHash";

DROP INDEX "Studio_registrationCodeHash_key";
ALTER TABLE "Studio" DROP COLUMN "registrationCodeHash";

CREATE UNIQUE INDEX "User_accessKeyHash_key" ON "User"("accessKeyHash");
