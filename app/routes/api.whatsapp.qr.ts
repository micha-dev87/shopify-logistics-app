import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { 
  createWhatsAppService, 
  initWhatsAppConnection,
  getWhatsAppStatus,
  type ConnectionStatus 
} from "../whatsapp.server";

// ============================================================
// WHATSAPP QR CODE ENDPOINT
// GET: Get current QR code or connection status
// POST: Initialize connection and generate QR
// DELETE: Disconnect WhatsApp
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
  
  const status = await getWhatsAppStatus(shop.id);
  
  return json({
    success: true,
    status,
    enabled: shop.whatsappEnabled,
    notificationMode: shop.notificationMode,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  if (!session?.shop) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const shop = await prisma.shop.findUnique({
    where: { domain: session.shop },
  });
  
  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }
  
  const method = request.method.toUpperCase();
  
  // POST: Initialize connection (generate QR)
  if (method === "POST") {
    try {
      // Check if already connected
      const currentStatus = await getWhatsAppStatus(shop.id);
      if (currentStatus.connected) {
        return json({
          success: true,
          message: "Already connected",
          status: currentStatus,
        });
      }
      
      // Initialize connection - QR will be stored in DB
      await initWhatsAppConnection(
        shop.id,
        // QR callback - store in DB (handled by service)
        async (qr: string) => {
          console.log(`[WhatsApp] QR generated for shop ${shop.id}`);
        },
        // Status callback
        async (status: ConnectionStatus) => {
          console.log(`[WhatsApp] Status update for shop ${shop.id}:`, status);
        }
      );
      
      // Wait a moment for QR to be generated
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const status = await getWhatsAppStatus(shop.id);
      
      return json({
        success: true,
        message: status.qrCode ? "QR code generated" : "Connection initializing",
        status,
      });
    } catch (error) {
      console.error("[WhatsApp] Error initializing connection:", error);
      return json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to initialize connection",
      }, { status: 500 });
    }
  }
  
  // DELETE: Disconnect
  if (method === "DELETE") {
    try {
      const { disconnectWhatsApp } = await import("../whatsapp.server");
      await disconnectWhatsApp(shop.id);
      
      return json({
        success: true,
        message: "WhatsApp disconnected",
      });
    } catch (error) {
      console.error("[WhatsApp] Error disconnecting:", error);
      return json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to disconnect",
      }, { status: 500 });
    }
  }
  
  // PUT: Update notification mode
  if (method === "PUT") {
    try {
      const body = await request.json();
      const { notificationMode } = body;
      
      if (!["TELEGRAM", "WHATSAPP", "BOTH"].includes(notificationMode)) {
        return json({
          success: false,
          error: "Invalid notification mode",
        }, { status: 400 });
      }
      
      await prisma.shop.update({
        where: { id: shop.id },
        data: { notificationMode },
      });
      
      return json({
        success: true,
        message: `Notification mode updated to ${notificationMode}`,
      });
    } catch (error) {
      console.error("[WhatsApp] Error updating notification mode:", error);
      return json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update",
      }, { status: 500 });
    }
  }
  
  return json({ error: "Method not allowed" }, { status: 405 });
}
