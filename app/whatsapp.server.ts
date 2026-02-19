// WhatsApp Service using Baileys
// Handles QR authentication, message sending with buttons, and callbacks

import type { DeliveryBill, DeliveryAgent, Shop } from "@prisma/client";
import prisma from "./db.server";
import { Redis } from "ioredis";

// ============================================================
// TYPES
// ============================================================

interface WhatsAppMessage {
  text: string;
  buttons?: WhatsAppButton[];
  imageUrl?: string;
}

interface WhatsAppButton {
  buttonId: string;
  buttonText: { displayText: string };
  type: 1;
}

interface DeliveryNotificationData {
  orderName: string | null;
  customerName: string;
  customerAddress: string;
  customerPhone: string | null;
  productTitle: string;
  productImage: string | null;
  productQuantity: number;
}

interface ConnectionStatus {
  connected: boolean;
  phoneNumber?: string;
  qrCode?: string;
  qrExpiry?: Date;
  error?: string;
}

interface RateLimitInfo {
  dailyCount: number;
  dailyLimit: number;
  remaining: number;
  resetAt: Date;
}

// ============================================================
// REDIS CLIENT (Singleton)
// ============================================================

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redis = new Redis(redisUrl);
  }
  return redis;
}

// ============================================================
// SOCKET MANAGER (In-memory socket management)
// ============================================================

// Store active sockets by shopId
const activeSockets = new Map<string, any>();

// Store QR callbacks by shopId
const qrCallbacks = new Map<string, (qr: string) => void>();

// Store connection status callbacks by shopId
const statusCallbacks = new Map<string, (status: ConnectionStatus) => void>();

// ============================================================
// RATE LIMITER
// ============================================================

const DAILY_LIMIT = 250; // WhatsApp unverified account limit
const ALERT_THRESHOLD = 200; // Alert at 80%

async function checkRateLimit(shopId: string): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const redis = getRedis();
  const today = new Date().toISOString().split("T")[0];
  const key = `whatsapp:rate:${shopId}:${today}`;
  
  const currentCount = parseInt(await redis.get(key) || "0", 10);
  
  // Calculate reset time (midnight UTC)
  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);
  
  const info: RateLimitInfo = {
    dailyCount: currentCount,
    dailyLimit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - currentCount),
    resetAt,
  };
  
  return {
    allowed: currentCount < DAILY_LIMIT,
    info,
  };
}

async function incrementRateLimit(shopId: string): Promise<void> {
  const redis = getRedis();
  const today = new Date().toISOString().split("T")[0];
  const key = `whatsapp:rate:${shopId}:${today}`;
  
  // Increment with 24h expiry
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, 86400); // 24 hours
  }
  
  // Update shop record for dashboard
  await prisma.shop.update({
    where: { id: shopId },
    data: {
      whatsappDailyCount: current,
      whatsappCountDate: new Date(),
    },
  });
}

async function getRateLimitInfo(shopId: string): Promise<RateLimitInfo> {
  const { info } = await checkRateLimit(shopId);
  return info;
}

// ============================================================
// AUTH STATE MANAGEMENT (Redis-based)
// ============================================================

async function getAuthState(shopId: string): Promise<{ creds: any; keys: any } | null> {
  const session = await prisma.whatsAppSession.findUnique({
    where: { shopId },
  });
  
  if (!session) {
    return null;
  }
  
  return {
    creds: session.creds,
    keys: session.keys,
  };
}

async function saveAuthState(shopId: string, creds: any, keys: any): Promise<void> {
  await prisma.whatsAppSession.upsert({
    where: { shopId },
    create: {
      shopId,
      creds,
      keys,
      connected: false,
    },
    update: {
      creds,
      keys,
      updatedAt: new Date(),
    },
  });
}

async function saveQRCode(shopId: string, qr: string): Promise<void> {
  const expiry = new Date(Date.now() + 60000); // QR expires in 60 seconds
  
  await prisma.whatsAppSession.upsert({
    where: { shopId },
    create: {
      shopId,
      creds: {},
      keys: {},
      lastQr: qr,
      qrExpiry: expiry,
      connected: false,
    },
    update: {
      lastQr: qr,
      qrExpiry: expiry,
      connected: false,
    },
  });
}

