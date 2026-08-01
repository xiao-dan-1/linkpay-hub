-- AlterTable
ALTER TABLE "User" ADD COLUMN "accessKeyCipher" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_accessKeyCipher_key" ON "User"("accessKeyCipher");
