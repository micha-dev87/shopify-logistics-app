import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  TextField,
  Button,
  Banner,
  Divider,
  FormLayout,
  Toast,
  Frame,
  Box,
  Select,
  ProgressBar,
  SkeletonThumbnail,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useCallback, useState, useEffect, useRef } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createTelegramService } from "../telegram.server";
import {
  getWhatsAppStatus,
  getWhatsAppRateLimitInfo,
  type ConnectionStatus,
  type RateLimitInfo,
} from "../whatsapp.server";

// ============================================================
// TYPES
// ============================================================
type NotificationMode = "TELEGRAM" | "WHATSAPP" | "BOTH";

interface LoaderData {
  shop: {
    id: string;
    name: string;
    domain: string;
    plan: string | null;
    telegramBotToken: string | null;
    telegramWebhookSet: boolean;
    notificationMode: NotificationMode;
    whatsappEnabled: boolean;
    whatsappPhone: string | null;
    hasRealToken: boolean;
  } | null;
  hasBot: boolean;
  whatsapp: {
    status: ConnectionStatus;
    rateLimit: RateLimitInfo;
  } | null;
}

// ============================================================
// LOADER
// ============================================================
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: {
      id: true,
      name: true,
      domain: true,
      plan: true,
      telegramBotToken: true,
      telegramWebhookSet: true,
      notificationMode: true,
      whatsappEnabled: true,
      whatsappPhone: true,
      createdAt: true,
    },
  });

  if (!shop) {
    return json({ shop: null, hasBot: false, whatsapp: null });
  }

  // Mask the bot token for display
  const maskedToken = shop.telegramBotToken
    ? `${shop.telegramBotToken.substring(0, 10)}...${shop.telegramBotToken.substring(shop.telegramBotToken.length - 5)}`
    : null;

  // Get WhatsApp status and rate limit
  let waStatus = null;
  let waRateLimit = null;
  try {
    waStatus = await getWhatsAppStatus(shop.id);
    waRateLimit = await getWhatsAppRateLimitInfo(shop.id);
  } catch (error) {
    console.error("Error fetching WhatsApp status:", error);
  }

  return json({
    shop: {
      ...shop,
      telegramBotToken: maskedToken,
      hasRealToken: !!shop.telegramBotToken,
    },
    hasBot: !!shop.telegramBotToken,
    whatsapp: waStatus && waRateLimit ? { status: waStatus, rateLimit: waRateLimit } : null,
  });
};

// ============================================================
// ACTION
// ============================================================
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
  });

  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  try {
    switch (actionType) {
      case "saveBotToken": {
        const botToken = formData.get("botToken") as string;

        if (!botToken || botToken.trim().length < 40) {
          return json({ error: "Token invalide. Le token doit faire au moins 40 caractères." });
        }

        // Test the bot token
        const telegram = createTelegramService(botToken.trim());
        const testResult = await telegram.testConnection();

        if (!testResult.success) {
          return json({
            error: `Token invalide: ${testResult.error || "Vérifiez que le token est correct."}`,
          });
        }

        // Save the token
        await prisma.shop.update({
          where: { id: shop.id },
          data: {
            telegramBotToken: botToken.trim(),
          },
        });

        // Set webhook for callback handling
        const appUrl = process.env.SHOPIFY_APP_URL;
        if (appUrl) {
          const webhookUrl = `${appUrl}/api/telegram/callback`;
          await telegram.setWebhook(webhookUrl);

          await prisma.shop.update({
            where: { id: shop.id },
            data: { telegramWebhookSet: true },
          });
        }

        return json({
          success: true,
          message: `Bot Telegram "${testResult.botInfo?.username || "configuré"}" connecté avec succès!`,
          botInfo: testResult.botInfo,
        });
      }

      case "testNotification": {
        const testChatId = formData.get("testChatId") as string;

        if (!shop.telegramBotToken) {
          return json({ error: "Aucun bot Telegram configuré" });
        }

        if (!testChatId) {
          return json({ error: "Veuillez entrer votre Telegram Chat ID" });
        }

        const telegram = createTelegramService(shop.telegramBotToken);

        const result = await telegram.sendDeliveryNotification(
          testChatId,
          {
            orderName: "#TEST-001",
            customerName: "Client Test",
            customerAddress: "123 Rue de Test, Paris",
            customerPhone: "+33123456789",
            productTitle: "Produit de test",
            productImage: null,
            productQuantity: 1,
          },
          "test-bill-id"
        );

        if (result.success) {
          return json({ success: true, message: "Notification de test envoyée avec succès!" });
        } else {
          return json({ error: `Erreur: ${result.error}` });
        }
      }

      case "removeBotToken": {
        await prisma.shop.update({
          where: { id: shop.id },
          data: {
            telegramBotToken: null,
            telegramWebhookSet: false,
          },
        });

        return json({ success: true, message: "Bot Telegram déconnecté" });
      }

      case "updateNotificationMode": {
        const mode = formData.get("notificationMode") as NotificationMode;

        if (!["TELEGRAM", "WHATSAPP", "BOTH"].includes(mode)) {
          return json({ error: "Mode de notification invalide" });
        }

        await prisma.shop.update({
          where: { id: shop.id },
          data: { notificationMode: mode },
        });

        return json({
          success: true,
          message: `Mode de notification mis à jour: ${getNotificationModeLabel(mode)}`,
        });
      }

      default:
        return json({ error: "Action non reconnue" }, { status: 400 });
    }
  } catch (error) {
    console.error("Settings action error:", error);
    return json({ error: "Une erreur est survenue" }, { status: 500 });
  }
};

