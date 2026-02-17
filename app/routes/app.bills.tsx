import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  DataTable,
  Thumbnail,
  Banner,
  Divider,
  Box,
  Select,
  TextField,
  IndexTable,
  Modal,
  Form,
  FormLayout,
  Toast,
  Frame,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useCallback, useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getCountryName } from "../african-countries";
import type { DeliveryStatus, DeliveryBill, DeliveryAgent } from "@prisma/client";

// ============================================================
// LOADER - Fetch all delivery bills for current shop
// ============================================================
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || "all";
  const searchQuery = url.searchParams.get("q") || "";

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    include: {
      deliveryAgents: {
        where: { isActive: true },
        select: { id: true, name: true },
      },
    },
  });

  if (!shop) {
    return json({ bills: [], agents: [], shopName: "" });
  }

  // Build where clause
  const where: any = { shopId: shop.id };

  if (statusFilter !== "all") {
    where.status = statusFilter as DeliveryStatus;
  }

  if (searchQuery) {
    where.OR = [
      { customerName: { contains: searchQuery, mode: "insensitive" } },
      { orderName: { contains: searchQuery, mode: "insensitive" } },
      { productTitle: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  const bills = await prisma.deliveryBill.findMany({
    where,
    include: {
      assignedAgent: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Get stats
  const stats = await prisma.deliveryBill.groupBy({
    by: ["status"],
    where: { shopId: shop.id },
    _count: { id: true },
  });

  const statsMap = stats.reduce((acc, s) => {
    acc[s.status] = s._count.id;
    return acc;
  }, {} as Record<string, number>);

  return json({
    shopName: shop.name,
    bills: bills.map((bill) => ({
      id: bill.id,
      orderId: bill.orderId,
      orderName: bill.orderName || "-",
      customerName: bill.customerName,
      customerAddress: bill.customerAddress,
      customerPhone: bill.customerPhone || "-",
      productTitle: bill.productTitle,
      productImage: bill.productImage,
      productQuantity: bill.productQuantity,
      status: bill.status,
      statusLabel: getStatusLabel(bill.status),
      statusTone: getStatusTone(bill.status),
      assignedAgent: bill.assignedAgent,
      deliveryNotes: bill.deliveryNotes,
      createdAt: bill.createdAt.toISOString(),
    })),
    agents: shop.deliveryAgents,
    stats: statsMap,
    statusFilter,
    searchQuery,
  });
};

// ============================================================
// ACTION - Update bill status, assign agent
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
      case "updateStatus": {
        const billId = formData.get("billId") as string;
        const newStatus = formData.get("status") as DeliveryStatus;

        const bill = await prisma.deliveryBill.findFirst({
          where: { id: billId, shopId: shop.id },
        });

        if (!bill) {
          return json({ error: "Bon de livraison non trouvé" }, { status: 404 });
        }

        // Validate status transition
        if (!isValidTransition(bill.status, newStatus)) {
          return json({ error: "Transition de statut invalide" }, { status: 400 });
        }

        // Update status with history
        const statusHistory = (bill.statusHistory as any[]) || [];
        statusHistory.push({
          status: newStatus,
          timestamp: new Date().toISOString(),
          previousStatus: bill.status,
        });

        await prisma.deliveryBill.update({
          where: { id: billId },
          data: {
            status: newStatus,
            statusHistory,
            deliveryNotes: (formData.get("notes") as string) || bill.deliveryNotes,
          },
        });

        return json({ success: true, message: `Statut mis à jour vers ${getStatusLabel(newStatus)}` });
      }

      case "assignAgent": {
        const billId = formData.get("billId") as string;
        const agentId = formData.get("agentId") as string;

        const bill = await prisma.deliveryBill.findFirst({
          where: { id: billId, shopId: shop.id },
        });

        if (!bill) {
          return json({ error: "Bon de livraison non trouvé" }, { status: 404 });
        }

        // Verify agent belongs to this shop
        const agent = await prisma.deliveryAgent.findFirst({
          where: { id: agentId, shopId: shop.id, isActive: true },
        });

        if (!agent) {
          return json({ error: "Livreur non trouvé ou inactif" }, { status: 404 });
        }

        // Update bill with agent and change status to ASSIGNED
        const statusHistory = (bill.statusHistory as any[]) || [];
        if (bill.status === "PENDING") {
          statusHistory.push({
            status: "ASSIGNED",
            timestamp: new Date().toISOString(),
            agentId,
            agentName: agent.name,
          });
        }

        await prisma.deliveryBill.update({
          where: { id: billId },
          data: {
            assignedAgentId: agentId,
            status: bill.status === "PENDING" ? "ASSIGNED" : bill.status,
            statusHistory,
          },
        });

        return json({ success: true, message: `Commande attribuée à ${agent.name}` });
      }

      case "unassign": {
        const billId = formData.get("billId") as string;

        const bill = await prisma.deliveryBill.findFirst({
          where: { id: billId, shopId: shop.id },
        });

        if (!bill) {
          return json({ error: "Bon de livraison non trouvé" }, { status: 404 });
        }

        const statusHistory = (bill.statusHistory as any[]) || [];
        statusHistory.push({
          status: "PENDING",
          timestamp: new Date().toISOString(),
          previousStatus: bill.status,
          action: "unassigned",
        });

        await prisma.deliveryBill.update({
          where: { id: billId },
          data: {
            assignedAgentId: null,
            status: "PENDING",
            statusHistory,
          },
        });

        return json({ success: true, message: "Attribution supprimée" });
      }

      default:
        return json({ error: "Action non reconnue" }, { status: 400 });
    }
  } catch (error) {
    console.error("Bill action error:", error);
    return json({ error: "Une erreur est survenue" }, { status: 500 });
  }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
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

function getStatusTone(status: DeliveryStatus): "success" | "info" | "warning" | "critical" | undefined {
  const tones: Record<DeliveryStatus, "success" | "info" | "warning" | "critical" | undefined> = {
    PENDING: "warning",
    ASSIGNED: "info",
    IN_PROGRESS: "info",
    DELIVERED: "success",
    NOT_DELIVERED: "critical",
    CANCELLED: undefined,
  };
  return tones[status];
}

function isValidTransition(current: DeliveryStatus, next: DeliveryStatus): boolean {
  // CANCELLED can be set from any state
  if (next === "CANCELLED") return true;

  const validTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
    PENDING: ["ASSIGNED", "CANCELLED"],
    ASSIGNED: ["IN_PROGRESS", "PENDING", "DELIVERED", "NOT_DELIVERED", "CANCELLED"],
    IN_PROGRESS: ["DELIVERED", "NOT_DELIVERED", "CANCELLED"],
    DELIVERED: [], // Terminal state
    NOT_DELIVERED: ["IN_PROGRESS", "CANCELLED"], // Can retry
    CANCELLED: [], // Terminal state
  };

  return validTransitions[current]?.includes(next) ?? false;
}

// ============================================================
// COMPONENT
// ============================================================
export default function BillsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === "submitting";

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  const [selectedBill, setSelectedBill] = useState<typeof loaderData.bills[0] | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newStatus, setNewStatus] = useState<DeliveryStatus>("IN_PROGRESS");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");

  useEffect(() => {
    const actionData = (window as any).__actionData;
    if (actionData?.success) {
      setToastMessage(actionData.message);
      setToastError(false);
      closeModals();
    } else if (actionData?.error) {
      setToastMessage(actionData.error);
      setToastError(true);
    }
  }, [loaderData]);

  const closeModals = () => {
    setShowStatusModal(false);
    setShowAssignModal(false);
    setShowDetailModal(false);
    setSelectedBill(null);
    setNewStatus("IN_PROGRESS");
    setDeliveryNotes("");
    setSelectedAgentId("");
  };

  const handleStatusUpdate = () => {
    if (!selectedBill) return;
    const formData = new FormData();
    formData.append("actionType", "updateStatus");
    formData.append("billId", selectedBill.id);
    formData.append("status", newStatus);
    formData.append("notes", deliveryNotes);
    submit(formData, { method: "post" });
  };

  const handleAssign = () => {
    if (!selectedBill || !selectedAgentId) return;
    const formData = new FormData();
    formData.append("actionType", "assignAgent");
    formData.append("billId", selectedBill.id);
    formData.append("agentId", selectedAgentId);
    submit(formData, { method: "post" });
  };

  const handleUnassign = () => {
    if (!selectedBill) return;
    const formData = new FormData();
    formData.append("actionType", "unassign");
    formData.append("billId", selectedBill.id);
    submit(formData, { method: "post" });
  };

  // Available status options based on current status
  const getAvailableStatuses = (currentStatus: DeliveryStatus): { label: string; value: string }[] => {
    const allStatuses: { label: string; value: DeliveryStatus }[] = [
      { label: "En attente", value: "PENDING" },
      { label: "Assigné", value: "ASSIGNED" },
      { label: "En cours", value: "IN_PROGRESS" },
      { label: "Livré", value: "DELIVERED" },
      { label: "Non livré", value: "NOT_DELIVERED" },
      { label: "Annulé", value: "CANCELLED" },
    ];

    return allStatuses.filter((s) => isValidTransition(currentStatus, s.value));
  };

  const statusFilterOptions = [
    { label: "Tous", value: "all" },
    { label: "En attente", value: "PENDING" },
    { label: "Assignés", value: "ASSIGNED" },
    { label: "En cours", value: "IN_PROGRESS" },
    { label: "Livrés", value: "DELIVERED" },
    { label: "Non livrés", value: "NOT_DELIVERED" },
  ];

  const rowMarkup = loaderData.bills.map((bill, index) => (
    <IndexTable.Row id={bill.id} key={bill.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold" as="span">
          {bill.orderName}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text variant="bodyMd" as="span">
            {bill.customerName}
          </Text>
          <Text variant="bodySm" tone="subdued">
            {bill.customerPhone}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text variant="bodyMd" as="span">
            {bill.productTitle}
          </Text>
          <Text variant="bodySm" tone="subdued">
            Qté: {bill.productQuantity}
          </Text>
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={bill.statusTone}>{bill.statusLabel}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {bill.assignedAgent ? (
          <Text variant="bodyMd" as="span">
            {bill.assignedAgent.name}
          </Text>
        ) : (
          <Text variant="bodyMd" tone="subdued" as="span">
            Non assigné
          </Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button
            size="slim"
            onClick={() => {
              setSelectedBill(bill);
              setShowDetailModal(true);
            }}
          >
            Détails
          </Button>
          {bill.status === "PENDING" && (
            <Button
              size="slim"
              onClick={() => {
                setSelectedBill(bill);
                setShowAssignModal(true);
              }}
            >
              Attribuer
            </Button>
          )}
          {bill.status !== "PENDING" && bill.status !== "DELIVERED" && bill.status !== "CANCELLED" && (
            <Button
              size="slim"
              onClick={() => {
                setSelectedBill(bill);
                setNewStatus("IN_PROGRESS");
                setShowStatusModal(true);
              }}
            >
              Statut
            </Button>
          )}
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Frame>
      <Page title="Bons de livraison" subtitle={`${loaderData.bills.length} commandes`}>
        <TitleBar title="Gestion des Bons de Livraison" />
        <BlockStack gap="500">
          {/* Stats Cards */}
          <Layout>
            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    En attente
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {loaderData.stats["PENDING"] || 0}
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    En cours
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {(loaderData.stats["ASSIGNED"] || 0) + (loaderData.stats["IN_PROGRESS"] || 0)}
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Livrés
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {loaderData.stats["DELIVERED"] || 0}
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>

          {/* Filters */}
          <Card>
            <Form method="get">
              <InlineStack gap="400" align="start" blockAlign="center">
                <Select
                  label=""
                  name="status"
                  options={statusFilterOptions}
                  value={loaderData.statusFilter}
                  onChange={() => {}}
                />
                <TextField
                  label=""
                  name="q"
                  placeholder="Rechercher commande, client..."
                  value={loaderData.searchQuery}
                  onChange={() => {}}
                  autoComplete="off"
                />
                <Button submit> filtrer</Button>
                {loaderData.statusFilter !== "all" || loaderData.searchQuery ? (
                  <Button url="/app/bills">Réinitialiser</Button>
                ) : null}
              </InlineStack>
            </Form>
          </Card>

          {/* Bills Table */}
          <Card>
            <IndexTable
              resourceName={{ singular: "bon de livraison", plural: "bons de livraison" }}
              itemCount={loaderData.bills.length}
              headings={[
                { title: "Commande" },
                { title: "Client" },
                { title: "Produit" },
                { title: "Statut" },
                { title: "Livreur" },
                { title: "Actions" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>

            {loaderData.bills.length === 0 && (
              <Box padding="400">
                <Text variant="bodyMd" as="p" alignment="center" tone="subdued">
                  Aucun bon de livraison. Les commandes Shopify apparaîtront automatiquement ici.
                </Text>
              </Box>
            )}
          </Card>
        </BlockStack>

        {/* Detail Modal */}
        <Modal
          open={showDetailModal}
          onClose={closeModals}
          title={`Commande ${selectedBill?.orderName || ""}`}
          primaryAction={{
            content: "Fermer",
            onAction: closeModals,
          }}
        >
          <Modal.Section>
            {selectedBill && (
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Client
                  </Text>
                  <Text variant="bodyMd">{selectedBill.customerName}</Text>
                  <Text variant="bodyMd" tone="subdued">
                    {selectedBill.customerAddress}
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    {selectedBill.customerPhone}
                  </Text>
                </BlockStack>
                <Divider />
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Produit
                  </Text>
                  <Text variant="bodyMd">{selectedBill.productTitle}</Text>
                  <Text variant="bodyMd" tone="subdued">
                    Quantité: {selectedBill.productQuantity}
                  </Text>
                </BlockStack>
                <Divider />
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Statut
                  </Text>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone={selectedBill.statusTone}>{selectedBill.statusLabel}</Badge>
                    {selectedBill.assignedAgent && (
                      <Text variant="bodyMd" tone="subdued">
                        Assigné à: {selectedBill.assignedAgent.name}
                      </Text>
                    )}
                  </InlineStack>
                </BlockStack>
                {selectedBill.deliveryNotes && (
                  <>
                    <Divider />
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">
                        Notes
                      </Text>
                      <Text variant="bodyMd">{selectedBill.deliveryNotes}</Text>
                    </BlockStack>
                  </>
                )}
                {selectedBill.status !== "DELIVERED" && selectedBill.status !== "CANCELLED" && (
                  <>
                    <Divider />
                    <InlineStack gap="200">
                      {selectedBill.status === "PENDING" && (
                        <Button
                          onClick={() => {
                            setShowDetailModal(false);
                            setShowAssignModal(true);
                          }}
                        >
                          Attribuer un livreur
                        </Button>
                      )}
                      {selectedBill.status !== "PENDING" && (
                        <>
                          <Button
                            onClick={() => {
                              setShowDetailModal(false);
                              setShowStatusModal(true);
                            }}
                          >
                            Changer le statut
                          </Button>
                          <Button tone="critical" onClick={handleUnassign}>
                            Supprimer l'attribution
                          </Button>
                        </>
                      )}
                    </InlineStack>
                  </>
                )}
              </BlockStack>
            )}
          </Modal.Section>
        </Modal>

        {/* Assign Modal */}
        <Modal
          open={showAssignModal}
          onClose={closeModals}
          title="Attribuer à un livreur"
          primaryAction={{
            content: "Attribuer",
            onAction: handleAssign,
            loading: isSubmitting,
            disabled: !selectedAgentId,
          }}
          secondaryActions={[
            {
              content: "Annuler",
              onAction: closeModals,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p">
                Commande: <strong>{selectedBill?.orderName}</strong>
              </Text>
              <Text as="p" tone="subdued">
                {selectedBill?.customerName} - {selectedBill?.customerAddress}
              </Text>
              <Select
                label="Sélectionner un livreur"
                options={[
                  { label: "Choisir un livreur", value: "" },
                  ...loaderData.agents.map((a) => ({ label: a.name, value: a.id })),
                ]}
                value={selectedAgentId}
                onChange={setSelectedAgentId}
              />
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Status Update Modal */}
        <Modal
          open={showStatusModal}
          onClose={closeModals}
          title="Mettre à jour le statut"
          primaryAction={{
            content: "Confirmer",
            onAction: handleStatusUpdate,
            loading: isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Annuler",
              onAction: closeModals,
            },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <Select
                label="Nouveau statut"
                options={selectedBill ? getAvailableStatuses(selectedBill.status) : []}
                value={newStatus}
                onChange={(v) => setNewStatus(v as DeliveryStatus)}
              />
              <TextField
                label="Notes de livraison (optionnel)"
                value={deliveryNotes}
                onChange={setDeliveryNotes}
                multiline={3}
                autoComplete="off"
              />
            </FormLayout>
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