async function clearQRCode(shopId: string): Promise<void> {
  await prisma.whatsAppSession.update({
    where: { shopId },
    data: {
      lastQr: null,
      qrExpiry: null,
    },
  });
}

async function setConnected(shopId: string, phoneNumber: string): Promise<void> {
  await prisma.whatsAppSession.update({
    where: { shopId },
    data: {
      connected: true,
      phoneNumber,
      lastQr: null,
      qrExpiry: null,
    },
  });
  
  await prisma.shop.update({
    where: { id: shopId },
    data: {
      whatsappEnabled: true,
      whatsappConnectedAt: new Date(),
      whatsappPhone: phoneNumber,
    },
  });
}

async function setDisconnected(shopId: string): Promise<void> {
  await prisma.whatsAppSession.update({
    where: { shopId },
    data: {
      connected: false,
      phoneNumber: null,
    },
  });
  
  await prisma.shop.update({
    where: { id: shopId },
    data: {
      whatsappEnabled: false,
      whatsappPhone: null,
    },
  });
}

// ============================================================
// WHATSAPP SERVICE CLASS
// ============================================================

class WhatsAppService {
  private shopId: string;
  private socket: any = null;
  
  constructor(shopId: string) {
    this.shopId = shopId;
  }
  
  /**
   * Initialize WhatsApp connection and generate QR code
   */
  async connect(
    onQr: (qr: string) => void,
    onStatusChange: (status: ConnectionStatus) => void
  ): Promise<void> {
    // Store callbacks
    qrCallbacks.set(this.shopId, onQr);
    statusCallbacks.set(this.shopId, onStatusChange);
    
    // Check if socket already exists
    if (activeSockets.has(this.shopId)) {
      const session = await prisma.whatsAppSession.findUnique({
        where: { shopId: this.shopId },
      });
      
      if (session?.connected) {
        onStatusChange({
          connected: true,
          phoneNumber: session.phoneNumber || undefined,
        });
        return;
      }
    }
    
    await this.createSocket();
  }
  
