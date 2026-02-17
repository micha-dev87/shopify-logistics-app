// Billing plan names - shared between server and client
export const PLAN_BASIC = "Basique";
export const PLAN_GOLD = "Gold";
export const PLAN_PRO = "Pro";

// Plan limits (max delivery agents per plan)
export const PLAN_LIMITS: Record<string, number> = {
  [PLAN_BASIC]: 2,
  [PLAN_GOLD]: 5,
  [PLAN_PRO]: 10,
};

// Plan pricing info for UI
export interface PlanInfo {
  name: string;
  price: string;
  agents: number;
  features: string[];
  recommended?: boolean;
}

export const PLANS: PlanInfo[] = [
  {
    name: PLAN_BASIC,
    price: "4.99",
    agents: PLAN_LIMITS[PLAN_BASIC],
    features: [
      "Jusqu'à 2 livreurs",
      "Notifications Telegram",
      "Dashboard de suivi",
      "Attribution automatique",
    ],
  },
  {
    name: PLAN_GOLD,
    price: "9.99",
    agents: PLAN_LIMITS[PLAN_GOLD],
    recommended: true,
    features: [
      "Jusqu'à 5 livreurs",
      "Notifications Telegram",
      "Dashboard de suivi",
      "Attribution automatique",
      "Notifications email",
    ],
  },
  {
    name: PLAN_PRO,
    price: "19.99",
    agents: PLAN_LIMITS[PLAN_PRO],
    features: [
      "Jusqu'à 10 livreurs",
      "Notifications Telegram",
      "Dashboard de suivi",
      "Attribution automatique",
      "Notifications email",
      "Widget WhatsApp",
      "Support prioritaire",
    ],
  },
];
