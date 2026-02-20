import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { 
  requestWhatsAppPairingCode,
  getWhatsAppStatus,
  initWhatsAppConnection,
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
    if (action === "pairing-code") {
      const phoneNumber = url.searchParams.get("phone");
      
      if (!phoneNumber) {
        return json({ 
          error: "Phone number required",
          format: "E.164 without + (e.g., 33612345678)"
        }, { status: 400 });
      }
      
      // Validate phone number format
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        return json({ 
          error: "Invalid phone number length",
          format: "E.164 without + (e.g., 33612345678)"
        }, { status: 400 });
      }
      
      console.log(`[Pairing Code] Requesting for phone: ${cleanPhone}`);
      
      // First initialize connection to get socket ready
      await initWhatsAppConnection(
        TEST_SHOP_ID,
        async (qr: string) => {
          console.log(`[Pairing Code] QR generated (backup), length: ${qr.length}`);
        },
        async (status: ConnectionStatus) => {
          console.log(`[Pairing Code] Status update:`, JSON.stringify(status));
        }
      );
      
      // Wait for connection to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Request pairing code
      const code = await requestWhatsAppPairingCode(TEST_SHOP_ID, cleanPhone);
      
      if (!code) {
        return json({ 
          error: "Failed to generate pairing code",
          message: "Make sure WhatsApp is ready to connect. Try again in a few seconds."
        }, { status: 500 });
      }
      
      return json({
        success: true,
        pairingCode: code,
        phoneNumber: cleanPhone,
        instructions: [
          "1. Open WhatsApp on your phone",
          "2. Go to Settings → Linked Devices",
          "3. Tap 'Link a Device'",
          "4. Tap 'Link with phone number instead'",
          `5. Enter this code: ${code}`,
          "6. Wait for connection..."
        ]
      });
    }
    
    if (action === "status") {
      const status = await getWhatsAppStatus(TEST_SHOP_ID);
      return json({ success: true, status });
    }
    
    return json({ 
      error: "Invalid action",
      availableActions: ["pairing-code", "status"]
    }, { status: 400 });
    
  } catch (error) {
    console.error("[Pairing Code API] Error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

// Handle POST requests for pairing code
export async function action({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const testToken = url.searchParams.get("token");
  if (testToken !== "test-whatsapp-2024") {
    return json({ error: "Invalid test token" }, { status: 403 });
  }
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  
  try {
    const body = await request.json();
    const phoneNumber = body.phoneNumber;
    
    if (!phoneNumber) {
      return json({ 
        error: "Phone number required",
        format: "E.164 without + (e.g., 33612345678)"
      }, { status: 400 });
    }
    
    // Validate phone number format
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return json({ 
        error: "Invalid phone number length",
        format: "E.164 without + (e.g., 33612345678)"
      }, { status: 400 });
    }
    
    console.log(`[Pairing Code POST] Requesting for phone: ${cleanPhone}`);
    
    // First initialize connection
    await initWhatsAppConnection(
      TEST_SHOP_ID,
      async () => {},
      async () => {}
    );
    
    // Wait for connection to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Request pairing code
    const code = await requestWhatsAppPairingCode(TEST_SHOP_ID, cleanPhone);
    
    if (!code) {
      return json({ 
        error: "Failed to generate pairing code",
        message: "Make sure WhatsApp is ready to connect. Try again in a few seconds."
      }, { status: 500 });
    }
    
    return json({
      success: true,
      pairingCode: code,
      phoneNumber: cleanPhone,
      instructions: [
        "1. Open WhatsApp on your phone",
        "2. Go to Settings → Linked Devices",
        "3. Tap 'Link a Device'",
        "4. Tap 'Link with phone number instead'",
        `5. Enter this code: ${code}`,
        "6. Wait for connection..."
      ]
    });
    
  } catch (error) {
    console.error("[Pairing Code API POST] Error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}