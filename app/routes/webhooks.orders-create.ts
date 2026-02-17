import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import crypto from "crypto";
import prisma from "../db.server";
import { notifyAgentOfDelivery } from "../telegram.server";

// ============================================================
// SHOPIFY WEBHOOK: orders/create
// Handles incoming Shopify orders and creates delivery bills
// with automatic agent attribution
// ============================================================

export const action = async ({ request }: ActionFunctionArgs) => {
  // Verify HMAC signature from Shopify
  const hmac = request.headers.get("X-Shopify-Hmac-Sha256");
  const shop = request.headers.get("X-Shopify-Shop-Domain");
  const topic = request.headers.get("X-Shopify-Topic");

  // Validate required headers
  if (!hmac || !shop || !topic) {
    console.error("[Webhook] Missing required headers");
    return json({ error: "Missing required headers" }, { status: 401 });
  }

  // Only handle orders/create topic
  if (topic !== "orders/create") {
    return json({ message: "Topic not handled" }, { status: 200 });
  }

  // Read raw body for HMAC verification
  const rawBody = await request.text();

  // Verify HMAC
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    console.error("[Webhook] SHOPIFY_API_SECRET not configured");
    return json({ error: "Server configuration error" }, { status: 500 });
  }

  const computedHmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  if (computedHmac !== hmac) {
    console.error("[Webhook] Invalid HMAC signature", { shop, computedHmac, hmac });
    return json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse order data
  let orderData: any;
  try {
    orderData = JSON.parse(rawBody);
  } catch (e) {
    console.error("[Webhook] Failed to parse order JSON");
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Find shop in database
  const shopRecord = await prisma.shop.findUnique({
    where: { domain: shop },
  });

  if (!shopRecord) {
    console.error("[Webhook] Shop not found in database", { shop });
    return json({ error: "Shop not found" }, { status: 404 });
  }

  try {
    // Extract order details
    const orderId = orderData.id?.toString();
    const orderName = orderData.name;
    const customer = orderData.customer || orderData.billing_address || {};
    const shippingAddress = orderData.shipping_address || orderData.billing_address || {};

    // Get customer info
    const customerName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Client";
    const customerAddress = [
      shippingAddress.address1,
      shippingAddress.address2,
      shippingAddress.city,
      shippingAddress.province,
      shippingAddress.country,
    ]
      .filter(Boolean)
      .join(", ");
    const customerPhone = shippingAddress.phone || customer.phone || null;

    // Get product info (first line item)
    const lineItem = orderData.line_items?.[0] || {};
    const productTitle = lineItem.title || "Produit";
    const productQuantity = lineItem.quantity || 1;

    // Get product image (need to fetch from Shopify API or use placeholder)
    const productImage = lineItem.image?.src || null;

    // Check for duplicate (idempotency)
    const existingBill = await prisma.deliveryBill.findUnique({
      where: { orderId },
    });

    if (existingBill) {
      console.log("[Webhook] Duplicate order ignored", { orderId, shop });
      return json({ message: "Order already processed" }, { status: 200 });
    }

    // Extract country from shipping address
    const customerCountry = extractCountryCode(shippingAddress.country_code || shippingAddress.country);
    const customerCity = shippingAddress.city || null;

    // Create delivery bill
    const bill = await prisma.deliveryBill.create({
      data: {
        shopId: shopRecord.id,
        orderId,
        orderName,
        customerName,
        customerAddress,
        customerPhone,
        productTitle,
        productImage,
        productQuantity,
        status: "PENDING",
        statusHistory: [
          {
            status: "PENDING",
            timestamp: new Date().toISOString(),
            source: "webhook",
          },
        ],
      },
    });

    console.log("[Webhook] Created delivery bill", {
      billId: bill.id,
      orderId,
      orderName,
      shop,
    });

    // Run automatic attribution algorithm
    await assignBestAgent(bill.id, shopRecord.id, customerCountry, customerCity);

    // Return 200 quickly to avoid Shopify retries
    return json({ success: true, billId: bill.id }, { status: 200 });
  } catch (error) {
    console.error("[Webhook] Error processing order:", error);
    // Still return 200 to avoid retries - we'll handle errors internally
    return json({ error: "Processing error" }, { status: 200 });
  }
};

// ============================================================
// ATTRIBUTION ALGORITHM
// Finds the best delivery agent based on:
// 1. Same country as customer
// 2. Same city (priority if available)
// 3. Least number of active bills
// ============================================================
async function assignBestAgent(
  billId: string,
  shopId: string,
  customerCountry: string | null,
  customerCity: string | null
): Promise<void> {
  try {
    // Find active agents for this shop
    const agents = await prisma.deliveryAgent.findMany({
      where: {
        shopId,
        isActive: true,
        role: { in: ["COURIER", "BOTH"] }, // Only couriers can be assigned
      },
      include: {
        _count: {
          select: {
            deliveryBills: {
              where: {
                status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
              },
            },
          },
        },
      },
    });

    if (agents.length === 0) {
      console.log("[Attribution] No active couriers available", { shopId, billId });
      return;
    }

    // Filter agents by country match (if customer country is known)
    let eligibleAgents = agents;
    if (customerCountry) {
      const countryMatches = agents.filter((a) => a.country === customerCountry);
      if (countryMatches.length > 0) {
        eligibleAgents = countryMatches;

        // Further filter by city if available
        if (customerCity) {
          const cityMatches = countryMatches.filter(
            (a) => a.city?.toLowerCase() === customerCity.toLowerCase()
          );
          if (cityMatches.length > 0) {
            eligibleAgents = cityMatches;
          }
        }
      }
    }

    // Sort by least active bills
    eligibleAgents.sort((a, b) => a._count.deliveryBills - b._count.deliveryBills);

    // Select the best agent (first in sorted list)
    const selectedAgent = eligibleAgents[0];

    if (!selectedAgent) {
      console.log("[Attribution] No eligible agent found", { shopId, billId, customerCountry, customerCity });
      return;
    }

    // Update bill with assigned agent
    const bill = await prisma.deliveryBill.findUnique({
      where: { id: billId },
    });

    if (!bill || bill.status !== "PENDING") {
      return; // Bill was already assigned or doesn't exist
    }

    const statusHistory = (bill.statusHistory as any[]) || [];
    statusHistory.push({
      status: "ASSIGNED",
      timestamp: new Date().toISOString(),
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      source: "automatic_attribution",
    });

    await prisma.deliveryBill.update({
      where: { id: billId },
      data: {
        assignedAgentId: selectedAgent.id,
        status: "ASSIGNED",
        statusHistory,
      },
    });

    console.log("[Attribution] Assigned agent to bill", {
      billId,
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      activeBillsCount: selectedAgent._count.deliveryBills,
    });

    // Trigger Telegram notification if agent has Telegram configured
    if (selectedAgent.telegramUserId) {
      try {
        // Fetch agent with shop relation for notification
        const agentWithShop = await prisma.deliveryAgent.findUnique({
          where: { id: selectedAgent.id },
          include: { shop: true },
        });

        if (agentWithShop?.shop.telegramBotToken) {
          const updatedBill = await prisma.deliveryBill.findUnique({
            where: { id: billId },
          });

          if (updatedBill) {
            const notifResult = await notifyAgentOfDelivery(
              agentWithShop as any,
              updatedBill,
              agentWithShop.shop.telegramBotToken,
            );

            if (notifResult.success) {
              await prisma.deliveryBill.update({
                where: { id: billId },
                data: {
                  telegramNotified: true,
                  telegramMessageId: notifResult.messageId?.toString() || null,
                },
              });

              console.log("[Attribution] Telegram notification sent", {
                billId,
                agentId: selectedAgent.id,
                messageId: notifResult.messageId,
              });
            } else {
              console.error("[Attribution] Telegram notification failed", {
                billId,
                agentId: selectedAgent.id,
                error: notifResult.error,
              });
            }
          }
        } else {
          console.log("[Attribution] No Telegram bot token configured for shop", {
            shopId,
          });
        }
      } catch (notifError) {
        // Don't fail the attribution if notification fails
        console.error("[Attribution] Error sending Telegram notification:", notifError);
      }
    }
  } catch (error) {
    console.error("[Attribution] Error in assignment algorithm:", error);
  }
}

// ============================================================
// HELPER: Extract ISO country code
// ============================================================
function extractCountryCode(country: string | undefined): string | null {
  if (!country) return null;

  // Already an ISO code (2-3 letters)
  if (/^[A-Z]{2,3}$/i.test(country)) {
    return country.toUpperCase();
  }

  // Common country name mappings
  const countryMap: Record<string, string> = {
    "Côte d'Ivoire": "CI",
    "Ivory": "CI",
    "France": "FR",
    "Senegal": "SN",
    "Sénégal": "SN",
    "Mali": "ML",
    "Burkina": "BF",
    "Ghana": "GH",
    "Nigeria": "NG",
    "Cameroon": "CM",
    "Cameroun": "CM",
    "Morocco": "MA",
    "Maroc": "MA",
    "Tunisia": "TN",
    "Tunisie": "TN",
    "Algeria": "DZ",
    "Algérie": "DZ",
    "Congo": "CG",
    "DR Congo": "CD",
    "RD Congo": "CD",
    "Kenya": "KE",
    "Uganda": "UG",
    "Ouganda": "UG",
    "Tanzania": "TZ",
    "Tanzanie": "TZ",
    "South Africa": "ZA",
    "Afrique du Sud": "ZA",
    "Madagascar": "MG",
    "Rwanda": "RW",
    "Benin": "BJ",
    "Bénin": "BJ",
    "Togo": "TG",
    "Niger": "NE",
    "Gabon": "GA",
    "Mauritius": "MU",
    "Maurice": "MU",
  };

  const normalized = country.trim();
  return countryMap[normalized] || normalized.substring(0, 2).toUpperCase();
}
