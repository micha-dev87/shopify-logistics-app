import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Badge,
  Box,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { PLAN_BASIC, PLAN_GOLD, PLAN_PRO, PLAN_LIMITS } from "../billing-plans";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Get or create shop record
  let shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
  });

  // If shop doesn't exist in our DB, create it
  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        domain: shopDomain,
        name: shopDomain.replace(".myshopify.com", ""),
        accessToken: session.accessToken || "",
      },
    });
  }

  // Count active delivery agents
  const activeAgentsCount = await prisma.deliveryAgent.count({
    where: {
      shopId: shop.id,
      isActive: true,
    },
  });

  // Count delivery bills by status
  const pendingBills = await prisma.deliveryBill.count({
    where: { shopId: shop.id, status: "PENDING" },
  });

  const assignedBills = await prisma.deliveryBill.count({
    where: { shopId: shop.id, status: "ASSIGNED" },
  });

  const inProgressBills = await prisma.deliveryBill.count({
    where: { shopId: shop.id, status: "IN_PROGRESS" },
  });

  const deliveredBills = await prisma.deliveryBill.count({
    where: { shopId: shop.id, status: "DELIVERED" },
  });

  const notDeliveredBills = await prisma.deliveryBill.count({
    where: { shopId: shop.id, status: "NOT_DELIVERED" },
  });

  // Get plan info
  const currentPlan = shop.plan || PLAN_BASIC;
  const planLimit = PLAN_LIMITS[currentPlan] || PLAN_LIMITS[PLAN_BASIC];

  return json({
    shopName: shop.name,
    currentPlan,
    planLimit,
    activeAgentsCount,
    pendingBills,
    assignedBills,
    inProgressBills,
    deliveredBills,
    notDeliveredBills,
    totalBills: pendingBills + assignedBills + inProgressBills + deliveredBills + notDeliveredBills,
  });
};

export default function DashboardIndex() {
  const data = useLoaderData<typeof loader>();

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case PLAN_PRO:
        return <Badge tone="success">Pro</Badge>;
      case PLAN_GOLD:
        return <Badge tone="info">Gold</Badge>;
      default:
        return <Badge>Basique</Badge>;
    }
  };

  return (
    <Page>
      <TitleBar title="Tableau de bord" />
      <BlockStack gap="500">
        {/* Header Section */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h1" variant="headingLg">
                    Bienvenue, {data.shopName}
                  </Text>
                  {getPlanBadge(data.currentPlan)}
                </InlineStack>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Gérez vos livreurs et suivez vos livraisons depuis ce tableau de bord.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Stats Grid */}
        <Layout>
          {/* Plan & Agents */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Plan actuel
                </Text>
                <Divider />
                <BlockStack gap="100">
                  <InlineStack align="space-between">
                    <Text variant="bodyMd">Plan</Text>
                    <Text variant="bodyMd" fontWeight="semibold">
                      {data.currentPlan}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text variant="bodyMd">Livreurs utilisés</Text>
                    <Text variant="bodyMd" fontWeight="semibold">
                      {data.activeAgentsCount} / {data.planLimit}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Active Agents */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Livreurs actifs
                </Text>
                <Divider />
                <Box paddingBlock="200">
                  <Text as="p" variant="heading2xl" alignment="center">
                    {data.activeAgentsCount}
                  </Text>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Total Bills */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Total bons
                </Text>
                <Divider />
                <Box paddingBlock="200">
                  <Text as="p" variant="heading2xl" alignment="center">
                    {data.totalBills}
                  </Text>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Delivery Status Overview */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  État des livraisons
                </Text>
                <Divider />
                <Layout>
                  <Layout.Section variant="oneThird">
                    <Box padding="300">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" tone="subdued">
                          En attente
                        </Text>
                        <Text as="p" variant="headingXl">
                          {data.pendingBills}
                        </Text>
                      </BlockStack>
                    </Box>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <Box padding="300">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" tone="subdued">
                          Assignés
                        </Text>
                        <Text as="p" variant="headingXl">
                          {data.assignedBills}
                        </Text>
                      </BlockStack>
                    </Box>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <Box padding="300">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" tone="subdued">
                          En cours
                        </Text>
                        <Text as="p" variant="headingXl">
                          {data.inProgressBills}
                        </Text>
                      </BlockStack>
                    </Box>
                  </Layout.Section>
                </Layout>
                <Divider />
                <Layout>
                  <Layout.Section variant="oneHalf">
                    <Box padding="300">
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text variant="bodyMd" tone="subdued">
                            Livrés
                          </Text>
                          <Badge tone="success">{data.deliveredBills}</Badge>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </Layout.Section>
                  <Layout.Section variant="oneHalf">
                    <Box padding="300">
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text variant="bodyMd" tone="subdued">
                            Non livrés
                          </Text>
                          <Badge tone="critical">{data.notDeliveredBills}</Badge>
                        </InlineStack>
                      </BlockStack>
                    </Box>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Quick Actions Info */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Démarrage rapide
                </Text>
                <Divider />
                <Text variant="bodyMd" as="p">
                  Utilisez le menu de navigation pour accéder aux différentes sections de l'application.
                </Text>
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    <strong>Livreurs</strong> — Gérez votre équipe de livraison
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Bons de livraison</strong> — Consultez et attribuez les commandes
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Widget WhatsApp</strong> — Configurez le widget client
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Plans et Facturation</strong> — Gérez votre abonnement
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
