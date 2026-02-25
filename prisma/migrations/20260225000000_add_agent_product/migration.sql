-- CreateTable: AgentProduct
-- Liaison entre un livreur et les produits Shopify qui lui sont assignés
CREATE TABLE "AgentProduct" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "productHandle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentProduct_agentId_shopifyProductId_key" ON "AgentProduct"("agentId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "AgentProduct_agentId_idx" ON "AgentProduct"("agentId");

-- CreateIndex
CREATE INDEX "AgentProduct_shopifyProductId_idx" ON "AgentProduct"("shopifyProductId");

-- AddForeignKey
ALTER TABLE "AgentProduct" ADD CONSTRAINT "AgentProduct_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "DeliveryAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
