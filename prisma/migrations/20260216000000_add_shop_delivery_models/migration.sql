-- CreateEnum
CREATE TYPE "AgentRole" AS ENUM ('COURIER', 'SUPPORT', 'BOTH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'DELIVERED', 'NOT_DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT,
    "accessToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAgent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "role" "AgentRole" NOT NULL DEFAULT 'COURIER',
    "telegramUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryBill" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT,
    "customerName" TEXT NOT NULL,
    "customerAddress" TEXT NOT NULL,
    "customerPhone" TEXT,
    "assignedAgentId" TEXT,
    "productTitle" TEXT NOT NULL,
    "productImage" TEXT,
    "productQuantity" INTEGER NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "statusHistory" JSONB,
    "deliveryNotes" TEXT,
    "deliveryPhoto" TEXT,
    "telegramNotified" BOOLEAN NOT NULL DEFAULT false,
    "telegramMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_domain_key" ON "Shop"("domain");

-- CreateIndex
CREATE INDEX "Shop_domain_idx" ON "Shop"("domain");

-- CreateIndex
CREATE INDEX "DeliveryAgent_shopId_country_city_isActive_idx" ON "DeliveryAgent"("shopId", "country", "city", "isActive");

-- CreateIndex
CREATE INDEX "DeliveryAgent_shopId_isActive_idx" ON "DeliveryAgent"("shopId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryBill_orderId_key" ON "DeliveryBill"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryBill_shopId_status_idx" ON "DeliveryBill"("shopId", "status");

-- CreateIndex
CREATE INDEX "DeliveryBill_shopId_createdAt_idx" ON "DeliveryBill"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryBill_assignedAgentId_idx" ON "DeliveryBill"("assignedAgentId");

-- AddForeignKey
ALTER TABLE "DeliveryAgent" ADD CONSTRAINT "DeliveryAgent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryBill" ADD CONSTRAINT "DeliveryBill_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryBill" ADD CONSTRAINT "DeliveryBill_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "DeliveryAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
