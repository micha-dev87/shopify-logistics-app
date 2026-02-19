import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Button,
  DataTable,
  Badge,
  Modal,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  DropZone,
  Thumbnail,
  Banner,
  Divider,
  Box,
  useIndexResourceState,
  IndexTable,
  IndexFilters,
  IndexFiltersMode,
  useSetIndexFiltersMode,
  Toast,
  Frame,
  Popover,
  ActionList,
  Icon,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { PlusIcon, MoreVerticalIcon } from "@shopify/polaris-icons";
import { useCallback, useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { PLAN_LIMITS, PLAN_BASIC } from "../billing-plans";
import { AFRICAN_COUNTRIES, getCountryName } from "../african-countries";
import prisma from "../db.server";
import type { AgentRole, DeliveryAgent } from "@prisma/client";

// ============================================================
// LOADER - Fetch all agents for current shop
// ============================================================
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    include: {
      deliveryAgents: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!shop) {
    return redirect("/app");
  }

  const currentPlan = shop.plan || PLAN_BASIC;
  const planLimit = PLAN_LIMITS[currentPlan] || PLAN_LIMITS[PLAN_BASIC];
  const activeAgentsCount = shop.deliveryAgents.filter((a) => a.isActive).length;

  // Transform agents for display
  const agents = shop.deliveryAgents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    phone: agent.phone,
    country: agent.country,
    countryName: getCountryName(agent.country, "fr"),
    city: agent.city || "-",
    role: agent.role,
    roleLabel: getRoleLabel(agent.role),
    telegramUserId: agent.telegramUserId || "-",
    isActive: agent.isActive,
    createdAt: agent.createdAt.toISOString(),
    billsCount: 0, // Will be populated if needed
  }));

  return json({
    shopName: shop.name,
    currentPlan,
    planLimit,
    activeAgentsCount,
    agents,
    canAddAgent: activeAgentsCount < planLimit,
  });
};