  /**
   * Create a new Baileys socket
   */
  private async createSocket(): Promise<void> {
    // Dynamic import for Baileys (ESM only)
    const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = 
      await import("@whiskeysockets/baileys");
    
    const authState = await getAuthState(this.shopId);
    
    // Create socket
    this.socket = makeWASocket({
      auth: authState ? {
        creds: authState.creds,
        keys: {
          get: async (type: string, ids: string[]) => {
            const data: Record<string, any> = {};
            for (const id of ids) {
              data[id] = authState.keys[`${type}-${id}`] || null;
            }
            return data;
          },
          set: async (data: Record<string, any>) => {
            const keys = authState.keys || {};
            for (const [key, value] of Object.entries(data)) {
              keys[key] = value;
            }
            await saveAuthState(this.shopId, authState.creds, keys);
          },
        },
      } : undefined,
      printQRInTerminal: false,
      browser: ["Shopify Logistics", "Chrome", "1.0.0"],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });
    
    activeSockets.set(this.shopId, this.socket);
    
    // Handle connection updates
    this.socket.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      const statusCallback = statusCallbacks.get(this.shopId);
      const qrCallback = qrCallbacks.get(this.shopId);
      
      if (qr) {
        // Save and emit QR code
        await saveQRCode(this.shopId, qr);
        if (qrCallback) {
          qrCallback(qr);
        }
        if (statusCallback) {
          statusCallback({
            connected: false,
            qrCode: qr,
            qrExpiry: new Date(Date.now() + 60000),
          });
        }
      }
      
      if (connection === "open") {
        const phoneNumber = this.socket.user?.id?.split("@")[0] || "Unknown";
        await setConnected(this.shopId, phoneNumber);
        await clearQRCode(this.shopId);
        
        if (statusCallback) {
          statusCallback({
            connected: true,
            phoneNumber,
          });
        }
      }
      
      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        await setDisconnected(this.shopId);
        
        if (statusCallback) {
          statusCallback({
            connected: false,
            error: lastDisconnect?.error?.message || "Disconnected",
          });
        }
        
        if (shouldReconnect) {
          // Reconnect after a short delay
          setTimeout(() => this.createSocket(), 5000);
        } else {
          // User logged out, clear session
          activeSockets.delete(this.shopId);
        }
      }
    });
    
    // Save credentials on update
    this.socket.ev.on("creds.update", async (creds: any) => {
      const currentState = await getAuthState(this.shopId);
      await saveAuthState(this.shopId, creds, currentState?.keys || {});
    });
    
    // Handle incoming messages (for button callbacks)
    this.socket.ev.on("messages.upsert", async ({ messages }: any) => {
      const msg = messages[0];
      
      if (msg.message?.buttonsResponseMessage) {
        const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
        const from = msg.key.remoteJid;
        
        // Emit button click event
        await handleButtonClick(this.shopId, buttonId, from);
      }
    });
  }
  
  /**
   * Send delivery notification with buttons
   */
  async sendDeliveryNotification(
    jid: string,
    bill: DeliveryNotificationData,
    billId: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Check rate limit
    const rateCheck = await checkRateLimit(this.shopId);
    if (!rateCheck.allowed) {
      return { 
        success: false, 
        error: `Rate limit exceeded. Reset at ${rateCheck.info.resetAt.toISOString()}` 
      };
    }
    
    if (!this.socket) {
      const session = await prisma.whatsAppSession.findUnique({
        where: { shopId: this.shopId },
      });
      
      if (!session?.connected) {
        return { success: false, error: "WhatsApp not connected" };
      }
      
      // Socket should exist if connected
      this.socket = activeSockets.get(this.shopId);
      if (!this.socket) {
        return { success: false, error: "WhatsApp socket not available" };
      }
    }
    
    try {
      const message = this.formatDeliveryMessage(bill);
      const buttons = this.createDeliveryButtons(billId);
      
      // Add random delay for human-like behavior (2-5 seconds)
      const delay = Math.floor(Math.random() * 3000) + 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const result = await this.socket.sendMessage(jid, {
        text: message,
        buttons,
        headerType: 1,
      });
      
      // Increment rate limit counter
      await incrementRateLimit(this.shopId);
      
      return { 
        success: true, 
        messageId: result?.key?.id 
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send message",
      };
    }
  }
  
  /**
   * Disconnect WhatsApp
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      await this.socket.end();
      activeSockets.delete(this.shopId);
    }
    
    await setDisconnected(this.shopId);
    
    const statusCallback = statusCallbacks.get(this.shopId);
    if (statusCallback) {
      statusCallback({ connected: false });
    }
  }
  
  /**
   * Get current connection status
   */
  async getStatus(): Promise<ConnectionStatus> {
    const session = await prisma.whatsAppSession.findUnique({
      where: { shopId: this.shopId },
    });
    
    if (!session) {
      return { connected: false };
    }
    
    if (session.connected) {
      return {
        connected: true,
        phoneNumber: session.phoneNumber || undefined,
      };
    }
    
    if (session.lastQr && session.qrExpiry && session.qrExpiry > new Date()) {
      return {
        connected: false,
        qrCode: session.lastQr,
        qrExpiry: session.qrExpiry,
      };
    }
    
    return { connected: false };
  }
  
  // ============================================================
  // PRIVATE HELPERS
  // ============================================================
  
  private formatDeliveryMessage(bill: DeliveryNotificationData): string {
    return `🚚 *Nouvelle livraison assignée*

📦 *Commande:* ${bill.orderName || "N/A"}

👤 *Client:* ${bill.customerName}
📍 *Adresse:* ${bill.customerAddress}
📞 *Téléphone:* ${bill.customerPhone || "Non renseigné"}

🛍️ *Produit:* ${bill.productTitle}
📊 *Quantité:* ${bill.productQuantity}

_Cliquez sur un bouton ci-dessous pour mettre à jour le statut._`;
  }
  
  private createDeliveryButtons(billId: string): WhatsAppButton[] {
    return [
      {
        buttonId: `status_${billId}_IN_PROGRESS`,
        buttonText: { displayText: "📦 Pris en charge" },
        type: 1,
      },
      {
        buttonId: `status_${billId}_DELIVERED`,
        buttonText: { displayText: "✅ Livré" },
        type: 1,
      },
      {
        buttonId: `status_${billId}_NOT_DELIVERED`,
        buttonText: { displayText: "❌ Non livré" },
        type: 1,
      },
    ];
  }
}

// ============================================================
// BUTTON CLICK HANDLER
// ============================================================

