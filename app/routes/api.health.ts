import { json, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { logger } from "../lib/logger.server";

export async function loader({ context }: LoaderFunctionArgs) {
  try {
    // Check database connection
    const dbHealth = await checkDatabase();

    // Check Redis
    const redisHealth = await checkRedis();

    // Check Telegram
    const telegramHealth = await checkTelegram();

    const healthy = dbHealth && redisHealth && telegramHealth;

    logger.info("Health check", {
      healthy,
      checks: { db: dbHealth, redis: redisHealth, telegram: telegramHealth }
    });

    return json({
      healthy,
      checks: {
        database: dbHealth,
        redis: redisHealth,
        telegram: telegramHealth,
      },
    }, {
      status: healthy ? 200 : 503,
    });
  } catch (error) {
    logger.error("Health check failed", error);
    return json({
      healthy: false,
      checks: {
        database: false,
        redis: false,
        telegram: false,
      },
    }, { status: 503 });
  }
}

async function checkDatabase(): Promise<boolean> {
  try {
    // Simple check - in real app, you'd query the database
    const dbUrl = process.env.DATABASE_URL;
    return !!dbUrl;
  } catch (error) {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    // Simple check - in real app, you'd ping Redis
    const redisUrl = process.env.REDIS_URL;
    return !!redisUrl;
  } catch (error) {
    return false;
  }
}

async function checkTelegram(): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;

    // In a real app, you'd make an API call to check the bot
    // For now, just check if token exists
    return token.length > 0;
  } catch (error) {
    return false;
  }
}