// ============================================================
// ACTION - Create, Update, Delete agents
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
      case "create": {
        const name = formData.get("name") as string;
        const phone = formData.get("phone") as string;
        const country = formData.get("country") as string;
        const city = (formData.get("city") as string) || null;
        const role = (formData.get("role") as AgentRole) || "COURIER";
        const telegramUserId = (formData.get("telegramUserId") as string) || null;

        // Check plan limit
        const currentPlan = shop.plan || PLAN_BASIC;
        const planLimit = PLAN_LIMITS[currentPlan] || PLAN_LIMITS[PLAN_BASIC];
        const activeAgentsCount = await prisma.deliveryAgent.count({
          where: { shopId: shop.id, isActive: true },
        });

        if (activeAgentsCount >= planLimit) {
          return json({
            error: `Limite atteinte : votre plan ${currentPlan} permet jusqu'à ${planLimit} livreurs. Passez à un plan supérieur pour ajouter plus de livreurs.`,
          });
        }

        const agent = await prisma.deliveryAgent.create({
          data: {
            shopId: shop.id,
            name,
            phone,
            country,
            city,
            role,
            telegramUserId,
            isActive: true,
          },
        });

        return json({ success: true, message: `Livreur "${name}" créé avec succès`, agent });
      }

      case "update": {
        const agentId = formData.get("agentId") as string;
        const name = formData.get("name") as string;
        const phone = formData.get("phone") as string;
        const country = formData.get("country") as string;
        const city = (formData.get("city") as string) || null;
        const role = (formData.get("role") as AgentRole) || "COURIER";
        const telegramUserId = (formData.get("telegramUserId") as string) || null;

        // Verify agent belongs to this shop
        const existingAgent = await prisma.deliveryAgent.findFirst({
          where: { id: agentId, shopId: shop.id },
        });

        if (!existingAgent) {
          return json({ error: "Livreur non trouvé" }, { status: 404 });
        }

        const agent = await prisma.deliveryAgent.update({
          where: { id: agentId },
          data: {
            name,
            phone,
            country,
            city,
            role,
            telegramUserId,
          },
        });

        return json({ success: true, message: `Livreur "${name}" mis à jour`, agent });
      }

      case "deactivate": {
        const agentId = formData.get("agentId") as string;

        const existingAgent = await prisma.deliveryAgent.findFirst({
          where: { id: agentId, shopId: shop.id },
        });

        if (!existingAgent) {
          return json({ error: "Livreur non trouvé" }, { status: 404 });
        }

        await prisma.deliveryAgent.update({
          where: { id: agentId },
          data: { isActive: false },
        });

        return json({ success: true, message: `Livreur "${existingAgent.name}" désactivé` });
      }

      case "activate": {
        const agentId = formData.get("agentId") as string;

        const existingAgent = await prisma.deliveryAgent.findFirst({
          where: { id: agentId, shopId: shop.id },
        });

        if (!existingAgent) {
          return json({ error: "Livreur non trouvé" }, { status: 404 });
        }

        // Check plan limit before activating
        const currentPlan = shop.plan || PLAN_BASIC;
        const planLimit = PLAN_LIMITS[currentPlan] || PLAN_LIMITS[PLAN_BASIC];
        const activeAgentsCount = await prisma.deliveryAgent.count({
          where: { shopId: shop.id, isActive: true },
        });

        if (activeAgentsCount >= planLimit) {
          return json({
            error: `Limite atteinte : votre plan ${currentPlan} permet jusqu'à ${planLimit} livreurs.`,
          });
        }

        await prisma.deliveryAgent.update({
          where: { id: agentId },
          data: { isActive: true },
        });

        return json({ success: true, message: `Livreur "${existingAgent.name}" réactivé` });
      }

      case "delete": {
        const agentId = formData.get("agentId") as string;

        const existingAgent = await prisma.deliveryAgent.findFirst({
          where: { id: agentId, shopId: shop.id },
          include: { _count: { select: { deliveryBills: true } } },
        });

        if (!existingAgent) {
          return json({ error: "Livreur non trouvé" }, { status: 404 });
        }

        // Soft delete if has associated bills
        if (existingAgent._count.deliveryBills > 0) {
          await prisma.deliveryAgent.update({
            where: { id: agentId },
            data: { isActive: false },
          });
          return json({
            success: true,
            message: `Livreur "${existingAgent.name}" désactivé (a des bons de livraison associés)`,
          });
        }

        // Hard delete if no associated bills
        await prisma.deliveryAgent.delete({
          where: { id: agentId },
        });

        return json({ success: true, message: `Livreur "${existingAgent.name}" supprimé définitivement` });
      }

      default:
        return json({ error: "Action non reconnue" }, { status: 400 });
    }
  } catch (error) {
    console.error("Agent action error:", error);
    return json({ error: "Une erreur est survenue" }, { status: 500 });
  }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function getRoleLabel(role: AgentRole): string {
  switch (role) {
    case "COURIER":
      return "Livreur";
    case "SUPPORT":
      return "Service Client";
    case "BOTH":
      return "Livreur + Service Client";
    default:
      return role;
  }
}

