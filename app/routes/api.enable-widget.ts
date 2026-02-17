import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * API Endpoint: Enable WhatsApp Widget App Embed
 * 
 * This endpoint programmatically enables the WhatsApp widget app embed
 * by modifying the theme's settings_data.json via Shopify Admin API.
 * 
 * POST /api/enable-widget
 * Body: { phone_number?: string, default_message?: string }
 * 
 * Returns: { success: boolean, message: string }
 */
export async function action({ request }: ActionFunctionArgs) {
  // Authenticate the request
  const { session, admin } = await authenticate.admin(request);
  
  if (!session || !admin) {
    return json({ success: false, error: "Non autorisé" }, { status: 401 });
  }

  try {
    // Get the request body
    const body = await request.json().catch(() => ({}));
    const phoneNumber = body.phone_number || "";
    const defaultMessage = body.default_message || "Bonjour, j'ai une question concernant ma livraison.";

    // Step 1: Get the main theme ID
    const themesResponse = await admin.rest.get({
      path: "themes",
    });
    
    const themes = themesResponse.body?.themes || [];
    const mainTheme = themes.find((t: any) => t.role === "main");
    
    if (!mainTheme) {
      return json({ 
        success: false, 
        error: "Aucun thème principal trouvé" 
      }, { status: 404 });
    }

    const themeId = mainTheme.id;

    // Step 2: Get current settings_data.json
    const settingsResponse = await admin.rest.get({
      path: `themes/${themeId}/assets`,
      query: {
        "asset[key]": "config/settings_data.json",
      },
    });

    let settingsData: any = {};
    
    if (settingsResponse.body?.asset?.value) {
      try {
        settingsData = JSON.parse(settingsResponse.body.asset.value);
      } catch (e) {
        settingsData = { current: {} };
      }
    }

    // Ensure the structure exists
    if (!settingsData.current) {
      settingsData.current = {};
    }
    if (!settingsData.current.blocks) {
      settingsData.current.blocks = {};
    }
    if (!settingsData.current.block_order) {
      settingsData.current.block_order = [];
    }

    // Step 3: Check if app embed already exists
    const apiKey = process.env.SHOPIFY_API_KEY || "38f120638bf60cc78c44d287cf968e98";
    const extensionHandle = "whatsapp-widget";
    const blockHandle = "widget";
    
    // App embed block type format: shopify://apps/{app-name}/blocks/{block-handle}/{uuid}
    // We need to find existing blocks that match our app
    const appEmbedPrefix = `shopify://apps/`;
    let existingBlockId: string | null = null;
    
    for (const [blockId, block] of Object.entries(settingsData.current.blocks)) {
      const blockType = (block as any)?.type || "";
      if (blockType.includes(extensionHandle) || blockType.includes(blockHandle)) {
        existingBlockId = blockId;
        break;
      }
    }

    // Generate a unique block ID (numeric string)
    const blockId = existingBlockId || generateBlockId();

    // Step 4: Create or update the app embed block
    // Note: The exact format depends on whether the extension is deployed
    // We'll use a format that works with Shopify's app embed system
    
    const appEmbedBlock = {
      type: `shopify://apps/${extensionHandle}/blocks/${blockHandle}/${apiKey}`,
      disabled: false,
      settings: {
        enabled: true,
        phone_number: phoneNumber,
        default_message: defaultMessage,
        button_size: 60,
        icon_size: 32,
        button_color: "#25D366",
        bottom_position: 20,
        right_position: 20,
      },
    };

    settingsData.current.blocks[blockId] = appEmbedBlock;

    // Add to block_order if not already present
    if (!settingsData.current.block_order.includes(blockId)) {
      settingsData.current.block_order.push(blockId);
    }

    // Step 5: Save the updated settings_data.json
    const updatedSettingsJson = JSON.stringify(settingsData, null, 2);

    await admin.rest.put({
      path: `themes/${themeId}/assets`,
      data: {
        asset: {
          key: "config/settings_data.json",
          value: updatedSettingsJson,
        },
      },
    });

    return json({
      success: true,
      message: "Widget WhatsApp activé avec succès sur votre boutique !",
      themeId,
      blockId,
    });

  } catch (error: any) {
    console.error("Error enabling widget:", error);
    
    // Check for specific error types
    if (error?.response?.body?.errors) {
      return json({
        success: false,
        error: `Erreur Shopify: ${JSON.stringify(error.response.body.errors)}`,
      }, { status: 400 });
    }

    return json({
      success: false,
      error: error?.message || "Une erreur est survenue lors de l'activation du widget",
    }, { status: 500 });
  }
}

/**
 * Generate a unique numeric block ID for Shopify settings
 * Shopify uses numeric strings as block IDs
 */
function generateBlockId(): string {
  // Generate a 20-digit numeric string
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  return (timestamp + random).slice(-20);
}

/**
 * GET endpoint to check widget status
 */
export async function loader({ request }: ActionFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  
  if (!session || !admin) {
    return json({ enabled: false, error: "Non autorisé" }, { status: 401 });
  }

  try {
    // Get the main theme
    const themesResponse = await admin.rest.get({
      path: "themes",
    });
    
    const themes = themesResponse.body?.themes || [];
    const mainTheme = themes.find((t: any) => t.role === "main");
    
    if (!mainTheme) {
      return json({ enabled: false, error: "Aucun thème principal trouvé" });
    }

    // Get settings_data.json
    const settingsResponse = await admin.rest.get({
      path: `themes/${mainTheme.id}/assets`,
      query: {
        "asset[key]": "config/settings_data.json",
      },
    });

    if (!settingsResponse.body?.asset?.value) {
      return json({ enabled: false });
    }

    const settingsData = JSON.parse(settingsResponse.body.asset.value);
    
    // Check if our app embed exists and is enabled
    const blocks = settingsData?.current?.blocks || {};
    const extensionHandle = "whatsapp-widget";
    const blockHandle = "widget";
    
    for (const block of Object.values(blocks)) {
      const blockType = (block as any)?.type || "";
      const disabled = (block as any)?.disabled !== false;
      const settings = (block as any)?.settings || {};
      
      if ((blockType.includes(extensionHandle) || blockType.includes(blockHandle)) && 
          !disabled && settings.enabled !== false) {
        return json({ 
          enabled: true,
          settings: settings,
        });
      }
    }

    return json({ enabled: false });

  } catch (error) {
    console.error("Error checking widget status:", error);
    return json({ enabled: false, error: "Erreur lors de la vérification" });
  }
}
