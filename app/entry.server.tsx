import { PassThrough } from "stream";

import { type HandleDocumentFunction } from "@shopify/remix-oxygen";
import { createRequestHandler, type ServerRuntimeMetaFunction } from "@shopify/remix-oxygen";

export const handleDocument: HandleDocumentFunction = async ({ renderHead, data }) => {
  return (
    <html lang="en">
      <head>
        {renderHead()}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Shopify Logistics SaaS" />
        <title>Shopify Logistics</title>
      </head>
      <body>
        <div id="root">{data?.html}</div>
      </body>
    </html>
  );
};

export const headers = {
  "Cache-Control": "max-age=300, s-maxage=3600",
};

export const meta: ServerRuntimeMetaFunction = () => {
  return [{ title: "Shopify Logistics SaaS" }];
};

export const loader = (args: any) => {
  return createRequestHandler({
    build: args.context.remixBuild,
    mode: args.context.mode,
    getLoadContext: () => args.context,
  })(args.request);
};