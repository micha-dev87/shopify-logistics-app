import {
  type LinksFunction,
  type LoaderFunctionArgs,
  json,
} from "@shopify/remix-oxygen";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { AnalyticsScript, ShopifyRoot } from "@shopify/app-bridge-react";
import { polarisCSS } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";

import { logger } from "./lib/logger.server";
import { HealthCheckService } from "./services/health-check.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisCSS },
];

export async function loader({ context }: LoaderFunctionArgs) {
  const healthCheck = new HealthCheckService(context);
  const health = await healthCheck.check();

  if (!health.healthy) {
    logger.error("Health check failed", health);
    throw json({ error: "Health check failed" }, { status: 503 });
  }

  return json({ healthy: true });
}

export default function App() {
  return (
    <ShopifyRoot>
      <html lang="en">
        <head>
          <Meta />
          <Links />
        </head>
        <body>
          <AnalyticsScript />
          <ScrollRestoration />
          <Outlet />
          <Scripts />
        </body>
      </html>
    </ShopifyRoot>
  );
}