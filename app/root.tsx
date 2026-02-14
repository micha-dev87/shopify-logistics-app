import {
  type LinksFunction,
  type LoaderFunctionArgs,
  json,
} from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import "@shopify/polaris/build/esm/styles.css";

export const links: LinksFunction = () => [];

export async function loader({ request }: LoaderFunctionArgs) {
  return json({ healthy: true });
}

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
