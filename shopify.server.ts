import {
  type AppLoadContext,
  createSessionStorage,
  createCookieSessionStorage,
} from "@shopify/remix-oxygen";
import { createAppClient } from "@shopify/app-bridge-client";
import { redirect } from "@shopify/remix-oxygen";

const sessionStorage = createSessionStorage({
  cookie: {
    name: "_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "s3cr3t"],
  },
});

export async function shopifyAuth({ request, context }: { request: Request; context: AppLoadContext }) {
  const session = await sessionStorage.getSession(request.headers.get("cookie"));
  const { shop } = session.get("session") || {};

  if (!shop) {
    const auth = await context.session.get(request);
    if (!auth) {
      throw redirect("/auth");
    }
    return auth;
  }

  return context.session;
}

export function createShopifyApp({ request }: { request: Request }) {
  const session = request.headers.get("cookie");

  return createAppClient({
    apiKey: process.env.SHOPIFY_API_KEY!,
    host: request.headers.get("host")!,
    forceRedirect: true,
  });
}