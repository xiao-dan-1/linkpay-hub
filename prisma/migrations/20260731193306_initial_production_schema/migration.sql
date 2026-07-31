-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('queued', 'processing', 'success', 'failed');

-- CreateEnum
CREATE TYPE "PrincipalType" AS ENUM ('user', 'admin', 'studio');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('user', 'admin', 'studio', 'system');

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationCodeHash" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "normalizedUsername" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "normalizedUsername" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "queueSeq" BIGSERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'queued',
    "userId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "feedback" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "principalType" "PrincipalType" NOT NULL,
    "principalId" TEXT NOT NULL,
    "studioTokenVersion" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedCount" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionChunk" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "taskPublicIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Studio_registrationCodeHash_key" ON "Studio"("registrationCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_accessTokenHash_key" ON "Studio"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_normalizedUsername_key" ON "User"("normalizedUsername");

-- CreateIndex
CREATE INDEX "User_studioId_idx" ON "User"("studioId");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_normalizedUsername_key" ON "Admin"("normalizedUsername");

-- CreateIndex
CREATE UNIQUE INDEX "Task_publicId_key" ON "Task"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_queueSeq_key" ON "Task"("queueSeq");

-- CreateIndex
CREATE INDEX "Task_studioId_queueSeq_idx" ON "Task"("studioId", "queueSeq");

-- CreateIndex
CREATE INDEX "Task_userId_queueSeq_idx" ON "Task"("userId", "queueSeq");

-- CreateIndex
CREATE INDEX "Task_studioId_status_queueSeq_idx" ON "Task"("studioId", "status", "queueSeq");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_principalType_principalId_idx" ON "Session"("principalType", "principalId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorType_actorId_createdAt_idx" ON "AuditLog"("actorType", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "SubmissionBatch_userId_createdAt_idx" ON "SubmissionBatch"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionChunk_batchId_idempotencyKey_key" ON "SubmissionChunk"("batchId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionBatch" ADD CONSTRAINT "SubmissionBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionChunk" ADD CONSTRAINT "SubmissionChunk_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SubmissionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