async function handleButtonClick(shopId: string, buttonId: string, fromJid: string): Promise<void> {
  // Parse callback data: "status_{billId}_{status}"
  const parts = buttonId.split("_");
  if (parts.length !== 3 || parts[0] !== "status") {
    console.error("[WhatsApp Callback] Invalid button ID format", { buttonId });
    return;
  }
  
  const billId = parts[1];
  const newStatus = parts[2];
  
  console.log("[WhatsApp Callback] Button clicked", { shopId, billId, newStatus, fromJid });
  
  try {
    // Find the bill
    const bill = await prisma.deliveryBill.findUnique({
      where: { id: billId },
      include: {
        shop: true,
        assignedAgent: true,
      },
    });
    
    if (!bill) {
      console.error("[WhatsApp Callback] Bill not found", { billId });
      return;
    }
    
    // Verify the agent is assigned to this bill
    if (!bill.assignedAgent || bill.assignedAgent.whatsappJid !== fromJid) {
      console.error("[WhatsApp Callback] Agent not authorized", {
        billId,
        fromJid,
        assignedAgent: bill.assignedAgent?.id,
      });
      return;
    }
    
    // Update bill status
    const statusHistory = (bill.statusHistory as any[]) || [];
    statusHistory.push({
      status: newStatus,
      timestamp: new Date().toISOString(),
      previousStatus: bill.status,
      source: "whatsapp_callback",
      agentId: bill.assignedAgent.id,
      agentName: bill.assignedAgent.name,
      whatsappJid: fromJid,
    });
    
    await prisma.deliveryBill.update({
      where: { id: billId },
      data: {
        status: newStatus as any,
        statusHistory,
      },
    });
    
    console.log("[WhatsApp Callback] Status updated", {
      billId,
      oldStatus: bill.status,
      newStatus,
    });
    
    // Send confirmation reply
    const socket = activeSockets.get(shopId);
    if (socket) {
      const statusLabel = getStatusLabel(newStatus);
      await socket.sendMessage(fromJid, {
        text: `✅ Statut mis à jour: *${statusLabel}*`,
      });
    }
  } catch (error) {
    console.error("[WhatsApp Callback] Error processing button click:", error);
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    IN_PROGRESS: "Pris en charge",
    DELIVERED: "Livré",
    NOT_DELIVERED: "Non livré",
  };
  return labels[status] || status;
}

// ============================================================
// EXPORTS
// ============================================================

export { WhatsAppService };
export type { ConnectionStatus, RateLimitInfo, DeliveryNotificationData };

/**
 * Factory function to create WhatsApp service for a shop
 */
export function createWhatsAppService(shopId: string): WhatsAppService {
  return new WhatsAppService(shopId);
}

/**
 * Send delivery notification to agent via WhatsApp
 * This is the main function to call from the attribution logic
 */
export async function notifyAgentViaWhatsApp(
  agent: DeliveryAgent & { shop: Shop },
  bill: DeliveryBill
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!agent.whatsappJid) {
    return { success: false, error: "Agent has no WhatsApp JID" };
  }
  
  if (!agent.shop.whatsappEnabled) {
    return { success: false, error: "WhatsApp not enabled for this shop" };
  }
  
  const whatsapp = createWhatsAppService(agent.shop.id);
  
  return whatsapp.sendDeliveryNotification(
    agent.whatsappJid,
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

/**
 * Get rate limit info for dashboard
 */
export async function getWhatsAppRateLimitInfo(shopId: string): Promise<RateLimitInfo> {
  return getRateLimitInfo(shopId);
}

/**
 * Get WhatsApp connection status for a shop
 */
export async function getWhatsAppStatus(shopId: string): Promise<ConnectionStatus> {
  const service = createWhatsAppService(shopId);
  return service.getStatus();
}

/**
 * Initialize WhatsApp connection for a shop (generates QR code)
 */
export async function initWhatsAppConnection(
  shopId: string,
  onQr: (qr: string) => void,
  onStatusChange: (status: ConnectionStatus) => void
): Promise<void> {
  const service = createWhatsAppService(shopId);
  return service.connect(onQr, onStatusChange);
}

/**
 * Disconnect WhatsApp for a shop
 */
export async function disconnectWhatsApp(shopId: string): Promise<void> {
  const service = createWhatsAppService(shopId);
  return service.disconnect();
}
