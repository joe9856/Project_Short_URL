-- Schema is provisioned beforehand; DATABASE_URL selects the service-owned schema.

-- CreateTable
CREATE TABLE "click_events" (
    "id" VARCHAR(36) NOT NULL,
    "eventId" VARCHAR(36) NOT NULL,
    "linkId" VARCHAR(36) NOT NULL,
    "ownerId" VARCHAR(36) NOT NULL,
    "clickedAt" TIMESTAMPTZ(3) NOT NULL,
    "referrerHost" VARCHAR(253) NOT NULL,
    "deviceType" VARCHAR(16) NOT NULL,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "click_events_eventId_key" ON "click_events"("eventId");

-- CreateIndex
CREATE INDEX "click_events_linkId_clickedAt_idx" ON "click_events"("linkId", "clickedAt");

-- CreateIndex
CREATE INDEX "click_events_ownerId_clickedAt_idx" ON "click_events"("ownerId", "clickedAt");

