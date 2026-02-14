import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Card, Page, Text } from "@shopify/polaris";

export async function loader({ request }: LoaderFunctionArgs) {
  return json({
    shop: {
      name: "Shop Name",
      domain: "my-shop.myshopify.com",
    },
  });
}

export default function Index() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <Page title="Shopify Logistics Dashboard">
      <Card>
        <Text as="h2" variant="headingLg">
          Welcome to Shopify Logistics
        </Text>
        <Text as="p" variant="bodyMd">
          Manage your delivery agents and orders for {shop.name}
        </Text>
      </Card>
    </Page>
  );
}