// ============================================================
// COMPONENT
// ============================================================
export default function AgentsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<typeof loaderData.agents[0] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCountry, setFormCountry] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formRole, setFormRole] = useState<AgentRole>("COURIER");
  const [formTelegramUserId, setFormTelegramUserId] = useState("");

  // Filter state
  const [queryValue, setQueryValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Show toast on action result
  useEffect(() => {
    if (actionData?.success) {
      setToastMessage(actionData.message);
      setToastError(false);
      resetForm();
      setShowCreateModal(false);
      setShowEditModal(false);
      setShowDeleteModal(false);
    } else if (actionData?.error) {
      setToastMessage(actionData.error);
      setToastError(true);
    }
  }, [actionData]);

  const resetForm = () => {
    setFormName("");
    setFormPhone("");
    setFormCountry("");
    setFormCity("");
    setFormRole("COURIER");
    setFormTelegramUserId("");
    setSelectedAgent(null);
  };

  const openEditModal = (agent: typeof loaderData.agents[0]) => {
    setSelectedAgent(agent);
    setFormName(agent.name);
    setFormPhone(agent.phone);
    setFormCountry(agent.country);
    setFormCity(agent.city || "");
    setFormRole(agent.role);
    setFormTelegramUserId(agent.telegramUserId || "");
    setShowEditModal(true);
  };

  const openDeleteModal = (agent: typeof loaderData.agents[0]) => {
    setSelectedAgent(agent);
    setShowDeleteModal(true);
  };

  // Filter agents
  const filteredAgents = loaderData.agents.filter((agent) => {
    const matchesQuery =
      queryValue === "" ||
      agent.name.toLowerCase().includes(queryValue.toLowerCase()) ||
      agent.phone.includes(queryValue) ||
      agent.countryName.toLowerCase().includes(queryValue.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && agent.isActive) ||
      (statusFilter === "inactive" && !agent.isActive);

    return matchesQuery && matchesStatus;
  });

  const countryOptions = [
    { label: "Sélectionner un pays", value: "" },
    ...AFRICAN_COUNTRIES.map((c) => ({ label: c.nameFr, value: c.code })),
  ];

  const roleOptions = [
    { label: "Livreur", value: "COURIER" },
    { label: "Service Client", value: "SUPPORT" },
    { label: "Les deux (Livreur + Service Client)", value: "BOTH" },
  ];

  const statusFilterOptions = [
    { label: "Tous", value: "all" },
    { label: "Actifs", value: "active" },
    { label: "Inactifs", value: "inactive" },
  ];

  // Row actions
  const rowMarkup = filteredAgents.map((agent, index) => (
    <IndexTable.Row id={agent.id} key={agent.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold" as="span">
          {agent.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{agent.phone}</IndexTable.Cell>
      <IndexTable.Cell>{agent.countryName}</IndexTable.Cell>
      <IndexTable.Cell>{agent.city}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={agent.role === "BOTH" ? "info" : undefined}>{agent.roleLabel}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={agent.isActive ? "success" : "warning"}>
          {agent.isActive ? "Actif" : "Inactif"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button size="slim" onClick={() => openEditModal(agent)}>
            Modifier
          </Button>
          <Button
            size="slim"
            tone={agent.isActive ? "critical" : undefined}
            onClick={() => openDeleteModal(agent)}
          >
            {agent.isActive ? "Désactiver" : "Supprimer"}
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Frame>
      <Page
        title="Livreurs"
        subtitle={`${loaderData.activeAgentsCount} / ${loaderData.planLimit} livreurs actifs (${loaderData.currentPlan})`}
        primaryAction={{
          content: "Ajouter un livreur",
          icon: PlusIcon,
          onAction: () => {
            if (!loaderData.canAddAgent) {
              setToastMessage(
                `Limite atteinte : passez à un plan supérieur pour ajouter plus de livreurs.`
              );
              setToastError(true);
              return;
            }
            resetForm();
            setShowCreateModal(true);
          },
        }}
      >
        <TitleBar title="Gestion des Livreurs" />
        <BlockStack gap="500">
          {/* Plan limit warning */}
          {!loaderData.canAddAgent && (
            <Banner tone="warning">
              Vous avez atteint la limite de {loaderData.planLimit} livreurs pour votre plan{" "}
              {loaderData.currentPlan}. Passez à un plan supérieur pour ajouter plus de livreurs.
            </Banner>
          )}

          {/* Filters */}
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="400" align="space-between" blockAlign="center">
                <TextField
                  label=""
                  placeholder="Rechercher par nom, téléphone, pays..."
                  value={queryValue}
                  onChange={setQueryValue}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setQueryValue("")}
                />
                <Select
                  label=""
                  options={statusFilterOptions}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Agents Table */}
          <Card>
            <IndexTable
              resourceName={{ singular: "livreur", plural: "livreurs" }}
              itemCount={filteredAgents.length}
              headings={[
                { title: "Nom" },
                { title: "Téléphone" },
                { title: "Pays" },
                { title: "Ville" },
                { title: "Rôle" },
                { title: "Statut" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>

            {filteredAgents.length === 0 && (
              <Box padding="400">
                <Text variant="bodyMd" as="p" alignment="center" tone="subdued">
                  {loaderData.agents.length === 0
                    ? "Aucun livreur. Cliquez sur 'Ajouter un livreur' pour commencer."
                    : "Aucun livreur ne correspond à votre recherche."}
                </Text>
              </Box>
            )}
          </Card>
        </BlockStack>

        {/* Create Modal */}
        <Modal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Ajouter un livreur"
          primaryAction={{
            content: "Créer",
            onAction: () => {
              const form = document.getElementById("create-agent-form") as HTMLFormElement;
              form?.requestSubmit();
            },
            loading: isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Annuler",
              onAction: () => setShowCreateModal(false),
            },
          ]}
        >
          <Modal.Section>
            <Form id="create-agent-form" method="post">
              <input type="hidden" name="actionType" value="create" />
              <FormLayout>
                <TextField
                  label="Nom complet"
                  name="name"
                  value={formName}
                  onChange={setFormName}
                  autoComplete="off"
                  requiredIndicator
                />
                <TextField
                  label="Téléphone"
                  name="phone"
                  value={formPhone}
                  onChange={setFormPhone}
                  autoComplete="off"
                  requiredIndicator
                  placeholder="+225..."
                />
                <Select
                  label="Pays"
                  name="country"
                  options={countryOptions}
                  value={formCountry}
                  onChange={setFormCountry}
                  requiredIndicator
                />
                <TextField
                  label="Ville (optionnel)"
                  name="city"
                  value={formCity}
                  onChange={setFormCity}
                  autoComplete="off"
                />
                <Select
                  label="Rôle"
                  name="role"
                  options={roleOptions}
                  value={formRole}
                  onChange={(v) => setFormRole(v as AgentRole)}
                />
                <TextField
                  label="Telegram User ID (optionnel)"
                  name="telegramUserId"
                  value={formTelegramUserId}
                  onChange={setFormTelegramUserId}
                  autoComplete="off"
                  helpText="Identifiant numérique de l'utilisateur Telegram pour les notifications"
                />
              </FormLayout>
            </Form>
          </Modal.Section>
        </Modal>

        {/* Edit Modal */}
        <Modal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Modifier le livreur"
          primaryAction={{
            content: "Enregistrer",
            onAction: () => {
              const form = document.getElementById("edit-agent-form") as HTMLFormElement;
              form?.requestSubmit();
            },
            loading: isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Annuler",
              onAction: () => setShowEditModal(false),
            },
          ]}
        >
          <Modal.Section>
            <Form id="edit-agent-form" method="post">
              <input type="hidden" name="actionType" value="update" />
              <input type="hidden" name="agentId" value={selectedAgent?.id || ""} />
              <FormLayout>
                <TextField
                  label="Nom complet"
                  name="name"
                  value={formName}
                  onChange={setFormName}
                  autoComplete="off"
                  requiredIndicator
                />
                <TextField
                  label="Téléphone"
                  name="phone"
                  value={formPhone}
                  onChange={setFormPhone}
                  autoComplete="off"
                  requiredIndicator
                />
                <Select
                  label="Pays"
                  name="country"
                  options={countryOptions}
                  value={formCountry}
                  onChange={setFormCountry}
                  requiredIndicator
                />
                <TextField
                  label="Ville (optionnel)"
                  name="city"
                  value={formCity}
                  onChange={setFormCity}
                  autoComplete="off"
                />
                <Select
                  label="Rôle"
                  name="role"
                  options={roleOptions}
                  value={formRole}
                  onChange={(v) => setFormRole(v as AgentRole)}
                />
                <TextField
                  label="Telegram User ID (optionnel)"
                  name="telegramUserId"
                  value={formTelegramUserId}
                  onChange={setFormTelegramUserId}
                  autoComplete="off"
                />
              </FormLayout>
            </Form>
          </Modal.Section>
        </Modal>

        {/* Delete/Deactivate Modal */}
        <Modal
          open={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title={selectedAgent?.isActive ? "Désactiver le livreur" : "Supprimer le livreur"}
          primaryAction={{
            content: selectedAgent?.isActive ? "Désactiver" : "Supprimer définitivement",
            tone: "critical",
            onAction: () => {
              const form = document.getElementById("delete-agent-form") as HTMLFormElement;
              form?.requestSubmit();
            },
            loading: isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Annuler",
              onAction: () => setShowDeleteModal(false),
            },
          ]}
        >
          <Modal.Section>
            <Text as="p">
              {selectedAgent?.isActive
                ? `Êtes-vous sûr de vouloir désactiver "${selectedAgent?.name}" ? Il n'apparaîtra plus dans les attributions de livraison.`
                : `Êtes-vous sûr de vouloir supprimer définitivement "${selectedAgent?.name}" ? Cette action est irréversible.`}
            </Text>
            <Form id="delete-agent-form" method="post">
              <input
                type="hidden"
                name="actionType"
                value={selectedAgent?.isActive ? "deactivate" : "delete"}
              />
              <input type="hidden" name="agentId" value={selectedAgent?.id || ""} />
            </Form>
          </Modal.Section>
        </Modal>

        {/* Toast */}
        {toastMessage && (
          <Toast
            content={toastMessage}
            error={toastError}
            onDismiss={() => setToastMessage(null)}
          />
        )}
      </Page>
    </Frame>
  );
}
