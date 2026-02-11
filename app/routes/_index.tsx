import { json, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { useLoaderData } from "@remix-run/react";
import { Card, Page, SkeletonBodyText, Text } from "@shopify/polaris";
import { DashboardIcon } from "@shopify/polaris-icons";

export async function loader({ context }: LoaderFunctionArgs) {
  // Fetch shop data
  const shop = await context.session.get("shop");

  return json({
    shop: {
      name: shop?.name || "Shop Name",
      domain: shop?.domain || "my-shop.myshopify.com",
    },
  });
}

export default function Index() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Shopify Logistics Dashboard"
      primaryAction={{
        content: "Settings",
        onAction: () => console.log("Settings clicked"),
      }}
    >
      <div style={{ padding: "20px" }}>
        <Card sectioned>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <DashboardIcon />
            <div>
              <Text as="h2" variant="headingLg">
                Welcome to Shopify Logistics
              </Text>
              <Text as="p" variant="bodyMd">
                Manage your delivery agents and orders for {shop.name}
              </Text>
            </div>
          </div>
        </Card>

        <Card sectioned title="Quick Stats">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
            <Card sectioned>
              <SkeletonBodyText lines={2} />
            </Card>
            <Card sectioned>
              <SkeletonBodyText lines={2} />
            </Card>
            <Card sectioned>
              <SkeletonBodyText lines={2} />
            </Card>
          </div>
        </Card>
      </div>
    </Page>
  );
}