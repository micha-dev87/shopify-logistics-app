interface HealthCheckResult {
  healthy: boolean;
  checks: {
    database: boolean;
    redis: boolean;
  };
}

export class HealthCheckService {
  async check(): Promise<HealthCheckResult> {
    const checks = {
      database: !!process.env.DATABASE_URL,
      redis: !!process.env.REDIS_URL,
    };

    return {
      healthy: Object.values(checks).every(Boolean),
      checks,
    };
  }
}
