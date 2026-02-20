import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { 
  initWhatsAppConnection,
  getWhatsAppStatus,
  type ConnectionStatus 
} from "../whatsapp.server";

// ============================================================
// WHATSAPP TEST ENDPOINT (NO AUTH - FOR TESTING ONLY)
// Remove this file in production!
// ============================================================

const TEST_SHOP_ID = "cmlqvkbcd00005iwstgfn9t3a";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "status";
  
  // Security: Only allow from specific IPs or with a test token
  const testToken = url.searchParams.get("token");
  if (testToken !== "test-whatsapp-2024") {
    return json({ error: "Invalid test token" }, { status: 403 });
  }
  
  try {
    if (action === "connect") {
      console.log("[WhatsApp Test] Starting connection test...");
      
      // Initialize connection
      await initWhatsAppConnection(
        TEST_SHOP_ID,
        // QR callback
        async (qr: string) => {
          console.log(`[WhatsApp Test] QR generated, length: ${qr.length}`);
        },
        // Status callback
        async (status: ConnectionStatus) => {
          console.log(`[WhatsApp Test] Status update:`, JSON.stringify(status));
        }
      );
      
      // Wait for connection attempt
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const status = await getWhatsAppStatus(TEST_SHOP_ID);
      
      return json({
        success: true,
        message: "Connection test completed",
        status,
      });
    }
    
    if (action === "status") {
      const status = await getWhatsAppStatus(TEST_SHOP_ID);
      return json({
        success: true,
        status,
      });
    }
    
    return json({ error: "Unknown action. Use ?action=status or ?action=connect" }, { status: 400 });
    
  } catch (error) {
    console.error("[WhatsApp Test] Error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
