import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, useFetcher } from "@remix-run/react";
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
  Form,
  FormLayout,
  Toast,
  Frame,
  Box,
  Icon,
  Spinner,
  Badge,
} from "@shopify/polaris";
import { DuplicateIcon, CheckIcon } from "@shopify/polaris-icons";
import { TitleBar } from "@shopify/app-bridge-react";
import { useCallback, useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// ============================================================
// LOADER
// ============================================================
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: {
      id: true,
      name: true,
      domain: true,
      whatsappNumber: true,
      whatsappMessage: true,
      widgetEnabled: true,
    },
  });

  if (!shop) {
    return json({ shop: null, widgetActiveOnStore: false });
  }

  // Get support agents for the shop
  const supportAgents = await prisma.deliveryAgent.findMany({
    where: {
      shopId: shop.id,
      isActive: true,
      role: { in: ["SUPPORT", "BOTH"] },
    },
    select: {
      id: true,
      name: true,
      phone: true,
    },
  });

  // Check if widget is already active on the store
  let widgetActiveOnStore = false;
  try {
    const themesResponse = await admin.rest.get({
      path: "themes",
    });
    
    const themes = themesResponse.body?.themes || [];
    const mainTheme = themes.find((t: any) => t.role === "main");
    
    if (mainTheme) {
      const settingsResponse = await admin.rest.get({
        path: `themes/${mainTheme.id}/assets`,
        query: {
          "asset[key]": "config/settings_data.json",
        },
      });

      if (settingsResponse.body?.asset?.value) {
        const settingsData = JSON.parse(settingsResponse.body.asset.value);
        const blocks = settingsData?.current?.blocks || {};
        const extensionHandle = "whatsapp-widget";
        const blockHandle = "widget";
        
        for (const block of Object.values(blocks)) {
          const blockType = (block as any)?.type || "";
          const disabled = (block as any)?.disabled !== false;
          const settings = (block as any)?.settings || {};
          
          if ((blockType.includes(extensionHandle) || blockType.includes(blockHandle)) && 
              !disabled && settings.enabled !== false) {
            widgetActiveOnStore = true;
            break;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking widget status:", error);
  }

  return json({
    shop,
    supportAgents,
    widgetScript: generateWidgetScript(shop),
    widgetActiveOnStore,
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
      case "updateWidget": {
        const whatsappNumber = formData.get("whatsappNumber") as string;
        const whatsappMessage = formData.get("whatsappMessage") as string;
        const widgetEnabled = formData.get("widgetEnabled") === "true";

        // Validate WhatsApp number format (should be international format without +)
        if (whatsappNumber && !/^\d{10,15}$/.test(whatsappNumber.replace(/[\s+-]/g, ""))) {
          return json({ error: "Numéro WhatsApp invalide. Utilisez le format international (ex: 33612345678)" });
        }

        await prisma.shop.update({
          where: { id: shop.id },
          data: {
            whatsappNumber: whatsappNumber?.replace(/[\s+-]/g, "") || null,
            whatsappMessage: whatsappMessage || null,
            widgetEnabled,
          },
        });

        return json({ success: true, message: "Configuration du widget enregistrée" });
      }

      default:
        return json({ error: "Action non reconnue" }, { status: 400 });
    }
  } catch (error) {
    console.error("Widget action error:", error);
    return json({ error: "Une erreur est survenue" }, { status: 500 });
  }
};

// ============================================================
// HELPER: Generate widget script
// ============================================================
function generateWidgetScript(shop: { domain: string; whatsappNumber: string | null; whatsappMessage: string | null }): string {
  const appUrl = process.env.SHOPIFY_APP_URL || "https://multi.innovvision-group.com";
  
  return `<!-- WhatsApp Widget - Logistics App -->
<script>
  (function() {
    var shopDomain = "${shop.domain}";
    var whatsappNumber = "${shop.whatsappNumber || ""}";
    var defaultMessage = "${(shop.whatsappMessage || "Bonjour, j'ai une question concernant ma livraison.").replace(/"/g, '\\"')}";
    
    // Create floating button
    var widget = document.createElement('div');
    widget.id = 'logistics-whatsapp-widget';
    widget.innerHTML = [
      '<a href="https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent(defaultMessage) + '"',
      '   target="_blank"',
      '   style="position: fixed; bottom: 20px; right: 20px; z-index: 9999;',
      '          display: flex; align-items: center; justify-content: center;',
      '          width: 60px; height: 60px; border-radius: 50%;',
      '          background-color: #25D366; box-shadow: 0 4px 12px rgba(0,0,0,0.15);',
      '          text-decoration: none; transition: transform 0.2s;">',
      '  <svg width="32" height="32" viewBox="0 0 24 24" fill="white">',
      '    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>',
      '  </svg>',
      '</a>'
    ].join('');
    
    document.body.appendChild(widget);
  })();
</script>
<!-- End WhatsApp Widget -->`;
}

// ============================================================
// COMPONENT
// ============================================================
export default function WhatsAppPage() {
  const loaderData = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(loaderData.shop?.whatsappNumber || "");
  const [whatsappMessage, setWhatsappMessage] = useState(
    loaderData.shop?.whatsappMessage || "Bonjour, j'ai une question concernant ma livraison."
  );
  const [widgetEnabled, setWidgetEnabled] = useState(loaderData.shop?.widgetEnabled ?? true);

  useEffect(() => {
    if (loaderData.shop) {
      setWhatsappNumber(loaderData.shop.whatsappNumber || "");
      setWhatsappMessage(loaderData.shop.whatsappMessage || "Bonjour, j'ai une question concernant ma livraison.");
      setWidgetEnabled(loaderData.shop.widgetEnabled ?? true);
    }
  }, [loaderData.shop]);

  // Check for action result
  useEffect(() => {
    const actionData = (window as any).__actionData;
    if (actionData?.success) {
      setToastMessage(actionData.message);
      setToastError(false);
    } else if (actionData?.error) {
      setToastMessage(actionData.error);
      setToastError(true);
    }
  }, []);

  if (!loaderData.shop) {
    return (
      <Page title="Widget WhatsApp">
        <Banner tone="critical">Erreur: Boutique non trouvée</Banner>
      </Page>
    );
  }

  const widgetScript = generateWidgetScript({
    domain: loaderData.shop.domain,
    whatsappNumber,
    whatsappMessage,
  });

  return (
    <Frame>
      <Page title="Widget WhatsApp" subtitle="Configurez le widget de contact pour vos clients">
        <TitleBar title="Widget WhatsApp" />
        <BlockStack gap="500">
          {/* Configuration Form */}
          <Layout>
            <Layout.Section>
              <Card>
                <Form method="post">
                  <input type="hidden" name="actionType" value="updateWidget" />
                  <input type="hidden" name="widgetEnabled" value={widgetEnabled ? "true" : "false"} />
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      Configuration du widget
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      Ajoutez un bouton WhatsApp flottant sur votre boutique Shopify pour permettre aux clients de
                      contacter votre équipe de service client.
                    </Text>

                    <Divider />

                    <FormLayout>
                      <TextField
                        label="Numéro WhatsApp"
                        name="whatsappNumber"
                        value={whatsappNumber}
                        onChange={setWhatsappNumber}
                        autoComplete="off"
                        placeholder="33612345678"
                        helpText="Format international sans le + (ex: 33612345678 pour la France, 22507123456 pour la Côte d'Ivoire)"
                      />

                      <TextField
                        label="Message par défaut"
                        name="whatsappMessage"
                        value={whatsappMessage}
                        onChange={setWhatsappMessage}
                        multiline={3}
                        autoComplete="off"
                        helpText="Message pré-rempli que le client enverra lorsqu'il clique sur le widget"
                      />

                      <InlineStack gap="200" align="start">
                        <Button primary submit loading={isSubmitting}>
                          Enregistrer
                        </Button>
                      </InlineStack>
                    </FormLayout>
                  </BlockStack>
                </Form>
              </Card>
            </Layout.Section>

            {/* Support Agents */}
            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Agents Service Client
                  </Text>
                  <Divider />
                  {loaderData.supportAgents.length > 0 ? (
                    <BlockStack gap="200">
                      {loaderData.supportAgents.map((agent) => (
                        <InlineStack key={agent.id} gap="200" blockAlign="center">
                          <Text variant="bodyMd">{agent.name}</Text>
                          <Text variant="bodySm" tone="subdued">
                            {agent.phone}
                          </Text>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  ) : (
                    <Text variant="bodyMd" tone="subdued">
                      Aucun agent avec le rôle "Service Client" configuré. Ajoutez des livreurs avec le rôle
                      "Service Client" ou "Les deux" dans la section Livreurs.
                    </Text>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

          {/* Widget Preview */}
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Aperçu du widget
                  </Text>
                  <Box
                    background="bg-surface-secondary"
                    padding="400"
                    borderRadius="200"
                  >
                    <InlineStack gap="200" blockAlign="center">
                      <div
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: "50%",
                          backgroundColor: "#25D366",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </div>
                      <Text variant="bodyMd">
                        Ce bouton flottant apparaîtra en bas à droite de votre boutique
                      </Text>
                    </InlineStack>
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

          {/* Automatic Installation */}
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Installation automatique
                    </Text>
                    {loaderData.widgetActiveOnStore ? (
                      <Badge tone="success">
                        <InlineStack gap="100" blockAlign="center">
                          <Icon source={CheckIcon} />
                          <span>Widget actif</span>
                        </InlineStack>
                      </Badge>
                    ) : (
                      <Badge tone="info">Recommandé</Badge>
                    )}
                  </InlineStack>
                  
                  {loaderData.widgetActiveOnStore ? (
                    <Banner tone="success">
                      <Text variant="bodyMd" as="p">
                        Le widget WhatsApp est actuellement <strong>actif</strong> sur votre boutique. 
                        Vos clients peuvent voir le bouton WhatsApp flottant sur toutes les pages.
                      </Text>
                    </Banner>
                  ) : (
                    <>
                      <Text variant="bodyMd">
                        Cliquez sur le bouton ci-dessous pour activer automatiquement le widget WhatsApp 
                        sur votre boutique. Aucune modification manuelle du thème n'est nécessaire.
                      </Text>

                      <Banner tone="info">
                        <Text variant="bodyMd" as="p">
                          Le widget utilisera le numéro WhatsApp et le message par défaut configurés ci-dessus. 
                          Assurez-vous de les avoir enregistrés avant d'activer le widget.
                        </Text>
                      </Banner>
                    </>
                  )}

                  <Divider />

                  <InlineStack gap="200" blockAlign="center">
                    <EnableWidgetButton 
                      phoneNumber={whatsappNumber}
                      defaultMessage={whatsappMessage}
                      alreadyEnabled={loaderData.widgetActiveOnStore}
                      onSuccess={() => {
                        setToastMessage("Widget WhatsApp activé avec succès !");
                        setToastError(false);
                        // Reload to update status
                        window.location.reload();
                      }}
                      onError={(error) => {
                        setToastMessage(error);
                        setToastError(true);
                      }}
                    />
                    
                    <Button
                      onClick={() => {
                        window.open(`https://admin.shopify.com/store/${loaderData.shop?.domain.replace('.myshopify.com', '')}/themes/current/editor`, '_blank');
                      }}
                    >
                      Ouvrir l'éditeur de thème
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

          {/* Manual Installation (Fallback) */}
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Installation manuelle
                    </Text>
                    <Text variant="bodySm" tone="subdued">
                      Alternative si l'installation automatique ne fonctionne pas
                    </Text>
                  </InlineStack>
                  
                  <Text variant="bodyMd" tone="subdued">
                    Copiez ce code et ajoutez-le dans votre thème Shopify (Online Store → Themes → Edit code →
                    theme.liquid, avant la balise &lt;/body&gt;).
                  </Text>

                  <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                    <BlockStack gap="200">
                      <InlineStack gap="200" align="space-between" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="semibold">
                          Code à copier
                        </Text>
                        <Button
                          size="slim"
                          onClick={() => {
                            navigator.clipboard.writeText(widgetScript);
                            setToastMessage("Code copié dans le presse-papiers");
                            setToastError(false);
                          }}
                          icon={<Icon source={DuplicateIcon} />}
                        >
                          Copier
                        </Button>
                      </InlineStack>
                      <Box
                        background="bg-surface"
                        padding="300"
                        borderRadius="100"
                        borderColor="border"
                        borderWidth="025"
                      >
                        <pre style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          maxHeight: 200,
                          overflow: "auto",
                          margin: 0,
                          fontSize: 12,
                          fontFamily: "monospace"
                        }}>
                          {widgetScript}
                        </pre>
                      </Box>
                    </BlockStack>
                  </Box>
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

// ============================================================
// ENABLE WIDGET BUTTON COMPONENT
// ============================================================
function EnableWidgetButton({ 
  phoneNumber, 
  defaultMessage, 
  alreadyEnabled,
  onSuccess, 
  onError 
}: { 
  phoneNumber: string; 
  defaultMessage: string;
  alreadyEnabled: boolean;
  onSuccess: () => void; 
  onError: (error: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/enable-widget", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          default_message: defaultMessage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess();
      } else {
        onError(data.error || "Une erreur est survenue");
      }
    } catch (error) {
      onError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  if (alreadyEnabled) {
    return (
      <Button disabled icon={<Icon source={CheckIcon} />}>
        Widget déjà activé
      </Button>
    );
  }

  return (
    <Button primary onClick={handleEnable} loading={loading}>
      Activer le widget automatiquement
    </Button>
  );
}
