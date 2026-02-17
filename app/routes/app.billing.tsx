import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Badge,
  Box,
  Divider,
  List,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { PLANS, PLAN_BASIC, PLAN_GOLD, PLAN_PRO } from "../billing-plans";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);

  // Check current subscription
  const billingCheck = await billing.check({
    plans: [PLAN_BASIC, PLAN_GOLD, PLAN_PRO],
    isTest: true,
  });

  const activePlan = billingCheck.appSubscriptions.find(
    (sub: { name: string }) =>
      [PLAN_BASIC, PLAN_GOLD, PLAN_PRO].includes(sub.name),
  );

  return json({
    activePlan: activePlan?.name || null,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan") as string;

  if (![PLAN_BASIC, PLAN_GOLD, PLAN_PRO].includes(plan)) {
    return json({ error: "Plan invalide" }, { status: 400 });
  }

  await billing.request({
    plan,
    isTest: true,
  });

  // billing.request throws a redirect Response, so this line won't execute
  return null;
};

export default function BillingPage() {
  const { activePlan } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleSelectPlan = (planName: string) => {
    submit({ plan: planName }, { method: "POST" });
  };

  return (
    <Page>
      <TitleBar title="Plans et Facturation" />
      <BlockStack gap="500">
        {activePlan && (
          <Banner tone="success">
            <p>
              Votre plan actuel : <strong>{activePlan}</strong>
            </p>
          </Banner>
        )}

        {!activePlan && (
          <Banner tone="warning">
            <p>
              Vous n'avez pas encore de plan actif. Choisissez un plan pour
              commencer avec un essai gratuit de 7 jours.
            </p>
          </Banner>
        )}

        <Text as="h2" variant="headingLg">
          Choisissez votre plan
        </Text>
        <Text as="p" variant="bodyMd" tone="subdued">
          Tous les plans incluent un essai gratuit de 7 jours. Aucun engagement.
        </Text>

        <Layout>
          {PLANS.map((plan) => (
            <Layout.Section key={plan.name} variant="oneThird">
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">
                      {plan.name}
                    </Text>
                    {plan.recommended && (
                      <Badge tone="success">Recommandé</Badge>
                    )}
                    {activePlan === plan.name && (
                      <Badge tone="info">Actuel</Badge>
                    )}
                  </InlineStack>

                  <BlockStack gap="100">
                    <InlineStack align="start" blockAlign="baseline" gap="100">
                      <Text as="span" variant="heading2xl">
                        ${plan.price}
                      </Text>
                      <Text as="span" variant="bodyMd" tone="subdued">
                        /mois
                      </Text>
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      7 jours d'essai gratuit
                    </Text>
                  </BlockStack>

                  <Divider />

                  <List>
                    {plan.features.map((feature) => (
                      <List.Item key={feature}>{feature}</List.Item>
                    ))}
                  </List>

                  <Box paddingBlockStart="200">
                    <Button
                      variant={plan.recommended ? "primary" : "secondary"}
                      fullWidth
                      disabled={activePlan === plan.name}
                      onClick={() => handleSelectPlan(plan.name)}
                    >
                      {activePlan === plan.name
                        ? "Plan actuel"
                        : "Commencer l'essai"}
                    </Button>
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>
          ))}
        </Layout>
      </BlockStack>
    </Page>
  );
}
