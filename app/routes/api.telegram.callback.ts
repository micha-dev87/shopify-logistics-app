import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { createTelegramService } from "../telegram.server";
import type { DeliveryStatus } from "@prisma/client";

// ============================================================
// TELEGRAM CALLBACK WEBHOOK
// Handles inline button clicks from delivery agents
// ============================================================

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: { id: number };
      text?: string;
    };
    data: string; // callback_data format: "status_{billId}_{status}"
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  // Parse Telegram update
  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only handle callback queries
  if (!update.callback_query) {
    return json({ message: "Not a callback query" }, { status: 200 });
  }

  const { id: callbackId, from, message, data } = update.callback_query;

  if (!message || !data) {
    return json({ message: "Missing message or data" }, { status: 200 });
  }

  const chatId = message.chat.id;
  const messageId = message.message_id;

  console.log("[Telegram Callback] Received", {
    callbackId,
    from: from.username || from.id,
    data,
  });

  try {
    // Parse callback data: "status_{billId}_{status}"
    const parts = data.split("_");
    if (parts.length !== 3 || parts[0] !== "status") {
      console.error("[Telegram Callback] Invalid callback data format", { data });
      return json({ error: "Invalid callback data" }, { status: 400 });
    }

    const billId = parts[1];
    const newStatus = parts[2] as DeliveryStatus;

    // Find the bill
    const bill = await prisma.deliveryBill.findUnique({
      where: { id: billId },
      include: {
        shop: true,
        assignedAgent: true,
      },
    });

    if (!bill) {
      console.error("[Telegram Callback] Bill not found", { billId });
      return json({ error: "Bill not found" }, { status: 404 });
    }

    // Verify the agent is assigned to this bill
    if (!bill.assignedAgent || bill.assignedAgent.telegramUserId !== from.id.toString()) {
      console.error("[Telegram Callback] Agent not authorized", {
        billId,
        telegramUserId: from.id,
        assignedAgent: bill.assignedAgent?.id,
      });
      return json({ error: "Not authorized" }, { status: 403 });
    }

    // Validate status transition
    const validTransitions: Record<string, DeliveryStatus[]> = {
      PENDING: ["ASSIGNED", "CANCELLED"],
      ASSIGNED: ["IN_PROGRESS", "PENDING", "DELIVERED", "NOT_DELIVERED", "CANCELLED"],
      IN_PROGRESS: ["DELIVERED", "NOT_DELIVERED", "CANCELLED"],
      NOT_DELIVERED: ["IN_PROGRESS", "CANCELLED"],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (!validTransitions[bill.status]?.includes(newStatus)) {
      console.error("[Telegram Callback] Invalid status transition", {
        billId,
        currentStatus: bill.status,
        newStatus,
      });
      return json({ error: "Invalid status transition" }, { status: 400 });
    }

    // Update bill status
    const statusHistory = (bill.statusHistory as any[]) || [];
    statusHistory.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      previousStatus: bill.status,
      source: "telegram_callback",
      agentId: bill.assignedAgent.id,
      agentName: bill.assignedAgent.name,
      telegramUserId: from.id,
    });

    await prisma.deliveryBill.update({
      where: { id: billId },
      data: {
        status: newStatus,
        statusHistory,
      },
    });

    console.log("[Telegram Callback] Status updated", {
      billId,
      oldStatus: bill.status,
      newStatus,
    });

    // Update the Telegram message with new status
    if (bill.shop.telegramBotToken) {
      const telegram = createTelegramService(bill.shop.telegramBotToken);
      await telegram.updateMessageStatus(chatId, messageId, newStatus, billId);
      await telegram.answerCallbackQuery(callbackId, `Statut mis à jour: ${getStatusLabel(newStatus)}`);
    }

    return json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[Telegram Callback] Error processing callback:", error);
    return json({ error: "Processing error" }, { status: 500 });
  }
};

function getStatusLabel(status: DeliveryStatus): string {
  const labels: Record<DeliveryStatus, string> = {
    PENDING: "En attente",
    ASSIGNED: "Assigné",
    IN_PROGRESS: "En cours",
    DELIVERED: "Livré",
    NOT_DELIVERED: "Non livré",
    CANCELLED: "Annulé",
  };
  return labels[status] || status;
}
