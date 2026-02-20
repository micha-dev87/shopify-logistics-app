import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { 
  initWhatsAppConnection,
  getWhatsAppStatus,
  type ConnectionStatus 
} from "../whatsapp.server";

const TEST_SHOP_ID = "cmlqvkbcd00005iwstgfn9t3a";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const testToken = url.searchParams.get("token");
  if (testToken !== "test-whatsapp-2024") {
    return json({ error: "Invalid test token" }, { status: 403 });
  }
  
  const action = url.searchParams.get("action") || "status";
  
  try {
    if (action === "connect") {
      console.log("[WhatsApp Test] Starting connection test...");
      
      await initWhatsAppConnection(
        TEST_SHOP_ID,
        async (qr: string) => {
          console.log(`[WhatsApp Test] QR generated, length: ${qr.length}`);
        },
        async (status: ConnectionStatus) => {
          console.log(`[WhatsApp Test] Status update:`, JSON.stringify(status));
        }
      );
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const status = await getWhatsAppStatus(TEST_SHOP_ID);
      
      return json({
        success: true,
        message: "Connection test completed",
        qrCode: status.qrCode,
        qrExpiry: status.qrExpiry?.toISOString(),
      });
    }
    
    const status = await getWhatsAppStatus(TEST_SHOP_ID);
    return json({ success: true, status });
    
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
