import { useState, useCallback } from "react";
import { useLoaderData, useFetcher } from "react-router";
import {
  Page,
  Card,
  Grid,
  Text,
  Badge,
  Button,
  Modal,
  TextField,
  Select,
  IndexTable,
  useIndexResourceState,
  BlockStack,
  InlineStack,
  Banner,
  Tabs,
  Box,
  Divider,
} from "@shopify/polaris";
import { db } from "../db/index";
import { serialArtifacts, activityLogs } from "../db/schema";
import { desc, eq } from "drizzle-orm";

// ==========================================
// 1. LOADER
// ==========================================
export async function loader() {
  const defaultShopId = 1;

  try {
    const serials = await db
      .select()
      .from(serialArtifacts)
      .where(eq(serialArtifacts.shopId, defaultShopId))
      .orderBy(desc(serialArtifacts.createdAt));

    const logs = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.shopId, defaultShopId))
      .orderBy(desc(activityLogs.timestamp))
      .limit(20);

    const totalMinted = serials.length;
    const activeSerials = serials.filter((s) => s.status === "active").length;
    const revokedSerials = serials.filter((s) => s.status === "revoked").length;

    const totalScans = logs.length;
    const revokedAttempts = logs.filter((l) => l.actionTaken === "FLAGGED_REVOKED").length;
    const rateLimitedAttempts = logs.filter((l) => l.actionTaken === "RATE_LIMITED_WARNING").length;

    return {
      shopId: defaultShopId,
      serials: serials || [],
      logs: logs || [],
      metrics: {
        totalMinted,
        activeSerials,
        revokedSerials,
        totalScans,
        securityThreats: revokedAttempts + rateLimitedAttempts,
      },
    };
  } catch (error) {
    console.error("Dashboard loader error:", error);
    return {
      shopId: defaultShopId,
      serials: [],
      logs: [],
      metrics: { totalMinted: 0, activeSerials: 0, revokedSerials: 0, totalScans: 0, securityThreats: 0 },
    };
  }
}

