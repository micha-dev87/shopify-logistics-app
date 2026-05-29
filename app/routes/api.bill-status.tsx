import type { LoaderFunctionArgs } from "@remix-run/node";
import crypto from "crypto";
import prisma from "../db.server";
import { notifyOwnerOnStatusChange } from "../whatsapp.server";

// ============================================================
// STATUS UPDATE via lien WhatsApp
// GET /api/bill-status?id={billId}&s={status}&t={token}
// ============================================================

function verifyStatusToken(billId: string, status: string, token: string): boolean {
  const secret =
    process.env.SHOPIFY_WEBHOOK_SIGNING_SECRET ||
    process.env.SHOPIFY_API_SECRET ||
    "whatsapp-status-default";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${billId}:${status}`)
    .digest("hex")
    .slice(0, 16);
  return token === expected;
}

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "📦 Pris en charge",
  DELIVERED: "✅ Livré",
  NOT_DELIVERED: "❌ Non livré",
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const billId = url.searchParams.get("id");
  const status = url.searchParams.get("s");
  const token = url.searchParams.get("t");

  if (!billId || !status || !token) {
    return new Response(errorHtml("Paramètres manquants"), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const validStatuses = ["IN_PROGRESS", "DELIVERED", "NOT_DELIVERED"];
  if (!validStatuses.includes(status)) {
    return new Response(errorHtml("Statut invalide"), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!verifyStatusToken(billId, status, token)) {
    return new Response(errorHtml("Lien invalide ou expiré"), {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const bill = await prisma.deliveryBill.findUnique({ where: { id: billId } });
  if (!bill) {
    return new Response(errorHtml("Bon de livraison introuvable"), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Mise à jour du statut
  const statusHistory = (bill.statusHistory as any[]) || [];
  statusHistory.push({
    status,
    timestamp: new Date().toISOString(),
    previousStatus: bill.status,
    source: "whatsapp_url_link",
  });

  await prisma.deliveryBill.update({
    where: { id: billId },
    data: { status: status as any, statusHistory },
  });

  console.log("[BillStatus] Statut mis à jour via lien WhatsApp", {
    billId,
    oldStatus: bill.status,
    newStatus: status,
    orderName: bill.orderName,
  });

  // Notify the shop owner (best-effort). bill.status is the pre-update status captured above.
  try {
    await notifyOwnerOnStatusChange(bill.shopId, billId, bill.status, status, "whatsapp_url_link");
  } catch (e) {
    console.error("[BillStatus] Owner notification failed:", e);
  }

  return new Response(
    successHtml(STATUS_LABELS[status] || status, bill.orderName || billId),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function successHtml(statusLabel: string, orderName: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Statut mis à jour</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #f0fdf4; padding: 20px;
    }
    .card {
      background: white; border-radius: 20px; padding: 48px 40px;
      text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.08);
      max-width: 380px; width: 100%;
    }
    .icon { font-size: 72px; margin-bottom: 20px; display: block; }
    h1 { color: #15803d; font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .order { color: #374151; font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .status { color: #6b7280; font-size: 18px; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="icon">✅</span>
    <h1>Statut mis à jour</h1>
    <p class="order">${orderName}</p>
    <p class="status">${statusLabel}</p>
  </div>
</body>
</html>`;
}

function errorHtml(message: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erreur</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #fff5f5; padding: 20px;
    }
    .card {
      background: white; border-radius: 20px; padding: 48px 40px;
      text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.08);
      max-width: 380px; width: 100%;
    }
    .icon { font-size: 72px; margin-bottom: 20px; display: block; }
    h1 { color: #991b1b; font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    p { color: #6b7280; font-size: 15px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="icon">⚠️</span>
    <h1>Erreur</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
