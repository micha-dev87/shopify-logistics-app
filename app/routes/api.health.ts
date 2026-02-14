import { json, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const checks = {
    database: !!process.env.DATABASE_URL,
    redis: !!process.env.REDIS_URL,
  };

  const healthy = Object.values(checks).every(Boolean);

  return json(
    {
      status: healthy ? "healthy" : "unhealthy",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
