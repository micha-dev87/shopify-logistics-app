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
 */
function generateSimpleWidget(shopName: string, phoneNumber: string, defaultMessage: string | null) {
  const message = defaultMessage || "Bonjour, j'ai une question.";
  
  // CSS styles as array to avoid nested template literal issues
  const cssStyles = [
    "#wa-widget { position: fixed; bottom: 20px; right: 20px; z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }",
    "#wa-btn { width: 60px; height: 60px; border-radius: 50%; background: #25D366; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s; }",
    "#wa-btn:hover { transform: scale(1.1); }",
  ].join(" ");

  const script = `
(function() {
  var shopName = ${JSON.stringify(shopName)};
  var phoneNumber = "${phoneNumber}";
  var defaultMessage = ${JSON.stringify(message)};
  
  if (document.getElementById('wa-widget')) return;
  
  var style = document.createElement('style');
  style.textContent = ${JSON.stringify(cssStyles)};
  document.head.appendChild(style);
  
  var widget = document.createElement('div');
  widget.id = 'wa-widget';
  widget.innerHTML = '<a id="wa-btn" href="https://wa.me/' + phoneNumber + '?text=" target="_blank"><svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>';
  
  var btn = widget.querySelector('#wa-btn');
  btn.addEventListener('click', function(e) {
    var currentPage = window.location.href;
    var fullMessage = 'Bonjour, je vous contacte depuis ' + shopName + ' (' + currentPage + '). ' + defaultMessage;
    this.href = 'https://wa.me/' + phoneNumber + '?text=' + encodeURIComponent(fullMessage);
  });
  
  document.body.appendChild(widget);
})();
  `.trim();

  return new Response(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Generate multi-step widget with country selection
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

  const countriesJson = JSON.stringify(countriesData);
  const fallbackJson = JSON.stringify(fallbackNumber);
  const messageJson = JSON.stringify(defaultMessage || "Bonjour, j'ai une question.");
  const shopNameJson = JSON.stringify(shopName);

  // CSS styles as array to avoid nested template literal issues with esbuild
  const multiStepCss = [
    "#wa-widget { position: fixed; bottom: 20px; right: 20px; z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }",
    "#wa-btn { width: 60px; height: 60px; border-radius: 50%; background: #25D366; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s, opacity 0.2s; }",
    "#wa-btn:hover { transform: scale(1.1); }",
    "#wa-panel { position: absolute; bottom: 70px; right: 0; width: 300px; max-height: 400px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); display: none; flex-direction: column; overflow: hidden; }",
    "#wa-panel.open { display: flex; }",
    "#wa-header { padding: 12px 16px; background: #25D366; color: white; display: flex; align-items: center; justify-content: space-between; }",
    "#wa-header h3 { margin: 0; font-size: 16px; font-weight: 600; }",
    "#wa-close { background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0 4px; }",
    "#wa-back { background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0 8px 0 0; display: none; }",
    "#wa-content { flex: 1; overflow-y: auto; padding: 8px 0; }",
    ".wa-country { padding: 10px 16px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.15s; }",
    ".wa-country:hover { background: #f5f5f5; }",
    ".wa-country-emoji { font-size: 24px; }",
    ".wa-country-name { flex: 1; font-size: 14px; }",
    ".wa-country-count { font-size: 12px; color: #888; }",
    ".wa-contact { padding: 10px 16px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.15s; border-bottom: 1px solid #eee; }",
    ".wa-contact:hover { background: #f5f5f5; }",
    ".wa-contact-info { flex: 1; }",
    ".wa-contact-name { font-size: 14px; font-weight: 500; }",
    ".wa-contact-details { font-size: 12px; color: #888; display: flex; gap: 8px; margin-top: 2px; }",
    ".wa-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #e3f2fd; color: #1976d2; }",
    ".wa-badge.courier { background: #fff3e0; color: #f57c00; }",
    ".wa-badge.both { background: #e8f5e9; color: #388e3c; }",
    ".wa-empty { padding: 20px; text-align: center; color: #888; font-size: 14px; }",
  ].join(" ");

  const widgetHtml = '<button id="wa-btn" aria-label="Contact us on WhatsApp"><svg width="32" height="32" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></button><div id="wa-panel"><div id="wa-header"><button id="wa-back" aria-label="Back">←</button><h3>WhatsApp</h3><button id="wa-close" aria-label="Close">✕</button></div><div id="wa-content"></div></div>';

  const script = `
(function() {
  // Configuration
  var shopName = ${shopNameJson};
  var countries = ${countriesJson};
  var fallbackNumber = ${fallbackJson};
  var defaultMessage = ${messageJson};
  
  // Don't duplicate
  if (document.getElementById('wa-widget')) return;
  
  // State
  var currentView = 'button'; // 'button' | 'countries' | 'contacts'
  var selectedCountry = null;
  
  // Styles
  var style = document.createElement('style');
  style.textContent = ${JSON.stringify(multiStepCss)};
  document.head.appendChild(style);
  
  // Create widget
  var widget = document.createElement('div');
  widget.id = 'wa-widget';
  widget.innerHTML = ${JSON.stringify(widgetHtml)};
  
  document.body.appendChild(widget);
  
  // Elements
  var btn = widget.querySelector('#wa-btn');
  var panel = widget.querySelector('#wa-panel');
  var content = widget.querySelector('#wa-content');
  var closeBtn = widget.querySelector('#wa-close');
  var backBtn = widget.querySelector('#wa-back');
  
  // Event handlers
  btn.addEventListener('click', function() {
    if (panel.classList.contains('open')) {
      closePanel();
    } else {
      openPanel();
    }
  });
  
  closeBtn.addEventListener('click', closePanel);
  backBtn.addEventListener('click', showCountries);
  
  // Click outside to close
  document.addEventListener('click', function(e) {
    if (!widget.contains(e.target)) {
      closePanel();
    }
  });
  
  function openPanel() {
    panel.classList.add('open');
    if (countries.length === 1) {
      // Skip country selection if only one
      showContacts(countries[0]);
    } else {
      showCountries();
    }
  }
  
  function closePanel() {
    panel.classList.remove('open');
    currentView = 'button';
    selectedCountry = null;
  }
  
  function showCountries() {
    currentView = 'countries';
    backBtn.style.display = 'none';
    
    var html = '';
    for (var i = 0; i < countries.length; i++) {
      var c = countries[i];
      html += '<div class="wa-country" data-code="' + c.code + '">' +
        '<span class="wa-country-emoji">' + c.emoji + '</span>' +
        '<span class="wa-country-name">' + c.name + '</span>' +
        '<span class="wa-country-count">' + c.agents.length + ' contact' + (c.agents.length > 1 ? 's' : '') + '</span>' +
        '</div>';
    }
    
    if (!html) {
      html = '<div class="wa-empty">Aucun pays disponible</div>';
    }
    
    content.innerHTML = html;
    
    // Add click handlers
    var countryEls = content.querySelectorAll('.wa-country');
    for (var i = 0; i < countryEls.length; i++) {
      countryEls[i].addEventListener('click', function() {
        var code = this.getAttribute('data-code');
        var country = countries.find(function(c) { return c.code === code; });
        if (country) showContacts(country);
      });
    }
  }
  
  function showContacts(country) {
    currentView = 'contacts';
    selectedCountry = country;
    backBtn.style.display = 'block';
    
    var html = '';
    for (var i = 0; i < country.agents.length; i++) {
      var a = country.agents[i];
      var badgeClass = a.roleLabel === 'Livreur' ? 'courier' : a.roleLabel === 'Les deux' ? 'both' : '';
      html += '<div class="wa-contact" data-phone="' + a.phone + '" data-name="' + a.name + '">' +
        '<div class="wa-contact-info">' +
        '<div class="wa-contact-name">' + a.name + '</div>' +
        '<div class="wa-contact-details">' +
        (a.city ? a.city + ' • ' : '') +
        '<span class="wa-badge ' + badgeClass + '">' + a.roleLabel + '</span>' +
        '</div></div></div>';
    }
    
    if (!html) {
      if (fallbackNumber) {
        html = '<div class="wa-contact" data-phone="' + fallbackNumber + '" data-name="Support">' +
          '<div class="wa-contact-info">' +
          '<div class="wa-contact-name">Contacter le support</div>' +
          '<div class="wa-contact-details">Numéro principal</div>' +
          '</div></div>';
      } else {
        html = '<div class="wa-empty">Aucun contact pour ce pays</div>';
      }
    }
    
    content.innerHTML = html;
    
    // Add click handlers
    var contactEls = content.querySelectorAll('.wa-contact');
    for (var i = 0; i < contactEls.length; i++) {
      contactEls[i].addEventListener('click', function() {
        var phone = this.getAttribute('data-phone');
        var name = this.getAttribute('data-name');
        openWhatsApp(phone, name);
      });
    }
  }
  
  function openWhatsApp(phone, contactName) {
    var currentPage = window.location.href;
    var fullMessage = 'Bonjour ' + (contactName || '') + ', je vous contacte depuis ' + shopName + ' (' + currentPage + '). ' + defaultMessage;
    var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(fullMessage);
    window.open(url, '_blank');
  }
})();
  `.trim();

  return new Response(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