function getNotificationModeLabel(mode: NotificationMode): string {
  const labels: Record<NotificationMode, string> = {
    TELEGRAM: "Telegram uniquement",
    WHATSAPP: "WhatsApp uniquement",
    BOTH: "Telegram + WhatsApp (backup)",
  };
  return labels[mode];
}

// ============================================================
// COMPONENT
// ============================================================
export default function SettingsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const qrFetcher = useFetcher();
  const statusFetcher = useFetcher();
  const isSubmitting = navigation.state === "submitting";

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [testChatId, setTestChatId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [notificationMode, setNotificationMode] = useState<NotificationMode>(
    loaderData.shop?.notificationMode || "TELEGRAM"
  );
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<ConnectionStatus | null>(loaderData.whatsapp?.status || null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(loaderData.whatsapp?.rateLimit || null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (actionData?.success) {
      setToastMessage(actionData.message);
      setToastError(false);
      setBotToken("");
    } else if (actionData?.error) {
      setToastMessage(actionData.error);
      setToastError(true);
    }
  }, [actionData]);

  // Poll WhatsApp status when waiting for connection
  useEffect(() => {
    if (waStatus?.qrCode && !waStatus.connected) {
      pollingRef.current = setInterval(async () => {
        statusFetcher.load("/api/whatsapp/status");
      }, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [waStatus?.qrCode, waStatus?.connected]);

  // Update status from fetcher
  useEffect(() => {
    if (statusFetcher.data?.success) {
      setWaStatus(statusFetcher.data.connection);
      setRateLimit(statusFetcher.data.rateLimit);
      
      // Generate QR code image URL
      if (statusFetcher.data.connection.qrCode && !statusFetcher.data.connection.connected) {
        generateQRCodeImage(statusFetcher.data.connection.qrCode);
      }
    }
  }, [statusFetcher.data]);

  // Generate QR code image
  const generateQRCodeImage = async (qrData: string) => {
    try {
      const QRCode = (await import("qrcode")).default;
      // Decode base64 QR code back to original format
      const qrRaw = atob(qrData);
      const url = await QRCode.toDataURL(qrRaw, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrCodeUrl(url);
    } catch (err) {
      console.error("Error generating QR code:", err);
    }
  };

  // Initialize WhatsApp connection
  const handleInitWhatsApp = async () => {
    qrFetcher.submit({}, { method: "POST", action: "/api/whatsapp/qr" });
  };

  // Handle QR fetcher response
  useEffect(() => {
    if (qrFetcher.data?.success) {
      setWaStatus(qrFetcher.data.status);
      if (qrFetcher.data.status?.qrCode) {
        generateQRCodeImage(qrFetcher.data.status.qrCode);
      }
    }
  }, [qrFetcher.data]);

  // Disconnect WhatsApp
  const handleDisconnectWhatsApp = async () => {
    qrFetcher.submit({}, { method: "DELETE", action: "/api/whatsapp/qr" });
    setWaStatus({ connected: false });
    setQrCodeUrl(null);
  };

  if (!loaderData.shop) {
    return (
      <Page title="Paramètres">
        <Banner tone="critical">Erreur: Boutique non trouvée</Banner>
      </Page>
    );
  }

  const rateLimitPercent = rateLimit ? Math.round((rateLimit.dailyCount / rateLimit.dailyLimit) * 100) : 0;

  return (
    <Frame>
      <Page title="Paramètres" subtitle={`Boutique: ${loaderData.shop.name}`}>
        <TitleBar title="Paramètres" />
        <BlockStack gap="500">
          {/* Shop Info */}
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Informations de la boutique
                  </Text>
                  <Divider />
                  <InlineStack gap="400" blockAlign="center">
                    <Text variant="bodyMd">
                      <strong>Domaine:</strong> {loaderData.shop.domain}
                    </Text>
                    <Text variant="bodyMd">
                      <strong>Plan:</strong> {loaderData.shop.plan || "Basique"}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

          {/* Notification Mode */}
          <Layout>
            <Layout.Section>
              <Card>
                <Form method="post">
                  <input type="hidden" name="actionType" value="updateNotificationMode" />
                  <input type="hidden" name="notificationMode" value={notificationMode} />
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      Mode de notification
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      Choisissez comment les livreurs recevront les notifications de livraison.
                    </Text>
                    <Select
                      label="Plateforme de notification"
                      options={[
                        { label: "Telegram uniquement", value: "TELEGRAM" },
                        { label: "WhatsApp uniquement", value: "WHATSAPP" },
                        { label: "Telegram + WhatsApp (backup)", value: "BOTH" },
                      ]}
                      value={notificationMode}
                      onChange={(value) => setNotificationMode(value as NotificationMode)}
                      helpText="Si 'Les deux' est sélectionné, Telegram sera essayé en premier, puis WhatsApp en backup."
                    />
                    <Button submit loading={isSubmitting}>
                      Enregistrer le mode
                    </Button>
                  </BlockStack>
                </Form>
              </Card>
            </Layout.Section>
          </Layout>

          {/* Telegram Bot Configuration */}
          <Layout>
            <Layout.Section>
              <Card>
                <Form method="post">
                  <input type="hidden" name="actionType" value="saveBotToken" />
                  <BlockStack gap="400">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        Bot Telegram
                      </Text>
                      {loaderData.hasBot && (
                        <Banner tone="success">
                          <Text variant="bodyMd">Connecté</Text>
                        </Banner>
                      )}
                    </InlineStack>
                    <Text variant="bodyMd" tone="subdued">
                      Configurez votre bot Telegram pour envoyer des notifications aux livreurs. Créez un bot via{" "}
                      <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">
                        @BotFather
                      </a>{" "}
                      sur Telegram.
                    </Text>

                    <Divider />

                    {loaderData.hasBot ? (
                      <BlockStack gap="300">
                        {loaderData.shop.hasRealToken && (
                          <Text variant="bodyMd">Token: {loaderData.shop.telegramBotToken}</Text>
                        )}

                        <InlineStack gap="200">
                          <Button
                            tone="critical"
                            submit
                            loading={isSubmitting}
                            onClick={() => {
                              const form = document.createElement("form");
                              form.method = "post";
                              form.innerHTML = '<input type="hidden" name="actionType" value="removeBotToken">';
                              document.body.appendChild(form);
                              form.submit();
                            }}
                          >
                            Déconnecter le bot
                          </Button>
                        </InlineStack>
                      </BlockStack>
                    ) : (
                      <FormLayout>
                        <TextField
                          label="Token du Bot Telegram"
                          name="botToken"
                          value={botToken}
                          onChange={setBotToken}
                          autoComplete="off"
                          placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                          helpText="Obtenez ce token en créant un bot avec @BotFather sur Telegram"
                          type={showToken ? "text" : "password"}
                          suffix={
                            <Button variant="plain" onClick={() => setShowToken(!showToken)}>
                              {showToken ? "Masquer" : "Afficher"}
                            </Button>
                          }
                        />
                        <InlineStack gap="200">
                          <Button primary submit loading={isSubmitting}>
                            Enregistrer et tester
                          </Button>
                        </InlineStack>
                      </FormLayout>
                    )}
                  </BlockStack>
                </Form>
              </Card>
            </Layout.Section>

            {/* Test Notification */}
            {loaderData.hasBot && (
              <Layout.Section>
                <Card>
                  <Form method="post">
                    <input type="hidden" name="actionType" value="testNotification" />
                    <BlockStack gap="400">
                      <Text as="h2" variant="headingMd">
                        Tester les notifications Telegram
                      </Text>
                      <FormLayout>
                        <TextField
                          label="Votre Telegram Chat ID"
                          name="testChatId"
                          value={testChatId}
                          onChange={setTestChatId}
                          autoComplete="off"
                          placeholder="123456789"
                          helpText={
                            <span>
                              Obtenez votre Chat ID en envoyant un message à{" "}
                              <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer">
                                @userinfobot
                              </a>{" "}
                              sur Telegram
                            </span>
                          }
                        />
                        <Button submit loading={isSubmitting}>
                          Envoyer une notification de test
                        </Button>
                      </FormLayout>
                    </BlockStack>
                  </Form>
                </Card>
              </Layout.Section>
            )}
          </Layout>

          {/* WhatsApp Configuration */}
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      WhatsApp Business
                    </Text>
                    {waStatus?.connected && (
                      <Banner tone="success">
                        <Text variant="bodyMd">Connecté ({waStatus.phoneNumber})</Text>
                      </Banner>
                    )}
                  </InlineStack>
                  <Text variant="bodyMd" tone="subdued">
                    Scannez le QR code avec WhatsApp pour connecter votre compte et envoyer des notifications aux
                    livreurs.
                  </Text>

                  <Divider />

                  {waStatus?.connected ? (
                    <BlockStack gap="400">
                      <Banner tone="success">
                        <BlockStack gap="200">
                          <Text variant="bodyMd" fontWeight="semibold">
                            WhatsApp connecté
                          </Text>
                          <Text variant="bodyMd">Numéro: {waStatus.phoneNumber}</Text>
                        </BlockStack>
                      </Banner>

                      {/* Rate Limit Dashboard */}
                      {rateLimit && (
                        <BlockStack gap="300">
                          <Text as="h3" variant="headingSm">
                            Consommation journalière
                          </Text>
                          <Box paddingBlock="200">
                            <ProgressBar
                              progress={rateLimitPercent}
                              tone={rateLimitPercent >= 95 ? "critical" : rateLimitPercent >= 80 ? "warning" : "primary"}
                              size="medium"
                            />
                          </Box>
                          <InlineStack gap="400" distribute="equalSpacing">
                            <Text variant="bodyMd">
                              <strong>{rateLimit.dailyCount}</strong> / {rateLimit.dailyLimit} messages
                            </Text>
                            <Text variant="bodyMd" tone="subdued">
                              Réinitialisation: {new Date(rateLimit.resetAt).toLocaleTimeString("fr-FR")}
                            </Text>
                          </InlineStack>
                          {rateLimitPercent >= 80 && (
                            <Banner tone="warning">
                              Attention: Vous avez atteint {rateLimitPercent}% de votre limite journalière.
                            </Banner>
                          )}
                        </BlockStack>
                      )}

                      <Button tone="critical" onClick={handleDisconnectWhatsApp} loading={qrFetcher.state !== "idle"}>
                        Déconnecter WhatsApp
                      </Button>
                    </BlockStack>
                  ) : (
                    <BlockStack gap="400">
                      {qrCodeUrl && waStatus?.qrCode ? (
                        <BlockStack gap="300" align="center">
                          <Box padding="400" background="bg-surface-active" borderRadius="300">
                            <img src={qrCodeUrl} alt="WhatsApp QR Code" style={{ width: 256, height: 256 }} />
                          </Box>
                          <Text variant="bodyMd" tone="subdued">
                            Scannez ce QR code avec WhatsApp sur votre téléphone
                          </Text>
                          <Text variant="bodySm" tone="subdued">
                            WhatsApp → Paramètres → Appareils liés → Lier un appareil
                          </Text>
                          <Button onClick={handleInitWhatsApp} loading={qrFetcher.state !== "idle"}>
                            Régénérer le QR code
                          </Button>
                        </BlockStack>
                      ) : (
                        <BlockStack gap="300" align="center">
                          <Box padding="400" background="bg-surface-active" borderRadius="300">
                            <div
                              style={{
                                width: 256,
                                height: 256,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {qrFetcher.state !== "idle" ? (
                                <SkeletonThumbnail size="large" />
                              ) : (
                                <Text variant="bodyMd" tone="subdued">
                                  Cliquez pour générer un QR code
                                </Text>
                              )}
                            </div>
                          </Box>
                          <Button primary onClick={handleInitWhatsApp} loading={qrFetcher.state !== "idle"}>
                            Générer le QR code
                          </Button>
                        </BlockStack>
                      )}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

          {/* Help Section */}
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Comment configurer les notifications
                  </Text>
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p">
                      <strong>Telegram:</strong> Ouvrez Telegram et cherchez @BotFather. Envoyez /newbot et suivez les
                      instructions pour créer votre bot.
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>WhatsApp:</strong> Générez un QR code et scannez-le avec WhatsApp sur votre téléphone.
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>Limites WhatsApp:</strong> 250 messages/jour pour les comptes non vérifiés. Les limites
                      sont réinitialisées chaque jour à minuit UTC.
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>Mode "Les deux":</strong> Telegram est essayé en premier. Si l'agent n'a pas Telegram ou
                      si l'envoi échoue, WhatsApp est utilisé comme backup.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </BlockStack>

        {/* Toast */}
        {toastMessage && <Toast content={toastMessage} error={toastError} onDismiss={() => setToastMessage(null)} />}
      </Page>
    </Frame>
  );
}
