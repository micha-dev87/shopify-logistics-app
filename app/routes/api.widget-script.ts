import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

/**
 * Dynamic WhatsApp Widget Script Endpoint
 * 
 * This endpoint serves a JavaScript widget that:
 * 1. Shows a floating WhatsApp button
 * 2. Opens a panel to select country
 * 3. Shows contacts for selected country
 * 4. Opens WhatsApp with pre-filled message including current page URL
 * 
 * Usage: <script src="/api/widget-script?shop=shop.myshopify.com"></script>
 * 
 * SECURITY: Uses DOM APIs instead of innerHTML to prevent XSS
 * ACCESSIBILITY: Includes ARIA labels and keyboard navigation
 */

// Country emoji flags mapping
const COUNTRY_FLAGS: Record<string, string> = {
  DZ: "🇩🇿", AO: "🇦🇴", BJ: "🇧🇯", BW: "🇧🇼", BF: "🇧🇫", BI: "🇧🇮", CV: "🇨🇻", CM: "🇨🇲",
  CF: "🇨🇫", TD: "🇹🇩", KM: "🇰🇲", CG: "🇨🇬", CD: "🇨🇩", CI: "🇨🇮", DJ: "🇩🇯", EG: "🇪🇬",
  GQ: "🇬🇶", ER: "🇪🇷", SZ: "🇸🇿", ET: "🇪🇹", GA: "🇬🇦", GM: "🇬🇲", GH: "🇬🇭", GN: "🇬🇳",
  GW: "🇬🇼", KE: "🇰🇪", LS: "🇱🇸", LR: "🇱🇷", LY: "🇱🇾", MG: "🇲🇬", MW: "🇲🇼", ML: "🇲🇱",
  MR: "🇲🇷", MU: "🇲🇺", MA: "🇲🇦", MZ: "🇲🇿", NA: "🇳🇦", NE: "🇳🇪", NG: "🇳🇬", RW: "🇷🇼",
  ST: "🇸🇹", SN: "🇸🇳", SC: "🇸🇨", SL: "🇸🇱", SO: "🇸🇴", ZA: "🇿🇦", SS: "🇸🇸", SD: "🇸🇩",
  TZ: "🇹🇿", TG: "🇹🇬", TN: "🇹🇳", UG: "🇺🇬", ZM: "🇿🇲", ZW: "🇿🇼",
};

const COUNTRY_NAMES: Record<string, string> = {
  DZ: "Algérie", AO: "Angola", BJ: "Bénin", BW: "Botswana", BF: "Burkina Faso", BI: "Burundi",
  CV: "Cap-Vert", CM: "Cameroun", CF: "République centrafricaine", TD: "Tchad", KM: "Comores",
  CG: "Congo", CD: "RD Congo", CI: "Côte d'Ivoire", DJ: "Djibouti", EG: "Égypte",
  GQ: "Guinée équatoriale", ER: "Érythrée", SZ: "Eswatini", ET: "Éthiopie", GA: "Gabon",
  GM: "Gambie", GH: "Ghana", GN: "Guinée", GW: "Guinée-Bissau", KE: "Kenya", LS: "Lesotho",
  LR: "Liberia", LY: "Libye", MG: "Madagascar", MW: "Malawi", ML: "Mali", MR: "Mauritanie",
  MU: "Maurice", MA: "Maroc", MZ: "Mozambique", NA: "Namibie", NE: "Niger", NG: "Nigeria",
  RW: "Rwanda", ST: "Sao Tomé", SN: "Sénégal", SC: "Seychelles", SL: "Sierra Leone",
  SO: "Somalie", ZA: "Afrique du Sud", SS: "Soudan du Sud", SD: "Soudan", TZ: "Tanzanie",
  TG: "Togo", TN: "Tunisie", UG: "Ouganda", ZM: "Zambie", ZW: "Zimbabwe",
};

/**
 * Safely serialize data for embedding inside a <script> tag.
 * JSON.stringify alone is NOT safe — it doesn't escape </script>, <!--, etc.
 * These sequences can break out of the script context and enable XSS.
 */
function safeJsonForScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003C")
    .replace(/>/g, "\\u003E")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");

  if (!shopDomain) {
    return new Response("// Missing shop parameter", {
      status: 400,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  // Get shop configuration
  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: {
      name: true,
      whatsappNumber: true,
      whatsappMessage: true,
      widgetEnabled: true,
    },
  });

  if (!shop || !shop.widgetEnabled) {
    return new Response("// Widget disabled or shop not found", {
      status: 200,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  // Get agents that are visible in widget
  const agents = await prisma.deliveryAgent.findMany({
    where: {
      shop: { domain: shopDomain },
      isActive: true,
      showInWidget: true,
    },
    select: {
      name: true,
      phone: true,
      country: true,
      city: true,
      role: true,
    },
    orderBy: [{ country: "asc" }, { name: "asc" }],
  });

  // Group agents by country
  const agentsByCountry: Record<string, Array<{
    name: string;
    phone: string;
    city: string | null;
    role: string;
  }>> = {};

  for (const agent of agents) {
    if (!agentsByCountry[agent.country]) {
      agentsByCountry[agent.country] = [];
    }
    agentsByCountry[agent.country].push({
      name: agent.name,
      phone: agent.phone,
      city: agent.city,
      role: agent.role,
    });
  }

  // If no agents, show simple fallback widget
  if (Object.keys(agentsByCountry).length === 0 && shop.whatsappNumber) {
    return generateSimpleWidget(shop.name, shop.whatsappNumber, shop.whatsappMessage);
  }

  // Generate multi-step widget
  return generateMultiStepWidget(shop.name, agentsByCountry, shop.whatsappNumber, shop.whatsappMessage);
}

/**
 * Generate simple widget (fallback when no agents configured)
 * SECURE VERSION - Uses DOM APIs instead of innerHTML
 */
function generateSimpleWidget(shopName: string, phoneNumber: string, defaultMessage: string | null) {
  const message = defaultMessage || "Bonjour, j'ai une question.";
  
  const script = `
(function() {
  'use strict';
  
  try {
    var shopName = ${safeJsonForScript(shopName)};
    var phoneNumber = ${safeJsonForScript(phoneNumber)};
    var defaultMessage = ${safeJsonForScript(message)};
    
    // Validate phone number format (international, digits only)
    if (!/^\\d{6,15}$/.test(phoneNumber)) {
      console.error('[WhatsApp Widget] Invalid phone number format');
      return;
    }
    
    // Prevent duplicate widgets
    if (document.getElementById('wa-widget')) {
      console.warn('[WhatsApp Widget] Widget already exists, skipping initialization');
      return;
    }
    
    // Wait for DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWidget);
    } else {
      initWidget();
    }
    
    function initWidget() {
      // Inject styles with safe-area support for mobile
      var style = document.createElement('style');
      style.textContent = [
        '#wa-widget {',
        '  position: fixed;',
        '  bottom: calc(20px + env(safe-area-inset-bottom, 0px));',
        '  right: calc(20px + env(safe-area-inset-right, 0px));',
        '  z-index: 99999;',
        '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
        '}',
        '#wa-btn {',
        '  width: 60px;',
        '  height: 60px;',
        '  border-radius: 50%;',
        '  background: #25D366;',
        '  border: none;',
        '  cursor: pointer;',
        '  display: flex;',
        '  align-items: center;',
        '  justify-content: center;',
        '  box-shadow: 0 4px 12px rgba(0,0,0,0.15);',
        '  transition: transform 0.2s, box-shadow 0.2s;',
        '  outline: none;',
        '}',
        '#wa-btn:hover, #wa-btn:focus {',
        '  transform: scale(1.1);',
        '  box-shadow: 0 6px 16px rgba(0,0,0,0.2);',
        '}',
        '#wa-btn:focus-visible {',
        '  outline: 3px solid #128C7E;',
        '  outline-offset: 2px;',
        '}'
      ].join('\\n');
      document.head.appendChild(style);
      
      // Create widget container using DOM APIs (SECURE - no innerHTML)
      var widget = document.createElement('div');
      widget.id = 'wa-widget';
      
      // Create link element
      var link = document.createElement('a');
      link.id = 'wa-btn';
      link.href = 'https://wa.me/' + encodeURIComponent(phoneNumber) + '?text=';
      link.target = '_blank';
      link.rel = 'noopener noreferrer'; // SECURITY: Prevent tabnabbing
      link.setAttribute('aria-label', 'Contactez-nous sur WhatsApp');
      
      // Create SVG icon
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '32');
      svg.setAttribute('height', '32');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'white');
      svg.setAttribute('aria-hidden', 'true');
      
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z');
      
      svg.appendChild(path);
      link.appendChild(svg);
      widget.appendChild(link);
      
      // Add click handler for dynamic message
      link.addEventListener('click', function(e) {
        var currentPage = window.location.href;
        var fullMessage = 'Bonjour, je vous contacte depuis ' + shopName + ' (' + currentPage + '). ' + defaultMessage;
        this.href = 'https://wa.me/' + phoneNumber + '?text=' + encodeURIComponent(fullMessage);
      });
      
      document.body.appendChild(widget);
      console.log('[WhatsApp Widget] Initialized successfully');
    }
  } catch (error) {
    console.error('[WhatsApp Widget] Initialization failed:', error);
  }
})();
  `.trim();

  return new Response(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300",
      // [m2] CORS * is intentional — this script is loaded cross-origin by merchant storefronts
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Generate multi-step widget with country selection
 * SECURE VERSION - Uses DOM APIs instead of innerHTML
 */
function generateMultiStepWidget(
  shopName: string,
  agentsByCountry: Record<string, Array<{ name: string; phone: string; city: string | null; role: string }>>,
  fallbackNumber: string | null,
  defaultMessage: string | null
) {
  // Build countries data for JS
  const countriesData: Array<{
    code: string;
    name: string;
    emoji: string;
    agents: Array<{ name: string; phone: string; city: string | null; roleLabel: string }>;
  }> = [];

  for (const [code, agents] of Object.entries(agentsByCountry)) {
    countriesData.push({
      code,
      name: COUNTRY_NAMES[code] || code,
      emoji: COUNTRY_FLAGS[code] || "🌍",
      agents: agents.map((a) => ({
        name: a.name,
        phone: a.phone,
        city: a.city,
        roleLabel: a.role === "SUPPORT" ? "Service Client" : a.role === "BOTH" ? "Les deux" : "Livreur",
      })),
    });
  }

  const countriesJson = safeJsonForScript(countriesData);
  const fallbackJson = safeJsonForScript(fallbackNumber);
  const messageJson = safeJsonForScript(defaultMessage || "Bonjour, j'ai une question.");
  const shopNameJson = safeJsonForScript(shopName);

  const script = `
(function() {
  'use strict';
  
  try {
    // Configuration
    var shopName = ${shopNameJson};
    var countries = ${countriesJson};
    var fallbackNumber = ${fallbackJson};
    var defaultMessage = ${messageJson};
    
    // Validate phone numbers
    function isValidPhone(phone) {
      return /^\\d{6,15}$/.test(phone);
    }
    
    // Warn about invalid phone numbers in data
    for (var i = 0; i < countries.length; i++) {
      for (var j = 0; j < countries[i].agents.length; j++) {
        if (!isValidPhone(countries[i].agents[j].phone)) {
          console.error('[WhatsApp Widget] Invalid phone number for agent:', countries[i].agents[j].name);
        }
      }
    }
    
    // Prevent duplicate widgets
    if (document.getElementById('wa-widget')) {
      console.warn('[WhatsApp Widget] Widget already exists, skipping');
      return;
    }
    
    // [M1] Wait for DOM ready before initializing
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWidget);
    } else {
      initWidget();
    }
    
    function initWidget() {
      // State
      var currentView = 'button';
      var selectedCountry = null;
      var outsideClickHandler = null; // [M2] stored ref for cleanup
      
      // Flag image CDN base URL
      var FLAG_CDN = 'https://flagcdn.com/w40/';
      
      // Inject styles with safe-area support
      var style = document.createElement('style');
      style.textContent = [
        '#wa-widget { position: fixed; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); right: calc(20px + env(safe-area-inset-right, 0px)); z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
        '#wa-btn { width: 60px; height: 60px; border-radius: 50%; background: #25D366; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s, box-shadow 0.2s; outline: none; }',
        '#wa-btn:hover, #wa-btn:focus { transform: scale(1.1); box-shadow: 0 6px 16px rgba(0,0,0,0.2); }',
        '#wa-btn:focus-visible { outline: 3px solid #128C7E; outline-offset: 2px; }',
        '#wa-panel { position: absolute; bottom: 70px; right: 0; width: 300px; max-height: 400px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); display: none; flex-direction: column; overflow: hidden; }',
        '#wa-panel.open { display: flex; }',
        '#wa-header { padding: 12px 16px; background: #25D366; color: white; display: flex; align-items: center; justify-content: space-between; }',
        '#wa-header h3 { margin: 0; font-size: 16px; font-weight: 600; }',
        '#wa-close, #wa-back { background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 4px; outline: none; }',
        '#wa-close:hover, #wa-back:hover, #wa-close:focus, #wa-back:focus { background: rgba(255,255,255,0.2); }',
        '#wa-close:focus-visible, #wa-back:focus-visible { outline: 2px solid white; outline-offset: 2px; }',
        '#wa-back { font-size: 18px; padding: 0 8px 0 0; display: none; }',
        '#wa-content { flex: 1; overflow-y: auto; padding: 8px 0; }',
        '.wa-country { padding: 10px 16px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.15s; border: none; background: none; width: 100%; text-align: left; font-family: inherit; font-size: inherit; color: inherit; }',
        '.wa-country:hover, .wa-country:focus { background: #f5f5f5; }',
        '.wa-country:focus-visible { outline: 2px solid #25D366; outline-offset: -2px; }',
        '.wa-country-flag { width: 28px; height: 20px; object-fit: cover; border-radius: 2px; flex-shrink: 0; }',
        '.wa-country-flag-fallback { width: 28px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #666; background: #f0f0f0; border-radius: 2px; flex-shrink: 0; }',
        '.wa-country-name { flex: 1; font-size: 14px; }',
        '.wa-country-count { font-size: 12px; color: #888; }',
        '.wa-contact { padding: 10px 16px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.15s; border-bottom: 1px solid #eee; border-left: none; border-right: none; border-top: none; background: none; width: 100%; text-align: left; font-family: inherit; font-size: inherit; color: inherit; }',
        '.wa-contact:hover, .wa-contact:focus { background: #f5f5f5; }',
        '.wa-contact:focus-visible { outline: 2px solid #25D366; outline-offset: -2px; }',
        '.wa-contact-info { flex: 1; }',
        '.wa-contact-name { font-size: 14px; font-weight: 500; }',
        '.wa-contact-details { font-size: 12px; color: #888; display: flex; gap: 8px; margin-top: 2px; align-items: center; }',
        '.wa-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #e3f2fd; color: #1976d2; }',
        '.wa-badge.courier { background: #fff3e0; color: #f57c00; }',
        '.wa-badge.both { background: #e8f5e9; color: #388e3c; }',
        '.wa-empty { padding: 20px; text-align: center; color: #888; font-size: 14px; }'
      ].join('\\n');
      document.head.appendChild(style);
      
      // === Build widget DOM (SECURE - no innerHTML) ===
      var widget = document.createElement('div');
      widget.id = 'wa-widget';
      widget.setAttribute('role', 'region');
      widget.setAttribute('aria-label', 'WhatsApp Contact Widget');
      
      // Main button
      var btn = document.createElement('button');
      btn.id = 'wa-btn';
      btn.setAttribute('aria-label', 'Contactez-nous sur WhatsApp');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'wa-panel');
      
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '32');
      svg.setAttribute('height', '32');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'white');
      svg.setAttribute('aria-hidden', 'true');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z');
      svg.appendChild(path);
      btn.appendChild(svg);
      widget.appendChild(btn);
      
      // Panel
      var panel = document.createElement('div');
      panel.id = 'wa-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'S\\u00e9lection du contact WhatsApp');
      
      // Header
      var header = document.createElement('div');
      header.id = 'wa-header';
      
      var backBtn = document.createElement('button');
      backBtn.id = 'wa-back';
      backBtn.setAttribute('aria-label', 'Retour');
      backBtn.textContent = '\\u2190';
      
      var title = document.createElement('h3');
      title.textContent = 'WhatsApp';
      
      var closeBtn = document.createElement('button');
      closeBtn.id = 'wa-close';
      closeBtn.setAttribute('aria-label', 'Fermer');
      closeBtn.textContent = '\\u2715';
      
      header.appendChild(backBtn);
      header.appendChild(title);
      header.appendChild(closeBtn);
      panel.appendChild(header);
      
      var content = document.createElement('div');
      content.id = 'wa-content';
      content.setAttribute('role', 'list');
      panel.appendChild(content);
      
      widget.appendChild(panel);
      document.body.appendChild(widget);
      
      // === Event handlers ===
      btn.addEventListener('click', function() {
        if (panel.classList.contains('open')) {
          closePanel();
        } else {
          openPanel();
        }
      });
      
      closeBtn.addEventListener('click', closePanel);
      backBtn.addEventListener('click', showCountries);
      
      // [m3] Escape key on the entire widget, not just the button
      widget.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          closePanel();
        }
      });
      
      // [M2] Click outside — store ref for potential cleanup
      // Uses composedPath() because clearChildren() removes clicked elements from DOM
      // before this handler runs, causing widget.contains(e.target) to return false
      outsideClickHandler = function(e) {
        var isInside = false;
        if (e.composedPath) {
          var evtPath = e.composedPath();
          for (var k = 0; k < evtPath.length; k++) {
            if (evtPath[k] === widget) { isInside = true; break; }
          }
        } else {
          isInside = widget.contains(e.target);
        }
        if (!isInside) {
          closePanel();
        }
      };
      document.addEventListener('click', outsideClickHandler);
      
      // === Helper: clear all children (no innerHTML) [M3] ===
      function clearChildren(el) {
        while (el.firstChild) {
          el.removeChild(el.firstChild);
        }
      }
      
      // === Helper: create flag image with fallback ===
      function createFlag(code, countryName) {
        var flag = document.createElement('img');
        flag.className = 'wa-country-flag';
        flag.src = FLAG_CDN + code.toLowerCase() + '.png';
        flag.alt = countryName;
        flag.width = 28;
        flag.height = 20;
        flag.loading = 'lazy';
        flag.onerror = function() {
          var fallback = document.createElement('span');
          fallback.className = 'wa-country-flag-fallback';
          fallback.textContent = code;
          if (this.parentNode) {
            this.parentNode.replaceChild(fallback, this);
          }
        };
        return flag;
      }
      
      // === Panel logic ===
      function openPanel() {
        panel.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        if (countries.length === 1) {
          showContacts(countries[0]);
        } else {
          showCountries();
        }
      }
      
      function closePanel() {
        panel.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        currentView = 'button';
        selectedCountry = null;
        btn.focus();
      }
      
      function showCountries() {
        currentView = 'countries';
        backBtn.style.display = 'none';
        clearChildren(content);
        
        if (countries.length === 0) {
          var empty = document.createElement('div');
          empty.className = 'wa-empty';
          empty.textContent = 'Aucun pays disponible';
          content.appendChild(empty);
          return;
        }
        
        for (var i = 0; i < countries.length; i++) {
          (function(c) {
            var countryBtn = document.createElement('button');
            countryBtn.className = 'wa-country';
            countryBtn.setAttribute('role', 'listitem');
            
            var flag = createFlag(c.code, c.name);
            
            var name = document.createElement('span');
            name.className = 'wa-country-name';
            name.textContent = c.name;
            
            var count = document.createElement('span');
            count.className = 'wa-country-count';
            count.textContent = c.agents.length + ' contact' + (c.agents.length > 1 ? 's' : '');
            
            countryBtn.appendChild(flag);
            countryBtn.appendChild(name);
            countryBtn.appendChild(count);
            
            countryBtn.addEventListener('click', function() {
              showContacts(c);
            });
            
            content.appendChild(countryBtn);
          })(countries[i]);
        }
      }
      
      function showContacts(country) {
        currentView = 'contacts';
        selectedCountry = country;
        backBtn.style.display = 'block';
        clearChildren(content);
        
        var agents = country.agents;
        
        if (agents.length === 0 && !fallbackNumber) {
          var empty = document.createElement('div');
          empty.className = 'wa-empty';
          empty.textContent = 'Aucun contact pour ce pays';
          content.appendChild(empty);
          return;
        }
        
        for (var i = 0; i < agents.length; i++) {
          (function(a) {
            var contactBtn = document.createElement('button');
            contactBtn.className = 'wa-contact';
            contactBtn.setAttribute('role', 'listitem');
            
            var info = document.createElement('div');
            info.className = 'wa-contact-info';
            
            var nameEl = document.createElement('div');
            nameEl.className = 'wa-contact-name';
            nameEl.textContent = a.name;
            
            var details = document.createElement('div');
            details.className = 'wa-contact-details';
            
            if (a.city) {
              var citySpan = document.createElement('span');
              citySpan.textContent = a.city + ' \\u2022 ';
              details.appendChild(citySpan);
            }
            
            var badge = document.createElement('span');
            badge.className = 'wa-badge';
            if (a.roleLabel === 'Livreur') badge.classList.add('courier');
            if (a.roleLabel === 'Les deux') badge.classList.add('both');
            badge.textContent = a.roleLabel;
            details.appendChild(badge);
            
            info.appendChild(nameEl);
            info.appendChild(details);
            contactBtn.appendChild(info);
            
            contactBtn.addEventListener('click', function() {
              openWhatsApp(a.phone, a.name);
            });
            
            content.appendChild(contactBtn);
          })(agents[i]);
        }
        
        // Fallback contact if no agents
        if (agents.length === 0 && fallbackNumber) {
          var fallbackBtn = document.createElement('button');
          fallbackBtn.className = 'wa-contact';
          fallbackBtn.setAttribute('role', 'listitem');
          
          var fallbackInfo = document.createElement('div');
          fallbackInfo.className = 'wa-contact-info';
          
          var fallbackName = document.createElement('div');
          fallbackName.className = 'wa-contact-name';
          fallbackName.textContent = 'Contacter le support';
          
          var fallbackDetails = document.createElement('div');
          fallbackDetails.className = 'wa-contact-details';
          fallbackDetails.textContent = 'Num\\u00e9ro principal';
          
          fallbackInfo.appendChild(fallbackName);
          fallbackInfo.appendChild(fallbackDetails);
          fallbackBtn.appendChild(fallbackInfo);
          
          fallbackBtn.addEventListener('click', function() {
            openWhatsApp(fallbackNumber, 'Support');
          });
          
          content.appendChild(fallbackBtn);
        }
      }
      
      function openWhatsApp(phone, contactName) {
        if (!isValidPhone(phone)) {
          console.error('[WhatsApp Widget] Invalid phone number:', phone);
          return;
        }
        
        var currentPage = window.location.href;
        var fullMessage = 'Bonjour ' + (contactName || '') + ', je vous contacte depuis ' + shopName + ' (' + currentPage + '). ' + defaultMessage;
        var url = 'https://wa.me/' + encodeURIComponent(phone) + '?text=' + encodeURIComponent(fullMessage);
        
        // [C3] SECURITY: noopener,noreferrer prevents tabnabbing — no race condition
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      
      console.log('[WhatsApp Widget] Multi-step widget initialized successfully');
    }
  } catch (error) {
    console.error('[WhatsApp Widget] Initialization failed:', error);
  }
})();
  `.trim();

  return new Response(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300",
      // [m2] CORS * is intentional — this script is loaded cross-origin by merchant storefronts
      "Access-Control-Allow-Origin": "*",
    },
  });
}
