import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import QRCode from "qrcode";
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
    
    // Return QR code as image
    if (action === "qr-image") {
      const status = await getWhatsAppStatus(TEST_SHOP_ID);
      
      if (!status.qrCode) {
        return new Response("No QR code available. Call ?action=connect first", { status: 404 });
      }
      
      // qrCode is now a data URL (data:image/png;base64,...)
      // Extract base64 data and return as image
      const base64Data = status.qrCode.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      
      return new Response(buffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "no-cache",
        },
      });
    }
    
    // Return QR page with image
    if (action === "qr-page") {
      const status = await getWhatsAppStatus(TEST_SHOP_ID);
      
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>WhatsApp Connection</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Arial, sans-serif; text-align: center; padding: 20px; background: #f5f5f5; }
    .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #25D366; margin-bottom: 10px; }
    .qr-container { margin: 20px 0; }
    .status { margin-top: 15px; padding: 10px; border-radius: 5px; }
    .connected { background: #d4edda; color: #155724; }
    .waiting { background: #fff3cd; color: #856404; }
    .expired { background: #f8d7da; color: #721c24; }
    .refresh-btn { margin-top: 15px; padding: 10px 20px; background: #25D366; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
    .refresh-btn:hover { background: #128C7E; }
    .expiry { color: #666; font-size: 14px; margin-top: 10px; }
    .alternative { margin-top: 30px; padding-top: 20px; border-top: 2px dashed #ddd; }
    .phone-input { 
      width: 100%; 
      padding: 12px; 
      margin: 10px 0; 
      border: 2px solid #ddd; 
      border-radius: 5px; 
      font-size: 16px;
      box-sizing: border-box;
    }
    .phone-input:focus { border-color: #25D366; outline: none; }
    .pairing-result { 
      margin-top: 15px; 
      padding: 15px; 
      background: #e7f3ff; 
      border-radius: 5px; 
      font-family: monospace; 
      font-size: 24px;
      letter-spacing: 4px;
    }
    .instructions { text-align: left; margin-top: 15px; font-size: 14px; color: #555; }
    .instructions li { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📱 WhatsApp Connection</h1>
    
    <!-- QR Code Section -->
    <div class="qr-container">
      ${status.qrCode ? `<img src="?action=qr-image&token=test-whatsapp-2024&t=${Date.now()}" alt="QR Code" style="width:256px;height:256px;">` : '<p>Aucun QR disponible</p>'}
    </div>
    <div class="status ${status.connected ? 'connected' : (status.qrCode ? 'waiting' : 'expired')}">
      ${status.connected ? '✅ Connecté: ' + status.phoneNumber : (status.qrCode ? '⏳ En attente de scan...' : '❌ QR expiré ou non généré')}
    </div>
    ${status.qrExpiry ? `<div class="expiry">Expire: ${new Date(status.qrExpiry).toLocaleTimeString('fr-FR')}</div>` : ''}
    <button class="refresh-btn" onclick="location.reload()">🔄 Rafraîchir</button>
    <button class="refresh-btn" style="background:#007bff" onclick="fetch('?action=connect&token=test-whatsapp-2024').then(()=>location.reload())">🆕 Nouveau QR</button>
    
    <!-- Alternative: Pairing Code -->
    <div class="alternative">
      <h2>🔢 Ou utilisez le Code</h2>
      <p style="color: #666; font-size: 14px;">Si le QR ne fonctionne pas, entrez votre numéro pour recevoir un code :</p>
      <input type="tel" id="phoneInput" class="phone-input" placeholder="33612345678 (sans +)" maxlength="15">
      <button class="refresh-btn" style="background:#ff6b6b" onclick="requestPairingCode()">📲 Obtenir le Code</button>
      <div id="pairingResult"></div>
    </div>
  </div>
  
  <script>
    // Auto-refresh every 30 seconds if not connected (and user is not interacting)
    let autoRefreshTimer;
    let userInteracting = false;
    
    // Detect user interaction with phone input
    document.addEventListener('DOMContentLoaded', function() {
      const phoneInput = document.getElementById('phoneInput');
      if (phoneInput) {
        phoneInput.addEventListener('focus', () => { userInteracting = true; });
        phoneInput.addEventListener('blur', () => { userInteracting = false; });
      }
    });
    
    ${!status.connected ? `
    function scheduleRefresh() {
      if (!userInteracting) {
        autoRefreshTimer = setTimeout(() => location.reload(), 30000); // 30 seconds
      } else {
        // Retry in 5 seconds if user is interacting
        autoRefreshTimer = setTimeout(scheduleRefresh, 5000);
      }
    }
    scheduleRefresh();
    ` : ''}
    
    async function requestPairingCode() {
      const phone = document.getElementById('phoneInput').value.replace(/\D/g, '');
      const resultDiv = document.getElementById('pairingResult');
      
      if (phone.length < 10) {
        resultDiv.innerHTML = '<p style="color: red;">Numéro invalide (min 10 chiffres)</p>';
        return;
      }
      
      resultDiv.innerHTML = '<p>⏳ Génération du code...</p>';
      
      try {
        const response = await fetch('/api/whatsapp/pairing?action=pairing-code&phone=' + phone + '&token=test-whatsapp-2024');
        const data = await response.json();
        
        if (data.success) {
          resultDiv.innerHTML = \`
            <div class="pairing-result">\${data.pairingCode}</div>
            <ol class="instructions">
              <li>Ouvrez WhatsApp sur votre téléphone</li>
              <li>Allez dans Paramètres → Appareils connectés</li>
              <li>Appuyez sur "Connecter un appareil"</li>
              <li>Appuyez sur "Se connecter avec un numéro"</li>
              <li>Entrez ce code: <strong>\${data.pairingCode}</strong></li>
              <li>Attendez la connexion...</li>
            </ol>
          \`;
        } else {
          resultDiv.innerHTML = '<p style="color: red;">❌ ' + (data.error || 'Erreur') + '</p>';
        }
      } catch (error) {
        resultDiv.innerHTML = '<p style="color: red;">❌ Erreur réseau</p>';
      }
    }
  </script>
</body>
</html>`;
      
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
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
