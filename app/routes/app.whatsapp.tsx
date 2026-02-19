import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useFetcher } from "@remix-run/react";
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
  Icon,
  Badge,
  Checkbox,
  Collapsible,
} from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon, CheckIcon } from "@shopify/polaris-icons";

// Custom WhatsApp SVG icon since WhatsAppIcon is not available in @shopify/polaris-icons
const WhatsAppIconSvg = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
import { TitleBar } from "@shopify/app-bridge-react";
import { useCallback, useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// ============================================================
// TYPES
// ============================================================
type AgentWithSelection = {
  id: string;
  name: string;
  phone: string;
  country: string;
  city: string | null;
  role: "COURIER" | "SUPPORT" | "BOTH";
  showInWidget: boolean;
};

type LoaderData = {
  shop: {
    id: string;
    name: string;
    domain: string;
    whatsappNumber: string | null;
    whatsappMessage: string | null;
    widgetEnabled: boolean;
  } | null;
  agentsByCountry: Record<string, AgentWithSelection[]>;
  widgetActiveOnStore: boolean;
  countries: { code: string; name: string; emoji: string }[];
};

// ============================================================
// COUNTRY DATA - African countries with emoji flags
// ============================================================
const AFRICAN_COUNTRIES: Record<string, { name: string; emoji: string }> = {
  DZ: { name: "Algérie", emoji: "🇩🇿" },
  AO: { name: "Angola", emoji: "🇦🇴" },
  BJ: { name: "Bénin", emoji: "🇧🇯" },
  BW: { name: "Botswana", emoji: "🇧🇼" },
  BF: { name: "Burkina Faso", emoji: "🇧🇫" },
  BI: { name: "Burundi", emoji: "🇧🇮" },
  CV: { name: "Cap-Vert", emoji: "🇨🇻" },
  CM: { name: "Cameroun", emoji: "🇨🇲" },
  CF: { name: "République centrafricaine", emoji: "🇨🇫" },
  TD: { name: "Tchad", emoji: "🇹🇩" },
  KM: { name: "Comores", emoji: "🇰🇲" },
  CG: { name: "Congo-Brazzaville", emoji: "🇨🇬" },
  CD: { name: "RD Congo", emoji: "🇨🇩" },
  CI: { name: "Côte d'Ivoire", emoji: "🇨🇮" },
  DJ: { name: "Djibouti", emoji: "🇩🇯" },
  EG: { name: "Égypte", emoji: "🇪🇬" },
  GQ: { name: "Guinée équatoriale", emoji: "🇬🇶" },
  ER: { name: "Érythrée", emoji: "🇪🇷" },
  SZ: { name: "Eswatini", emoji: "🇸🇿" },
  ET: { name: "Éthiopie", emoji: "🇪🇹" },
  GA: { name: "Gabon", emoji: "🇬🇦" },
  GM: { name: "Gambie", emoji: "🇬🇲" },
  GH: { name: "Ghana", emoji: "🇬🇭" },
  GN: { name: "Guinée", emoji: "🇬🇳" },
  GW: { name: "Guinée-Bissau", emoji: "🇬🇼" },
  KE: { name: "Kenya", emoji: "🇰🇪" },
  LS: { name: "Lesotho", emoji: "🇱🇸" },
  LR: { name: "Liberia", emoji: "🇱🇷" },
  LY: { name: "Libye", emoji: "🇱🇾" },
  MG: { name: "Madagascar", emoji: "🇲🇬" },
  MW: { name: "Malawi", emoji: "🇲🇼" },
  ML: { name: "Mali", emoji: "🇲🇱" },
  MR: { name: "Mauritanie", emoji: "🇲🇷" },
  MU: { name: "Maurice", emoji: "🇲🇺" },
  MA: { name: "Maroc", emoji: "🇲🇦" },
  MZ: { name: "Mozambique", emoji: "🇲🇿" },
  NA: { name: "Namibie", emoji: "🇳🇦" },
  NE: { name: "Niger", emoji: "🇳🇪" },
  NG: { name: "Nigeria", emoji: "🇳🇬" },
  RW: { name: "Rwanda", emoji: "🇷🇼" },
  ST: { name: "Sao Tomé-et-Principe", emoji: "🇸🇹" },
  SN: { name: "Sénégal", emoji: "🇸🇳" },
  SC: { name: "Seychelles", emoji: "🇸🇨" },
  SL: { name: "Sierra Leone", emoji: "🇸🇱" },
  SO: { name: "Somalie", emoji: "🇸🇴" },
  ZA: { name: "Afrique du Sud", emoji: "🇿🇦" },
  SS: { name: "Soudan du Sud", emoji: "🇸🇸" },
  SD: { name: "Soudan", emoji: "🇸🇩" },
  TZ: { name: "Tanzanie", emoji: "🇹🇿" },
  TG: { name: "Togo", emoji: "🇹🇬" },
  TN: { name: "Tunisie", emoji: "🇹🇳" },
  UG: { name: "Ouganda", emoji: "🇺🇬" },
  ZM: { name: "Zambie", emoji: "🇿🇲" },
  ZW: { name: "Zimbabwe", emoji: "🇿🇼" },
};

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
    return json({ shop: null, agentsByCountry: {}, widgetActiveOnStore: false, countries: [] });
  }

  // Get ALL agents (active) with their showInWidget status
  const agents = await prisma.deliveryAgent.findMany({
    where: {
      shopId: shop.id,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      country: true,
      city: true,
      role: true,
      showInWidget: true,
    },
    orderBy: [{ country: "asc" }, { name: "asc" }],
  });

  // Group agents by country
  const agentsByCountry: Record<string, AgentWithSelection[]> = {};
  const countriesList: { code: string; name: string; emoji: string }[] = [];

  for (const agent of agents) {
    if (!agentsByCountry[agent.country]) {
      agentsByCountry[agent.country] = [];
      const countryInfo = AFRICAN_COUNTRIES[agent.country] || { name: agent.country, emoji: "🌍" };
      countriesList.push({ code: agent.country, ...countryInfo });
    }
    agentsByCountry[agent.country].push(agent as AgentWithSelection);
  }

  // Check if widget is active on store via ScriptTag API
  let widgetActiveOnStore = shop.widgetEnabled;
  try {
    const scriptTags = await admin.rest.get({ path: "script_tags" });
    const tags = (scriptTags as any)?.body?.script_tags || [];
    const widgetTag = tags.find(
      (tag: any) => tag.src.includes("/api/widget-script") || tag.src.includes("whatsapp-widget")
    );
    widgetActiveOnStore = !!widgetTag;
  } catch (error) {
    console.error("Error checking script tags:", error);
  }

  return json({
    shop,
    agentsByCountry,
    widgetActiveOnStore,
    countries: countriesList,
  });
};

