import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useCallback, useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createTelegramService } from "../telegram.server";

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
      createdAt: true,
    },
  });

  if (!shop) {
    return json({ shop: null, hasBot: false });
  }

  // Mask the bot token for display
  const maskedToken = shop.telegramBotToken
    ? `${shop.telegramBotToken.substring(0, 10)}...${shop.telegramBotToken.substring(shop.telegramBotToken.length - 5)}`
    : null;

  return json({
    shop: {
      ...shop,
      telegramBotToken: maskedToken,
      hasRealToken: !!shop.telegramBotToken,
    },
    hasBot: !!shop.telegramBotToken,
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

      default:
        return json({ error: "Action non reconnue" }, { status: 400 });
    }
  } catch (error) {
    console.error("Settings action error:", error);
    return json({ error: "Une erreur est survenue" }, { status: 500 });
  }
};

// ============================================================
// COMPONENT
// ============================================================
export default function SettingsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [testChatId, setTestChatId] = useState("");
  const [showToken, setShowToken] = useState(false);

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

  if (!loaderData.shop) {
    return (
      <Page title="Paramètres">
        <Banner tone="critical">Erreur: Boutique non trouvée</Banner>
      </Page>
    );
  }

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

          {/* Telegram Bot Configuration */}
          <Layout>
            <Layout.Section>
              <Card>
                <Form method="post">
                  <input type="hidden" name="actionType" value="saveBotToken" />
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      Bot Telegram
                    </Text>
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
                        <Banner tone="success">
                          Bot Telegram configuré
                          {loaderData.shop.hasRealToken && (
                            <> - Token: {loaderData.shop.telegramBotToken}</>
                          )}
                        </Banner>

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
                            <Button
                              variant="plain"
                              onClick={() => setShowToken(!showToken)}
                            >
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
                        Tester les notifications
                      </Text>
                      <Text variant="bodyMd" tone="subdued">
                        Envoyez une notification de test à votre compte Telegram pour vérifier la configuration.
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

          {/* Help Section */}
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Comment configurer Telegram
                  </Text>
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p">
                      <strong>1. Créer un bot:</strong> Ouvrez Telegram et cherchez @BotFather. Envoyez /newbot et
                      suivez les instructions.
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>2. Copier le token:</strong> BotFather vous donnera un token (ex:
                      1234567890:ABCdef...). Copiez-le ci-dessus.
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>3. Obtenir les Chat IDs:</strong> Chaque livreur doit obtenir son Chat ID en
                      contactant @userinfobot sur Telegram.
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>4. Configurer les livreurs:</strong> Ajoutez le Chat ID de chaque livreur dans leur
                      profil.
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </BlockStack>

        {/* Toast */}
        {toastMessage && (
          <Toast content={toastMessage} error={toastError} onDismiss={() => setToastMessage(null)} />
        )}
      </Page>
    </Frame>
  );
}