// ==========================================
// 2. MAIN DASHBOARD COMPONENT
// ==========================================
export default function VaultDashboard() {
  const loaderData = useLoaderData();
  const shopId = loaderData?.shopId ?? 1;
  const serials = loaderData?.serials ?? [];
  const logs = loaderData?.logs ?? [];
  const metrics = loaderData?.metrics ?? {
    totalMinted: 0,
    activeSerials: 0,
    revokedSerials: 0,
    totalScans: 0,
    securityThreats: 0,
  };

  const fetcher = useFetcher();

  // Navigation & Filter States
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal Form States
  const [modalActive, setModalActive] = useState(false);
  const [serialCode, setSerialCode] = useState("");
  const [productName, setProductName] = useState("");
  const [collectorTier, setCollectorTier] = useState("Standard");

  const handleModalChange = useCallback(() => setModalActive((active) => !active), []);

  const handleMintSubmit = () => {
    fetcher.submit(
      {
        intent: "mint_serial",
        shopId: String(shopId),
        serialCode,
        productName,
        collectorTier,
      },
      { method: "POST", action: "/app/vault", encType: "application/json" }
    );
    setSerialCode("");
    setProductName("");
    setCollectorTier("Standard");
    handleModalChange();
  };

  const handleStatusToggle = (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "revoked" : "active";
    fetcher.submit(
      {
        intent: "update_serial",
        id: String(id),
        status: newStatus,
      },
      { method: "POST", action: "/app/vault", encType: "application/json" }
    );
  };

  // Filter Serials based on search query and status filter
  const filteredSerials = serials.filter((s) => {
    const matchesSearch =
      s.serialCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.productName.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === "active") return matchesSearch && s.status === "active";
    if (statusFilter === "revoked") return matchesSearch && s.status === "revoked";
    return matchesSearch;
  });

  const tableItems = filteredSerials.map((s) => ({ ...s, id: String(s.id) }));
  const resourceName = { singular: "artifact", plural: "artifacts" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(tableItems);

  const renderStatusBadge = (status) => {
    switch (status) {
      case "active":
        return <Badge tone="success">Active</Badge>;
      case "revoked":
        return <Badge tone="critical">Revoked</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const renderActionBadge = (actionTaken) => {
    switch (actionTaken) {
      case "ACCESS_GRANTED":
        return <Badge tone="success">Authentic (+25)</Badge>;
      case "FLAGGED_REVOKED":
        return <Badge tone="critical">Compromised (-50)</Badge>;
      case "RATE_LIMITED_WARNING":
        return <Badge tone="warning">Throttled (+5)</Badge>;
      case "INVALID_SCAN":
        return <Badge tone="attention">Not Found (0)</Badge>;
      default:
        return <Badge>{actionTaken}</Badge>;
    }
  };

  const tabs = [
    {
      id: "inventory-tab",
      content: `Artifact Inventory (${serials.length})`,
    },
    {
      id: "telemetry-tab",
      content: `Security Telemetry (${logs.length})`,
    },
  ];

  const rowMarkup = filteredSerials.map(({ id, serialCode, productName, collectorTier, status, createdAt }, index) => (
    <IndexTable.Row
      id={String(id)}
      key={id}
      selected={selectedResources.includes(String(id))}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodySm" fontWeight="bold">
          {serialCode}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodySm" truncate>
          {productName}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="info">{collectorTier}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{renderStatusBadge(status)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyXs" tone="subdued">
          {createdAt ? new Date(createdAt).toLocaleDateString() : "N/A"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button
          size="slim"
          tone={status === "active" ? "critical" : undefined}
          onClick={() => handleStatusToggle(id, status)}
        >
          {status === "active" ? "Revoke Tag" : "Reinstate Tag"}
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Crown & Brim Co. // Vault Authenticator"
      subtitle="Exclusivity Protection & Security Telemetry"
      compactTitle
      primaryAction={{
        content: "Mint Serial",
        onAction: handleModalChange,
      }}
    >
      <BlockStack gap="400">
        {/* Compact KPI Metric Strip */}
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card padding="300">
              <BlockStack gap="050">
                <Text variant="bodySm" as="h3" tone="subdued">
                  Total Minted
                </Text>
                <Text variant="headingLg" as="p">
                  {metrics.totalMinted}
                </Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card padding="300">
              <BlockStack gap="050">
                <Text variant="bodySm" as="h3" tone="subdued">
                  Active Verified
                </Text>
                <Text variant="headingLg" as="p" tone="success">
                  {metrics.activeSerials}
                </Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card padding="300">
              <BlockStack gap="050">
                <Text variant="bodySm" as="h3" tone="subdued">
                  Revoked / Compromised
                </Text>
                <Text variant="headingLg" as="p" tone="critical">
                  {metrics.revokedSerials}
                </Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card padding="300">
              <BlockStack gap="050">
                <Text variant="bodySm" as="h3" tone="subdued">
                  Threat Alerts
                </Text>
                <Text variant="headingLg" as="p" tone={metrics.securityThreats > 0 ? "critical" : "subdued"}>
                  {metrics.securityThreats}
                </Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        {metrics.securityThreats > 0 && (
          <Banner title="Suspicious Verification Activity" tone="warning">
            <p>
              The Vault Risk Engine detected {metrics.securityThreats} high-frequency or compromised lookups.
            </p>
          </Banner>
        )}

        {/* Compact Navigation Tabs Card */}
        <Card padding="0">
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
            {selectedTab === 0 ? (
              <BlockStack gap="0">
                {/* Slim Search & Filter Bar */}
                <Box padding="300" borderBlockEndWidth="025" borderColor="border-subdued">
                  <InlineStack align="space-between" blockAlign="center" gap="300">
                    <Box width="260px">
                      <TextField
                        label="Search"
                        labelHidden
                        placeholder="Search serial or product..."
                        value={searchQuery}
                        onChange={setSearchQuery}
                        clearButton
                        onClearButtonClick={() => setSearchQuery("")}
                        autoComplete="off"
                        size="slim"
                      />
                    </Box>

                    <InlineStack gap="150">
                      <Button
                        size="slim"
                        pressed={statusFilter === "all"}
                        onClick={() => setStatusFilter("all")}
                      >
                        All ({serials.length})
                      </Button>
                      <Button
                        size="slim"
                        pressed={statusFilter === "active"}
                        onClick={() => setStatusFilter("active")}
                      >
                        Active ({metrics.activeSerials})
                      </Button>
                      <Button
                        size="slim"
                        pressed={statusFilter === "revoked"}
                        onClick={() => setStatusFilter("revoked")}
                      >
                        Revoked ({metrics.revokedSerials})
                      </Button>
                    </InlineStack>
                  </InlineStack>
                </Box>

                {/* High-Density Artifact Table */}
                {filteredSerials.length > 0 ? (
                  <IndexTable
                    resourceName={resourceName}
                    itemCount={filteredSerials.length}
                    selectedItemsCount={
                      allResourcesSelected ? "All" : selectedResources.length
                    }
                    onSelectionChange={handleSelectionChange}
                    headings={[
                      { title: "Serial Code" },
                      { title: "Product Title" },
                      { title: "Collector Tier" },
                      { title: "Status" },
                      { title: "Mint Date" },
                      { title: "Actions" },
                    ]}
                  >
                    {rowMarkup}
                  </IndexTable>
                ) : (
                  <Box padding="600">
                    <BlockStack align="center" inlineAlign="center" gap="200">
                      <Text tone="subdued" as="p" variant="bodySm">
                        {searchQuery
                          ? `No artifacts matching "${searchQuery}"`
                          : "No serial artifacts minted yet."}
                      </Text>
                      {searchQuery && (
                        <Button size="slim" onClick={() => setSearchQuery("")}>
                          Clear Search
                        </Button>
                      )}
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            ) : (
              /* High-Density Telemetry Logs View */
              <Box padding="300">
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodyMd" fontWeight="bold">
                      Real-Time Telemetry Log
                    </Text>
                    <Text variant="bodyXs" tone="subdued">
                      Showing last 20 events
                    </Text>
                  </InlineStack>

                  <Divider />

                  {logs.length > 0 ? (
                    <BlockStack gap="200">
                      {logs.map((log) => (
                        <Box
                          key={log.id}
                          padding="200"
                          background="bg-surface-secondary"
                          borderRadius="100"
                        >
                          <BlockStack gap="050">
                            <InlineStack align="space-between" blockAlign="center">
                              <Text variant="bodySm" fontWeight="bold">
                                {log.customerId || "Guest Terminal"}
                              </Text>
                              {renderActionBadge(log.actionTaken)}
                            </InlineStack>
                            <Text variant="bodyXs">{log.details}</Text>
                            <Text variant="bodyXs" tone="subdued">
                              {log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A"}
                            </Text>
                          </BlockStack>
                        </Box>
                      ))}
                    </BlockStack>
                  ) : (
                    <Text tone="subdued" as="p" variant="bodySm">
                      No recent verification events logged.
                    </Text>
                  )}
                </BlockStack>
              </Box>
            )}
          </Tabs>
        </Card>
      </BlockStack>

      {/* Mint Serial Modal */}
      <Modal
        open={modalActive}
        onClose={handleModalChange}
        title="Mint Vault Serial Artifact"
        primaryAction={{
          content: "Confirm & Mint",
          onAction: handleMintSubmit,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleModalChange,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label="Serial Code"
              value={serialCode}
              onChange={setSerialCode}
              placeholder="e.g. CB-2026-VIP-001"
              autoComplete="off"
            />
            <TextField
              label="Product Title"
              value={productName}
              onChange={setProductName}
              placeholder="e.g. Crown & Brim Signature Snapback"
              autoComplete="off"
            />
            <Select
              label="Collector Tier"
              options={[
                { label: "Standard", value: "Standard" },
                { label: "VIP Collector", value: "VIP" },
                { label: "Founder Edition", value: "Founder" },
              ]}
              value={collectorTier}
              onChange={setCollectorTier}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}