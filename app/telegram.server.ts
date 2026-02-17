// Telegram Bot Service
// Handles sending notifications to delivery agents and processing callbacks

import type { DeliveryBill, DeliveryAgent, Shop } from "@prisma/client";

// ============================================================
// TYPES
// ============================================================
interface TelegramMessage {
  chat_id: string | number;
  text?: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  photo?: string;
  caption?: string;
  reply_markup?: {
    inline_keyboard?: InlineKeyboardButton[][];
  };
}

interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

interface TelegramResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
  description?: string;
}

// ============================================================
// TELEGRAM API CLIENT
// ============================================================
class TelegramService {
  private botToken: string;
  private baseUrl: string;

  constructor(botToken: string) {
    this.botToken = botToken;
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Test if the bot token is valid
   */
  async testConnection(): Promise<{ success: boolean; botInfo?: any; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/getMe`);
      const data = (await response.json()) as TelegramResponse;

      if (data.ok && data.result) {
        return { success: true, botInfo: data.result };
      }

      return { success: false, error: data.description || "Invalid bot token" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Set webhook for receiving callback queries
   */
  async setWebhook(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = (await response.json()) as TelegramResponse;

      return { success: data.ok, error: data.description };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to set webhook",
      };
    }
  }

  /**
   * Send a delivery notification to an agent
   */
  async sendDeliveryNotification(
    chatId: string | number,
    bill: {
      orderName: string | null;
      customerName: string;
      customerAddress: string;
      customerPhone: string | null;
      productTitle: string;
      productImage: string | null;
      productQuantity: number;
    },
    billId: string
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      const message = this.formatDeliveryMessage(bill);
      const inlineKeyboard = this.createDeliveryKeyboard(billId);

      let response: TelegramResponse;

      // Send photo if available, otherwise send text
      if (bill.productImage) {
        response = await this.sendPhoto({
          chat_id: chatId,
          photo: bill.productImage,
          caption: message,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        });
      } else {
        response = await this.sendMessage({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        });
      }

      if (response.ok && response.result) {
        return { success: true, messageId: response.result.message_id };
      }

      return { success: false, error: response.description };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send notification",
      };
    }
  }

  /**
   * Update a message with new status
   */
  async updateMessageStatus(
    chatId: string | number,
    messageId: number,
    status: string,
    billId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const statusEmoji = this.getStatusEmoji(status);
      const statusText = this.getStatusText(status);

      const response = await fetch(`${this.baseUrl}/editMessageReplyMarkup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `${statusEmoji} ${statusText}`,
                  callback_data: `status_${billId}_${status}`,
                },
              ],
            ],
          },
        }),
      });

      const data = (await response.json()) as TelegramResponse;
      return { success: data.ok, error: data.description };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update message",
      };
    }
  }

  /**
   * Answer callback query (remove loading state)
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string
  ): Promise<{ success: boolean }> {
    try {
      await fetch(`${this.baseUrl}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || "✅ Mis à jour",
          show_alert: false,
        }),
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private async sendMessage(params: TelegramMessage): Promise<TelegramResponse> {
    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return response.json();
  }

  private async sendPhoto(params: TelegramMessage): Promise<TelegramResponse> {
    const response = await fetch(`${this.baseUrl}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return response.json();
  }

  private formatDeliveryMessage(bill: {
    orderName: string | null;
    customerName: string;
    customerAddress: string;
    customerPhone: string | null;
    productTitle: string;
    productQuantity: number;
  }): string {
    return `
🚚 <b>Nouvelle livraison assignée</b>

📦 <b>Commande:</b> ${bill.orderName || "N/A"}

👤 <b>Client:</b> ${bill.customerName}
📍 <b>Adresse:</b> ${bill.customerAddress}
📞 <b>Téléphone:</b> ${bill.customerPhone || "Non renseigné"}

🛍️ <b>Produit:</b> ${bill.productTitle}
📊 <b>Quantité:</b> ${bill.productQuantity}

<i>Cliquez sur un bouton ci-dessous pour mettre à jour le statut.</i>
    `.trim();
  }

  private createDeliveryKeyboard(billId: string): InlineKeyboardButton[][] {
    return [
      [
        {
          text: "📦 Pris en charge",
          callback_data: `status_${billId}_IN_PROGRESS`,
        },
      ],
      [
        {
          text: "✅ Livré",
          callback_data: `status_${billId}_DELIVERED`,
        },
        {
          text: "❌ Non livré",
          callback_data: `status_${billId}_NOT_DELIVERED`,
        },
      ],
    ];
  }

  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      IN_PROGRESS: "📦",
      DELIVERED: "✅",
      NOT_DELIVERED: "❌",
    };
    return emojis[status] || "📋";
  }

  private getStatusText(status: string): string {
    const texts: Record<string, string> = {
      IN_PROGRESS: "Pris en charge",
      DELIVERED: "Livré",
      NOT_DELIVERED: "Non livré",
    };
    return texts[status] || status;
  }
}

// ============================================================
// EXPORTS
// ============================================================

export { TelegramService };

/**
 * Factory function to create Telegram service for a shop
 */
export function createTelegramService(botToken: string): TelegramService {
  return new TelegramService(botToken);
}

/**
 * Send delivery notification to agent
 * This is the main function to call from the attribution logic
 */
export async function notifyAgentOfDelivery(
  agent: DeliveryAgent & { shop: Shop },
  bill: DeliveryBill,
  botToken: string
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  if (!agent.telegramUserId) {
    return { success: false, error: "Agent has no Telegram user ID" };
  }

  const telegram = createTelegramService(botToken);

  return telegram.sendDeliveryNotification(
    agent.telegramUserId,
    {
      orderName: bill.orderName,
      customerName: bill.customerName,
      customerAddress: bill.customerAddress,
      customerPhone: bill.customerPhone,
      productTitle: bill.productTitle,
      productImage: bill.productImage,
      productQuantity: bill.productQuantity,
    },
    bill.id
  );
}
