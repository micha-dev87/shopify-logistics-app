import { type AppLoadContext } from "@shopify/remix-oxygen";

interface HealthCheckResult {
  healthy: boolean;
  checks: {
    database: boolean;
    redis: boolean;
    telegram: boolean;
  };
}

export class HealthCheckService {
  private context: AppLoadContext;

  constructor(context: AppLoadContext) {
    this.context = context;
  }

  async check(): Promise<HealthCheckResult> {
    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      telegram: await this.checkTelegram(),
    };

    return {
      healthy: Object.values(checks).every(Boolean),
      checks,
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      const response = await fetch("/api/health/database");
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const response = await fetch("/api/health/redis");
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private async checkTelegram(): Promise<boolean> {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) return false;

      const response = await fetch(
        `https://api.telegram.org/bot${token}/getMe`
      );
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}