// ============================================================
// ACTION
// ============================================================
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType") as string;

  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) {
    return json({ error: "Boutique non trouvée" }, { status: 404 });
  }

  try {
    switch (actionType) {
      case "updateConfig": {
        const whatsappNumber = formData.get("whatsappNumber") as string;
        const whatsappMessage = formData.get("whatsappMessage") as string;
        const widgetEnabled = formData.get("widgetEnabled") === "true";

        // Validate WhatsApp number
        if (whatsappNumber && !/^\d{10,15}$/.test(whatsappNumber.replace(/[\s+-]/g, ""))) {
          return json({ error: "Numéro WhatsApp inval. Utilisez le format international (ex: 33612345678)" });
        }

        await prisma.shop.update({
          where: { id: shop.id },
          data: {
            whatsappNumber: whatsappNumber?.replace(/[\s+-]/g, "") || null,
            whatsappMessage: whatsappMessage || null,
            widgetEnabled,
          },
        });

        return json({ success: true, message: "Configuration enregistrée" });
      }

      case "updateAgentVisibility": {
        const agentId = formData.get("agentId") as string;
        const showInWidget = formData.get("showInWidget") === "true";

        // Verify agent belongs to this shop
        const agent = await prisma.deliveryAgent.findFirst({
          where: { id: agentId, shopId: shop.id },
        });

        if (!agent) {
          return json({ error: "Agent non trouvé" }, { status: 404 });
        }

        await prisma.deliveryAgent.update({
          where: { id: agentId },
          data: { showInWidget },
        });

        return json({ success: true, message: "Visibilité mise à jour" });
      }

      case "enableWidget": {
        const appUrl = process.env.SHOPIFY_APP_URL || "https://multi.innovvision-group.com";
        const widgetScriptUrl = `${appUrl}/api/widget-script?shop=${shopDomain}`;

        // Check if script tag already exists
        const existingScripts = await admin.rest.get({ path: "script_tags" });
        const scriptTags = (existingScripts as any)?.body?.script_tags || [];
        const existingTag = scriptTags.find(
          (tag: any) => tag.src.includes("/api/widget-script") || tag.src.includes("whatsapp-widget")
        );

        if (existingTag) {
          await prisma.shop.update({
            where: { id: shop.id },
            data: { widgetEnabled: true },
          });
          return json({ success: true, message: "Widget déjà activé !" });
        }

        // Create new script tag
        const scriptTagResponse = await admin.rest.post({
          path: "script_tags",
          data: {
            script_tag: {
              event: "onload",
              src: widgetScriptUrl,
              display_scope: "all",
            },
          },
        });

        const responseData = scriptTagResponse as any;
        if (responseData?.body?.errors || responseData?.status >= 400) {
          const errorMsg = responseData?.body?.errors || responseData?.body?.error || "Erreur";
          return json({ error: `Erreur Shopify: ${JSON.stringify(errorMsg)}` }, { status: 400 });
        }

        await prisma.shop.update({
          where: { id: shop.id },
          data: { widgetEnabled: true },
        });

        return json({ success: true, message: "Widget activé sur votre boutique !" });
      }

      case "disableWidget": {
        // Get existing script tag
        const existingScripts = await admin.rest.get({ path: "script_tags" });
        const scriptTags = (existingScripts as any)?.body?.script_tags || [];
        const existingTag = scriptTags.find(
          (tag: any) => tag.src.includes("/api/widget-script") || tag.src.includes("whatsapp-widget")
        );

        if (existingTag) {
          // Delete the script tag
          await admin.rest.delete({
            path: `script_tags/${existingTag.id}`,
          });
        }

        await prisma.shop.update({
          where: { id: shop.id },
          data: { widgetEnabled: false },
        });

        return json({ success: true, message: "Widget désactivé" });
      }

      default:
        return json({ error: "Action non reconnue" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Widget action error:", error);
    const shopifyError = error?.response?.body?.errors;
    if (shopifyError) {
      return json({ error: `Erreur Shopify: ${JSON.stringify(shopifyError)}` }, { status: 400 });
    }
    return json({ error: "Une erreur est survenue" }, { status: 500 });
  }
};

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
    loaderData.shop?.whatsappMessage || "Bonjour, j'ai une question."
  );
  const [widgetEnabled, setWidgetEnabled] = useState(loaderData.shop?.widgetEnabled ?? false);
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [agentVisibility, setAgentVisibility] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    Object.values(loaderData.agentsByCountry)
      .flat()
      .forEach((agent) => {
        init[agent.id] = agent.showInWidget;
      });
    return init;
  });

  // Sync state with loader data
  useEffect(() => {
    if (loaderData.shop) {
      setWhatsappNumber(loaderData.shop.whatsappNumber || "");
      setWhatsappMessage(loaderData.shop.whatsappMessage || "Bonjour, j'ai une question.");
      setWidgetEnabled(loaderData.shop.widgetEnabled ?? false);
    }
    const init: Record<string, boolean> = {};
    Object.values(loaderData.agentsByCountry)
      .flat()
      .forEach((agent) => {
        init[agent.id] = agent.showInWidget;
      });
    setAgentVisibility(init);
  }, [loaderData]);

  // Check for fetcher results
  const configFetcher = useFetcher<{ success?: boolean; message?: string; error?: string }>();
  const widgetFetcher = useFetcher<{ success?: boolean; message?: string; error?: string }>();

  useEffect(() => {
    if (configFetcher.data?.success) {
      setToastMessage(configFetcher.data.message || "Configuration enregistrée");
      setToastError(false);
    } else if (configFetcher.data?.error) {
      setToastMessage(configFetcher.data.error);
      setToastError(true);
    }
  }, [configFetcher.data]);

  useEffect(() => {
    if (widgetFetcher.data?.success) {
      setToastMessage(widgetFetcher.data.message || "Widget mis à jour");
      setToastError(false);
      setTimeout(() => window.location.reload(), 1500);
    } else if (widgetFetcher.data?.error) {
      setToastMessage(widgetFetcher.data.error);
      setToastError(true);
    }
  }, [widgetFetcher.data]);

  const toggleCountry = (countryCode: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(countryCode)) {
        next.delete(countryCode);
      } else {
        next.add(countryCode);
      }
      return next;
    });
  };

  const handleAgentVisibilityChange = (agentId: string, checked: boolean) => {
    setAgentVisibility((prev) => ({ ...prev, [agentId]: checked }));

    // Submit change immediately
    const formData = new FormData();
    formData.append("actionType", "updateAgentVisibility");
    formData.append("agentId", agentId);
    formData.append("showInWidget", checked ? "true" : "false");
    configFetcher.submit(formData, { method: "post" });
  };

  const handleEnableWidget = () => {
    const formData = new FormData();
    formData.append("actionType", "enableWidget");
    widgetFetcher.submit(formData, { method: "post" });
  };

  const handleDisableWidget = () => {
    const formData = new FormData();
    formData.append("actionType", "disableWidget");
    widgetFetcher.submit(formData, { method: "post" });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "SUPPORT":
        return <Badge tone="info">Service Client</Badge>;
      case "COURIER":
        return <Badge tone="warning">Livreur</Badge>;
      case "BOTH":
        return <Badge tone="success">Les deux</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  if (!loaderData.shop) {
    return (
      <Page title="Widget WhatsApp">
        <Banner tone="critical">Erreur: Boutique non trouvée</Banner>
      </Page>
    );
  }

  const countriesWithVisibleAgents = loaderData.countries.filter((c) =>
    (loaderData.agentsByCountry[c.code] || []).some((a) => agentVisibility[a.id])
  );

  return (
    <Frame>
      <Page title="Widget WhatsApp" subtitle="Configurez le widget de contact pour vos clients">
        <TitleBar title="Widget WhatsApp" />
        <BlockStack gap="500">
          {/* Status Banner */}
          {loaderData.widgetActiveOnStore ? (
            <Banner tone="success" icon={<Icon source={CheckIcon} />}>
              <Text variant="bodyMd" as="p">
                Le widget WhatsApp est <strong>actif</strong> sur votre boutique. Vos clients peuvent
                contacter vos agents par pays.
              </Text>
            </Banner>
          ) : (
            <Banner tone="info">
              <Text variant="bodyMd" as="p">
                Configurez vos contacts ci-dessous, puis activez le widget sur votre boutique.
              </Text>
            </Banner>
          )}

          <Layout>
            {/* Main Configuration */}
            <Layout.Section>
              <Card>
                <configFetcher.Form method="post">
                  <input type="hidden" name="actionType" value="updateConfig" />
                  <input type="hidden" name="widgetEnabled" value={widgetEnabled ? "true" : "false"} />
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      Configuration du widget
                    </Text>
                    <Text variant="bodyMd" tone="subdued">
                      Ajoutez un bouton WhatsApp flottant sur votre boutique. Les visiteurs peuvent
                      sélectionner leur pays et contacter un agent local.
                    </Text>

                    <Divider />

                    <FormLayout>
                      <TextField
                        label="Numéro WhatsApp principal (fallback)"
                        name="whatsappNumber"
                        value={whatsappNumber}
                        onChange={setWhatsappNumber}
                        autoComplete="off"
                        placeholder="33612345678"
                        helpText="Utilisé si aucun contact n'est disponible pour le pays sélectionné"
                      />

                      <TextField
                        label="Message par défaut"
                        name="whatsappMessage"
                        value={whatsappMessage}
                        onChange={setWhatsappMessage}
                        multiline={2}
                        autoComplete="off"
                        helpText="Message pré-rempli (inclura automatiquement le nom du shop et l'URL de la page)"
                      />

                      <InlineStack gap="200" align="start">
                        <Button primary submit loading={configFetcher.state !== "idle"}>
                          Enregistrer la configuration
                        </Button>
                      </InlineStack>
                    </FormLayout>
                  </BlockStack>
                </configFetcher.Form>
              </Card>
            </Layout.Section>

            {/* Activation Panel */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Installation sur la boutique
                    </Text>
                    {loaderData.widgetActiveOnStore ? (
                      <Badge tone="success">Actif</Badge>
                    ) : (
                      <Badge tone="info">Inactif</Badge>
                    )}
                  </InlineStack>

                  <Text variant="bodyMd">
                    {loaderData.widgetActiveOnStore
                      ? "Le widget est installé sur votre boutique. Vous pouvez le désactiver à tout moment."
                      : "Cliquez pour installer automatiquement le widget sur votre boutique Shopify."}
                  </Text>

                  <Divider />

                  <InlineStack gap="200" blockAlign="center">
                    {loaderData.widgetActiveOnStore ? (
                      <Button
                        tone="critical"
                        onClick={handleDisableWidget}
                        loading={widgetFetcher.state !== "idle"}
                      >
                        Désactiver le widget
                      </Button>
                    ) : (
                      <Button
                        primary
                        onClick={handleEnableWidget}
                        loading={widgetFetcher.state !== "idle"}
                        disabled={countriesWithVisibleAgents.length === 0}
                      >
                        Activer le widget automatiquement
                      </Button>
                    )}

                    <Button
                      onClick={() => {
                        window.open(
                          `https://admin.shopify.com/store/${loaderData.shop?.domain.replace(
                            ".myshopify.com",
                            ""
                          )}/themes/current/editor`,
                          "_blank"
                        );
                      }}
                    >
                      Ouvrir l'éditeur de thème
                    </Button>
                  </InlineStack>

                  {!loaderData.widgetActiveOnStore && countriesWithVisibleAgents.length === 0 && (
                    <Banner tone="warning">
                      Sélectionnez au moins un agent visible dans les contacts par pays avant d'activer
                      le widget.
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Contacts by Country */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Contacts par pays
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    Cochez les agents qui apparaîtront dans le widget. Les agents avec le rôle "Service
                    Client" ou "Les deux" sont recommandés.
                  </Text>

                  <Divider />

                  {loaderData.countries.length === 0 ? (
                    <Banner tone="info">
                      Aucun agent configuré. Ajoutez des livreurs dans la section "Livreurs" avec leur
                      pays et rôle.
                    </Banner>
                  ) : (
                    <BlockStack gap="300">
                      {loaderData.countries.map((country) => {
                        const agents = loaderData.agentsByCountry[country.code] || [];
                        const visibleCount = agents.filter((a) => agentVisibility[a.id]).length;
                        const isExpanded = expandedCountries.has(country.code);

                        return (
                          <Box
                            key={country.code}
                            background="bg-surface-secondary"
                            padding="300"
                            borderRadius="200"
                          >
                            <BlockStack gap="200">
                              <InlineStack
                                gap="200"
                                blockAlign="center"
                                align="space-between"
                              >
                                <InlineStack gap="200" blockAlign="center">
                                  <Text variant="headingMd">{country.emoji}</Text>
                                  <Text variant="bodyMd" fontWeight="semibold">
                                    {country.name}
                                  </Text>
                                  <Badge>
                                    {visibleCount}/{agents.length} visible{visibleCount > 1 ? "s" : ""}
                                  </Badge>
                                </InlineStack>
                                <Button
                                  size="slim"
                                  icon={<Icon source={isExpanded ? ChevronUpIcon : ChevronDownIcon} />}
                                  onClick={() => toggleCountry(country.code)}
                                >
                                  {isExpanded ? "Réduire" : "Développer"}
                                </Button>
                              </InlineStack>

                              <Collapsible open={isExpanded} id={`collapsible-${country.code}`}>
                                <BlockStack gap="200">
                                  {agents.map((agent) => (
                                    <InlineStack
                                      key={agent.id}
                                      gap="300"
                                      blockAlign="center"
                                      align="space-between"
                                    >
                                      <InlineStack gap="200" blockAlign="center">
                                        <Checkbox
                                          label=""
                                          checked={agentVisibility[agent.id] || false}
                                          onChange={(checked) => handleAgentVisibilityChange(agent.id, checked)}
                                        />
                                        <Text variant="bodyMd">{agent.name}</Text>
                                        {agent.city && (
                                          <Text variant="bodySm" tone="subdued">
                                            {agent.city}
                                          </Text>
                                        )}
                                        {getRoleBadge(agent.role)}
                                      </InlineStack>
                                      <Text variant="bodySm" tone="subdued">
                                        {agent.phone}
                                      </Text>
                                    </InlineStack>
                                  ))}
                                </BlockStack>
                              </Collapsible>
                            </BlockStack>
                          </Box>
                        );
                      })}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Preview */}
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Aperçu du widget
                  </Text>
                  <Box
                    background="bg-surface-secondary"
                    padding="400"
                    borderRadius="200"
                  >
                    <InlineStack gap="300" blockAlign="center">
                      <div
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: "50%",
                          backgroundColor: "#25D366",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <WhatsAppIconSvg />
                      </div>
                      <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="semibold">
                          Widget WhatsApp flottant
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {countriesWithVisibleAgents.length} pays avec contacts visibles
                        </Text>
                      </BlockStack>
                    </InlineStack>
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
