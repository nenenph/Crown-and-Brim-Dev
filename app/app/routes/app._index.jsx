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
import { authenticate } from "../shopify.server.js";
import { db } from "../db/index";
import { products, serials, verificationLogs } from "../db/schema";
import { desc, eq } from "drizzle-orm";

// ==========================================
// 1. LOADER
// ==========================================
export async function loader({ request }) {
  const { session } = await authenticate.admin(request);

  try {
    const [allSerials, logs] = await Promise.all([
      db
        .select({
          id: serials.id,
          serialCode: serials.serialNumber,
          productName: products.title,
          sku: products.sku,
          collectorTier: serials.batchRelease, // Mapping batchRelease to tier display
          status: serials.status,
          createdAt: serials.createdAt,
        })
        .from(serials)
        .leftJoin(products, eq(serials.productId, products.id))
        .orderBy(desc(serials.createdAt))
        .catch(() => []),
      db
        .select()
        .from(verificationLogs)
        .orderBy(desc(verificationLogs.scannedAt))
        .limit(20)
        .catch(() => []),
    ]);

    const totalMinted = allSerials.length;
    const activeSerials = allSerials.filter((s) => s.status === "ACTIVE").length;
    const revokedSerials = allSerials.filter((s) => s.status === "REVOKED").length;

    const totalScans = logs.length;
    const securityThreats = logs.filter(
      (l) => l.statusReturned === "SUSPICIOUS" || l.statusReturned === "INVALID"
    ).length;

    return {
      shopDomain: session.shop,
      serials: allSerials || [],
      logs: logs || [],
      metrics: {
        totalMinted,
        activeSerials,
        revokedSerials,
        totalScans,
        securityThreats,
      },
    };
  } catch (error) {
    console.error("Dashboard loader error:", error);
    return {
      shopDomain: session.shop,
      serials: [],
      logs: [],
      metrics: { totalMinted: 0, activeSerials: 0, revokedSerials: 0, totalScans: 0, securityThreats: 0 },
    };
  }
}

// ==========================================
// 2. ACTION
// ==========================================
export async function action({ request }) {
  await authenticate.admin(request);
  const body = await request.json().catch(() => ({}));
  const { intent, serialCode, productName, collectorTier, status, id } = body;

  try {
    if (intent === "mint_serial") {
      if (!serialCode || !productName) {
        return Response.json(
          { error: "Missing required fields: serialCode, productName" },
          { status: 400 }
        );
      }

      const productId = `p-${Date.now()}`;
      await db.insert(products).values({
        id: productId,
        title: productName,
        sku: `SKU-${Math.floor(Math.random() * 90000) + 10000}`,
      });

      await db.insert(serials).values({
        id: `s-${Date.now()}`,
        productId,
        serialNumber: serialCode,
        batchRelease: collectorTier || "Standard",
        encryptionHash: crypto.randomUUID(),
        status: "ACTIVE",
      });

      return Response.json({ success: true, message: "Serial artifact minted successfully." });
    }

    if (intent === "update_serial") {
      if (!id) {
        return Response.json({ error: "Missing serial record ID" }, { status: 400 });
      }

      await db
        .update(serials)
        .set({ status })
        .where(eq(serials.id, id));

      return Response.json({ success: true, message: "Serial status updated successfully." });
    }

    return Response.json({ error: "Invalid action intent" }, { status: 400 });
  } catch (error) {
    console.error("Vault Action Error:", error);
    return Response.json({ error: "Internal server execution error" }, { status: 500 });
  }
}

// ==========================================
// 3. MAIN DASHBOARD COMPONENT
// ==========================================
export default function VaultDashboard() {
  const loaderData = useLoaderData();
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
      JSON.stringify({
        intent: "mint_serial",
        serialCode,
        productName,
        collectorTier,
      }),
      { method: "POST", encType: "application/json" }
    );
    setSerialCode("");
    setProductName("");
    setCollectorTier("Standard");
    handleModalChange();
  };

  const handleStatusToggle = (id, currentStatus) => {
    const newStatus = currentStatus === "ACTIVE" ? "REVOKED" : "ACTIVE";
    fetcher.submit(
      JSON.stringify({
        intent: "update_serial",
        id: String(id),
        status: newStatus,
      }),
      { method: "POST", encType: "application/json" }
    );
  };

  // Filter Serials based on search query and status filter
  const filteredSerials = serials.filter((s) => {
    const matchesSearch =
      s.serialCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.productName && s.productName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (statusFilter === "active") return matchesSearch && s.status === "ACTIVE";
    if (statusFilter === "revoked") return matchesSearch && s.status === "REVOKED";
    return matchesSearch;
  });

  const tableItems = filteredSerials.map((s) => ({ ...s, id: String(s.id) }));
  const resourceName = { singular: "artifact", plural: "artifacts" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(tableItems);

  const renderStatusBadge = (status) => {
    switch (status) {
      case "ACTIVE":
        return <Badge tone="success">Active</Badge>;
      case "REVOKED":
        return <Badge tone="critical">Revoked</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const renderActionBadge = (statusReturned) => {
    switch (statusReturned) {
      case "VERIFIED":
        return <Badge tone="success">Authentic</Badge>;
      case "SUSPICIOUS":
        return <Badge tone="critical">Compromised</Badge>;
      case "INVALID":
        return <Badge tone="attention">Not Found</Badge>;
      default:
        return <Badge>{statusReturned}</Badge>;
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
          {productName || "—"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="info">{collectorTier || "Standard"}</Badge>
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
          tone={status === "ACTIVE" ? "critical" : undefined}
          onClick={() => handleStatusToggle(id, status)}
        >
          {status === "ACTIVE" ? "Revoke Tag" : "Reinstate Tag"}
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Crown & Brim Co. // Vault Authenticator"
      subtitle={`Connected Shop: ${loaderData?.shopDomain || "Admin Session"}`}
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
              The Vault Risk Engine detected {metrics.securityThreats} flagged or invalid verification attempts.
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
                      Real-Time Verification Logs
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
                                IP: {log.ipAddress || "127.0.0.1"}
                              </Text>
                              {renderActionBadge(log.statusReturned)}
                            </InlineStack>
                            <Text variant="bodyXs">Serial ID: {log.serialId}</Text>
                            <Text variant="bodyXs" tone="subdued">
                              {log.scannedAt ? new Date(log.scannedAt).toLocaleString() : "N/A"}
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