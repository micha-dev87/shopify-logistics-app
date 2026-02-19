import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getWhatsAppRateLimitInfo, getWhatsAppStatus } from "../whatsapp.server";

// ============================================================
// WHATSAPP STATUS ENDPOINT
// GET: Get connection status + rate limit info for dashboard
// ============================================================

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  if (!session?.shop) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const shop = await prisma.shop.findUnique({
    where: { domain: session.shop },
    include: { whatsappSession: true },
  });
  
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }
  
  // Get connection status
  const connectionStatus = await getWhatsAppStatus(shop.id);
  
  // Get rate limit info
  const rateLimit = await getWhatsAppRateLimitInfo(shop.id);
  
  // Calculate usage percentage
  const usagePercent = Math.round((rateLimit.dailyCount / rateLimit.dailyLimit) * 100);
  const isWarning = usagePercent >= 80;
  const isCritical = usagePercent >= 95;
  
  return json({
    success: true,
    connection: {
      connected: connectionStatus.connected,
      phoneNumber: connectionStatus.phoneNumber,
      qrCode: connectionStatus.qrCode,
      qrExpiry: connectionStatus.qrExpiry?.toISOString(),
      error: connectionStatus.error,
    },
    rateLimit: {
      dailyCount: rateLimit.dailyCount,
      dailyLimit: rateLimit.dailyLimit,
      remaining: rateLimit.remaining,
      resetAt: rateLimit.resetAt.toISOString(),
      usagePercent,
      isWarning,
      isCritical,
    },
    settings: {
      enabled: shop.whatsappEnabled,
      notificationMode: shop.notificationMode,
      connectedAt: shop.whatsappConnectedAt?.toISOString(),
    },
  });
}
