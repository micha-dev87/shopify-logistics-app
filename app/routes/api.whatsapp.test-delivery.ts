import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { sendDeliveryNotification } from "../whatsapp.server";

// ============================================================
// LOADER - Get available agents for testing
// ============================================================
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  try {
    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
      include: {
        deliveryAgents: {
          where: { 
            isActive: true,
            whatsappJid: { not: null },
          },
          select: { 
            id: true, 
            name: true, 
            phone: true,
            whatsappJid: true,
            role: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!shop) {
      return json({ error: "Boutique non trouvée" }, { status: 404 });
    }

    return json({
      success: true,
      agents: shop.deliveryAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        phone: agent.phone,
        whatsappJid: agent.whatsappJid,
        role: agent.role,
      })),
    });
  } catch (error) {
    console.error("[WhatsApp Test Delivery] Loader error:", error);
    return json(
      { error: "Erreur lors du chargement des livreurs" },
      { status: 500 }
    );
  }
}

// ============================================================
// ACTION - Send test delivery notification
// ============================================================
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  try {
    const formData = await request.formData();
    const action = formData.get("action") as string;

    if (action !== "send-test-delivery") {
      return json({ error: "Action non reconnue" }, { status: 400 });
    }

    const agentId = formData.get("agentId") as string;
    const productTitle = formData.get("productTitle") as string;
    const productQuantity = parseInt(formData.get("productQuantity") as string) || 1;
    const customerName = formData.get("customerName") as string || "Client Test";
    const customerAddress = formData.get("customerAddress") as string || "123 Rue de Test, Abidjan";
    const customerPhone = formData.get("customerPhone") as string || "+225 01 23 45 67 89";

    // Validation
    if (!agentId) {
      return json({ error: "Veuillez sélectionner un livreur" }, { status: 400 });
    }

    if (!productTitle || productTitle.trim().length < 2) {
      return json({ error: "Veuillez entrer un nom de produit valide" }, { status: 400 });
    }

    // Get shop
    const shop = await prisma.shop.findUnique({
      where: { domain: shopDomain },
      include: {
        deliveryAgents: {
          where: { id: agentId },
          select: { id: true, name: true, whatsappJid: true },
        },
      },
    });

    if (!shop) {
      return json({ error: "Boutique non trouvée" }, { status: 404 });
    }

    if (shop.deliveryAgents.length === 0) {
      return json({ error: "Livreur non trouvé" }, { status: 404 });
    }

    const agent = shop.deliveryAgents[0];

    if (!agent.whatsappJid) {
      return json(
        { error: `Le livreur ${agent.name} n'a pas de numéro WhatsApp configuré` },
        { status: 400 }
      );
    }

    // Send test delivery notification
    const testBillId = `test-${Date.now()}`;
    const result = await sendDeliveryNotification(
      shop.id,
      agent.whatsappJid,
      {
        orderName: `#TEST-${new Date().getTime().toString().slice(-6)}`,
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim(),
        customerPhone: customerPhone.trim() || null,
        productTitle: productTitle.trim(),
        productQuantity: productQuantity,
        productImage: null,
      },
      testBillId
    );

    if (result.success) {
      return json({
        success: true,
        message: `Notification de test envoyée à ${agent.name} (${agent.whatsappJid})`,
        messageId: result.messageId,
        testData: {
          agentName: agent.name,
          productTitle: productTitle.trim(),
          productQuantity,
          orderName: `#TEST-${new Date().getTime().toString().slice(-6)}`,
        },
      });
    } else {
      return json(
        { error: `Échec de l'envoi: ${result.error}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[WhatsApp Test Delivery] Action error:", error);
    return json(
      { error: "Erreur lors de l'envoi de la notification" },
      { status: 500 }
    );
  }
}
