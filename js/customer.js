/**
 * Chef by Birth – Customer Application
 * Requires: config.js, Supabase CDN, index.html DOM
 */
(function () {
  'use strict';

  const C = window.CONFIG;
  let supabase = null;
  let menuItems = [];
  let settings = {};
  let cart = [];
  let menuChannel = null;
  let trackingChannel = null;
  let menuFilter = 'all';
  let menuSearch = '';
  const CART_STORAGE_KEY = 'cbb_cart';
  const ANNOUNCEMENT_KEY = 'cbb_ann_dismiss';
  const DEFAULT_MENU_IMAGE = '/assets/hero-kenkey.png';

  // ─── Supabase Init ───────────────────────────────────────────────
  function initSupabase() {
    if (!C?.SUPABASE_URL || C.SUPABASE_URL.includes('YOUR_PROJECT')) {
      showToast('Configure config.js with your Supabase credentials', 'error');
      return false;
    }
    supabase = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
    return true;
  }

  // ─── Settings ────────────────────────────────────────────────────
  async function loadSettings() {
    if (!supabase) return;
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error) { console.error('Settings load error:', error); return; }
    settings = {};
    (data || []).forEach((row) => { settings[row.key] = row.value; });
    applySettingsUI();
  }

  function getSetting(key, fallback) {
    return settings[key] !== undefined ? settings[key] : fallback;
  }

  function parseBusinessHours() {
    try { return JSON.parse(getSetting('business_hours', '{}')); }
    catch { return {}; }
  }

  function applySettingsUI() {
    const city = getSetting('business_city', C.BUSINESS_CITY);
    const cityEl = document.getElementById('location-city');
    if (cityEl) cityEl.textContent = city;

    const phone = getSetting('business_phone', C.BUSINESS_PHONE_TEL);
    const phoneDisplay = phone.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    const phoneEl = document.getElementById('contact-phone');
    const phoneText = document.getElementById('contact-phone-text');
    if (phoneEl) phoneEl.href = 'tel:' + phone.replace(/\s/g, '');
    if (phoneText) phoneText.textContent = phoneDisplay || C.BUSINESS_PHONE;

    const wa = getSetting('business_whatsapp', C.BUSINESS_WHATSAPP);
    const waEl = document.getElementById('contact-whatsapp');
    if (waEl) waEl.href = 'https://wa.me/' + wa.replace(/\D/g, '');

    const igUrl = getSetting('instagram_url', 'https://instagram.com/' + C.BUSINESS_INSTAGRAM);
    const igHandle = getSetting('instagram_handle', C.BUSINESS_INSTAGRAM);
    ['contact-instagram', 'instagram-link'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.href = igUrl;
    });
    const igText = document.getElementById('contact-instagram-text');
    if (igText) igText.textContent = '@' + igHandle.replace(/^@/, '');

    // Announcement banner
    const ann = getSetting('site_announcement', '').trim();
    const annEl = document.getElementById('site-announcement');
    const annText = document.getElementById('announcement-text');
    if (annEl && annText && ann && !localStorage.getItem(ANNOUNCEMENT_KEY)) {
      annText.textContent = ann;
      annEl.classList.remove('hidden');
      document.body.classList.add('has-announcement');
    } else if (annEl) {
      annEl.classList.add('hidden');
      document.body.classList.remove('has-announcement');
    }

    // Map embed
    const mapQuery = getSetting('map_embed_query', '').trim();
    const mapWrap = document.getElementById('map-wrap');
    const mapEmbed = document.getElementById('map-embed');
    if (mapQuery && mapWrap && mapEmbed) {
      mapWrap.classList.remove('hidden');
      mapEmbed.src = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=10&output=embed`;
    } else if (mapWrap) {
      mapWrap.classList.add('hidden');
    }

    // Footer
    const footerCity = document.getElementById('footer-city');
    if (footerCity) footerCity.textContent = city;
    const footerWa = document.getElementById('footer-whatsapp');
    const footerIg = document.getElementById('footer-instagram');
    const footerPhone = document.getElementById('footer-phone');
    if (footerWa) footerWa.href = 'https://wa.me/' + wa.replace(/\D/g, '');
    if (footerIg) footerIg.href = igUrl;
    if (footerPhone) footerPhone.href = 'tel:' + phone.replace(/\s/g, '');
    const galleryIg = document.getElementById('gallery-instagram-link');
    if (galleryIg) galleryIg.href = igUrl;

    renderHoursTable();
    updateTicker();
    renderFeaturedSpecial();
    updateLiveStatus();
  }

  function renderHoursTable() {
    const hours = parseBusinessHours();
    const dayRows = [
      ['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'],
      ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday'],
    ];
    const fmtRow = (label, day) => {
      if (!day || day.closed) {
        const note = label === 'Monday' ? ' (fermenting)' : '';
        return `<div class="flex justify-between gap-4"><span>${label}</span><span class="text-red-600 font-semibold">Closed${note}</span></div>`;
      }
      return `<div class="flex justify-between gap-4"><span>${label}</span><span class="font-semibold text-secondary">${fmtTime(day.open)} – ${fmtTime(day.close)}</span></div>`;
    };
    const html = dayRows.map(([k, label]) => fmtRow(label, hours[k])).join('');
    const table = document.getElementById('hours-table');
    const footerHours = document.getElementById('footer-hours');
    if (table) table.innerHTML = html;
    if (footerHours) {
      footerHours.innerHTML = dayRows.map(([k, label]) => {
        const day = hours[k];
        const time = !day || day.closed ? 'Closed' : `${fmtTime(day.open)}–${fmtTime(day.close)}`;
        return `<p>${label}: ${time}</p>`;
      }).join('');
    }
  }

  function updateTicker() {
    try {
      const msgs = JSON.parse(getSetting('ticker_messages', '[]'));
      const track = document.querySelector('.ticker-track');
      if (!track || !msgs.length) return;
      const items = msgs.map((m) =>
        `<span class="text-secondary-dark text-xs sm:text-sm font-semibold whitespace-nowrap px-8">${esc(m)}</span>`
      ).join('');
      track.innerHTML = items + items;
    } catch { /* keep default ticker */ }
  }

  function renderFeaturedSpecial() {
    const wrap = document.getElementById('featured-special');
    if (!wrap || !menuItems.length) return;
    const id = parseInt(getSetting('featured_menu_item_id', ''), 10);
    const item = menuItems.find((m) => m.id === id);
    if (!item) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    document.getElementById('featured-name').textContent = item.name;
    document.getElementById('featured-desc').textContent = item.description || '';
    document.getElementById('featured-price').textContent = '$' + Number(item.price).toFixed(2);
    const btn = document.getElementById('featured-add-btn');
    if (btn) {
      btn.onclick = () => addToCart(item.id);
    }
  }

  function parseDeliveryZipPrefixes() {
    try { return JSON.parse(getSetting('delivery_zip_prefixes', '[]')); }
    catch { return []; }
  }

  function validateDeliveryZip(address) {
    const prefixes = parseDeliveryZipPrefixes();
    const match = address.match(/\b(\d{5})\b/);
    if (!match) return { ok: false, msg: 'Include a valid 5-digit ZIP code in your delivery address.' };
    if (!prefixes.length) return { ok: true };
    const zip = match[1];
    if (!prefixes.some((p) => zip.startsWith(String(p)))) {
      return { ok: false, msg: `Sorry, we don't deliver to ZIP ${zip}. We serve select Pennsylvania areas.` };
    }
    return { ok: true };
  }

  // ─── Menu ────────────────────────────────────────────────────────
  async function loadMenu() {
    if (!supabase) return;
    setMenuLoading(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('category')
      .order('name');

    setMenuLoading(false);
    if (error) { console.error('Menu load error:', error); showToast('Could not load menu', 'error'); return; }
    menuItems = data || [];
    pruneCart();
    renderMenu();
    renderFeaturedSpecial();
    renderCartMenuOptions();
  }

  function loadCartFromStorage() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
      cart = Array.isArray(saved) ? saved : [];
    } catch { cart = []; }
  }

  function saveCartToStorage() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }

  function pruneCart() {
    if (!menuItems.length) return;
    cart = cart.filter((c) => menuItems.some((m) => m.id === c.id));
    saveCartToStorage();
    updateCartUI();
  }

  function setMenuLoading(loading) {
    const el = document.getElementById('menu-loading');
    const grid = document.getElementById('menu-container');
    const noResults = document.getElementById('menu-no-results');
    if (el) el.classList.toggle('hidden', !loading);
    if (grid) grid.classList.toggle('hidden', loading);
    if (noResults) noResults.classList.add('hidden');
  }

  const MENU_CATEGORIES = ['kenkey', 'proteins', 'shito', 'drinks'];
  const CATEGORY_LABELS = { kenkey: 'Kenkey', proteins: 'Proteins', shito: 'Shito', drinks: 'Drinks' };
  const CATEGORY_ICONS = { kenkey: 'fa-bowl-food', proteins: 'fa-fish', shito: 'fa-pepper-hot', drinks: 'fa-glass-water' };
  const CATEGORY_GRID = { kenkey: 'lg:grid-cols-2', proteins: 'lg:grid-cols-3', shito: 'lg:grid-cols-3', drinks: 'lg:grid-cols-4' };

  function normalizeCategory(item) {
    const cat = item.category;
    const name = (item.name || '').toLowerCase();
    if (MENU_CATEGORIES.includes(cat)) return cat;
    if (cat === 'drink') return 'drinks';
    if (cat === 'main') return 'kenkey';
    if (cat === 'side') {
      if (name.includes('shito')) return 'shito';
      if (name.includes('kenkey')) return 'kenkey';
      return 'proteins';
    }
    return cat;
  }

  function renderMenu(filter = menuFilter) {
    menuFilter = filter;
    const container = document.getElementById('menu-container');
    const noResults = document.getElementById('menu-no-results');
    if (!container) return;

    const q = menuSearch.trim().toLowerCase();
    const grouped = Object.fromEntries(MENU_CATEGORIES.map((c) => [c, []]));
    menuItems.forEach((item) => {
      const cat = normalizeCategory(item);
      if (filter !== 'all' && cat !== filter) return;
      if (q && !item.name.toLowerCase().includes(q) && !(item.description || '').toLowerCase().includes(q)) return;
      grouped[cat]?.push(item);
    });

    const total = MENU_CATEGORIES.reduce((n, c) => n + grouped[c].length, 0);
    if (noResults) noResults.classList.toggle('hidden', total > 0 || !q);
    container.classList.toggle('hidden', total === 0);

    let html = '';
    MENU_CATEGORIES.forEach((cat) => {
      if (!grouped[cat].length) return;
      if (filter !== 'all' && filter !== cat) return;
      html += `<div class="menu-group mb-12" data-category="${cat}">
        <h3 class="font-display text-2xl font-bold text-secondary mb-6 flex items-center gap-2">
          <i class="fa-solid ${CATEGORY_ICONS[cat]} text-primary"></i> ${CATEGORY_LABELS[cat]}
        </h3>
        <div class="grid sm:grid-cols-2 ${CATEGORY_GRID[cat]} gap-4 sm:gap-6">`;

      grouped[cat].forEach((item, i) => {
        const featured = item.name.includes('Classic Kenkey') ? ' featured' : '';
        const inCart = cart.find((c) => c.id === item.id);
        const cartQty = inCart ? inCart.quantity : 0;
        const stock = item.stock;
        const stockNote = stock !== null && stock > 0
          ? (stock <= 10 ? `<span class="text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-1 rounded-full">Only ${stock} left</span>` : '')
          : '';
        const outOfStock = stock !== null && stock <= 0;
        const imgSrc = item.image_url || DEFAULT_MENU_IMAGE;
        html += `<article class="menu-card${featured} bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-primary/10 reveal menu-pop" style="animation-delay:${i * 0.07}s" data-id="${item.id}">
          <img src="${esc(imgSrc)}" alt="${esc(item.name)}" class="w-full h-36 object-cover rounded-xl mb-4" loading="lazy">
          <div class="flex justify-between items-start gap-3 mb-2">
            <h4 class="font-display text-lg font-bold text-secondary">${esc(item.name)}</h4>
            <span class="text-primary font-bold text-lg whitespace-nowrap">$${Number(item.price).toFixed(2)}</span>
          </div>
          ${featured ? '<span class="inline-block text-xs font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full mb-2">Most Popular</span>' : ''}
          <p class="text-gray-600 text-sm leading-relaxed mb-4">${esc(item.description || '')}</p>
          <div class="flex items-center justify-between gap-2 flex-wrap">
            ${outOfStock
              ? '<span class="text-xs font-semibold text-red-700 bg-red-50 px-2 py-1 rounded-full">Sold out</span>'
              : `<span class="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full"><i class="fa-solid fa-circle text-[6px] mr-1"></i>Available</span>${stockNote}`}
            <button type="button" class="add-to-cart-btn btn-primary bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed" data-id="${item.id}" ${outOfStock || (stock !== null && cartQty >= stock) ? 'disabled' : ''}>
              <i class="fa-solid fa-cart-plus"></i> ${inCart ? 'Add More' : 'Add'}
            </button>
          </div>
        </article>`;
      });
      html += '</div></div>';
    });

    container.innerHTML = html || '<p class="text-center text-gray-500 py-12">No items available right now. Check back soon!</p>';
    bindAddToCartButtons();
    observeRevealElements(container.querySelectorAll('.reveal'));
  }

  function bindAddToCartButtons() {
    document.querySelectorAll('.add-to-cart-btn').forEach((btn) => {
      btn.addEventListener('click', () => addToCart(parseInt(btn.dataset.id, 10)));
    });
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ─── Cart ────────────────────────────────────────────────────────
  function addToCart(itemId, qty = 1) {
    const item = menuItems.find((m) => m.id === itemId);
    if (!item) return;
    const existing = cart.find((c) => c.id === itemId);
    const newQty = (existing ? existing.quantity : 0) + qty;
    if (item.stock !== null && item.stock > 0 && newQty > item.stock) {
      showToast(`Only ${item.stock} available`, 'error');
      return;
    }
    if (existing) existing.quantity += qty;
    else cart.push({ id: item.id, name: item.name, price: Number(item.price), quantity: qty, category: item.category });
    saveCartToStorage();
    updateCartUI(true);
    showToast(`${item.name} added to cart`, 'success');
    openCart();
  }

  function openCart() {
    document.getElementById('cart-panel')?.classList.remove('translate-x-full');
    document.getElementById('cart-backdrop')?.classList.add('open');
  }

  function closeCart() {
    document.getElementById('cart-panel')?.classList.add('translate-x-full');
    document.getElementById('cart-backdrop')?.classList.remove('open');
  }

  function removeFromCart(itemId) {
    cart = cart.filter((c) => c.id !== itemId);
    saveCartToStorage();
    updateCartUI();
  }

  function setCartQty(itemId, qty) {
    const item = cart.find((c) => c.id === itemId);
    if (!item) return;
    const menuItem = menuItems.find((m) => m.id === itemId);
    if (menuItem?.stock !== null && menuItem.stock > 0 && qty > menuItem.stock) {
      showToast(`Only ${menuItem.stock} available`, 'error');
      return;
    }
    if (qty <= 0) removeFromCart(itemId);
    else { item.quantity = qty; saveCartToStorage(); updateCartUI(); }
  }

  function getSubtotal() {
    return cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
  }

  function getDeliveryFee(orderType) {
    if (orderType !== 'delivery') return 0;
    const sub = getSubtotal();
    const threshold = parseFloat(getSetting('free_delivery_threshold', C.FREE_DELIVERY_THRESHOLD));
    const fee = parseFloat(getSetting('delivery_fee', C.DELIVERY_FEE));
    return sub >= threshold ? 0 : fee;
  }

  function getTotal(orderType) {
    return getSubtotal() + getDeliveryFee(orderType);
  }

  function countKenkeyPieces() {
    let count = 0;
    cart.forEach((c) => {
      const name = c.name.toLowerCase();
      if (name.includes('kenkey')) {
        if (name.includes('extra kenkey') || name.includes('1 piece')) count += c.quantity;
        else count += c.quantity * 2; // main plates include 2 kenkey
      }
    });
    return count;
  }

  let lastCartTotal = 0;

  function updateCartUI(bumpBadge) {
    const countEl = document.getElementById('cart-count');
    const itemsEl = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalItems = cart.reduce((s, c) => s + c.quantity, 0);

    if (countEl) {
      countEl.textContent = totalItems;
      countEl.classList.toggle('hidden', totalItems === 0);
      if (bumpBadge && totalItems > 0) {
        countEl.classList.remove('cart-bump');
        void countEl.offsetWidth;
        countEl.classList.add('cart-bump');
      }
    }

    if (itemsEl) {
      if (!cart.length) {
        itemsEl.innerHTML = '<p class="text-gray-500 text-center py-8 text-sm">Your cart is empty</p>';
      } else {
        itemsEl.innerHTML = cart.map((c, i) => `
          <div class="cart-item-enter flex items-center gap-3 py-3 border-b border-gray-100" style="animation-delay:${i * 0.05}s">
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm text-secondary truncate">${esc(c.name)}</p>
              <p class="text-primary text-sm font-semibold">$${(c.price * c.quantity).toFixed(2)}</p>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" class="cart-qty-btn w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-bold" data-id="${c.id}" data-delta="-1">−</button>
              <span class="w-6 text-center text-sm font-semibold">${c.quantity}</span>
              <button type="button" class="cart-qty-btn w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-bold" data-id="${c.id}" data-delta="1">+</button>
            </div>
            <button type="button" class="cart-remove text-red-400 hover:text-red-600 ml-1" data-id="${c.id}" aria-label="Remove"><i class="fa-solid fa-trash-can text-sm"></i></button>
          </div>`).join('');
        itemsEl.querySelectorAll('.cart-qty-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id, 10);
            const delta = parseInt(btn.dataset.delta, 10);
            const item = cart.find((c) => c.id === id);
            if (item) setCartQty(id, item.quantity + delta);
          });
        });
        itemsEl.querySelectorAll('.cart-remove').forEach((btn) => {
          btn.addEventListener('click', () => removeFromCart(parseInt(btn.dataset.id, 10)));
        });
      }
    }

    const orderType = document.querySelector('input[name="order-type"]:checked')?.value || 'pickup';
    if (subtotalEl) subtotalEl.textContent = '$' + getSubtotal().toFixed(2);
    const deliveryRow = document.getElementById('delivery-fee-row');
    const deliveryEl = document.getElementById('cart-delivery-fee');
    const totalEl = document.getElementById('cart-total');
    const fee = getDeliveryFee(orderType);
    if (deliveryRow) deliveryRow.classList.toggle('hidden', orderType !== 'delivery');
    if (deliveryEl) deliveryEl.textContent = fee === 0 ? 'FREE' : '$' + fee.toFixed(2);
    const newTotal = getTotal(orderType);
    if (totalEl) {
      totalEl.textContent = '$' + newTotal.toFixed(2);
      if (newTotal !== lastCartTotal && lastCartTotal !== 0) {
        totalEl.classList.remove('order-total-bump');
        void totalEl.offsetWidth;
        totalEl.classList.add('order-total-bump');
      }
      lastCartTotal = newTotal;
    }

    // Kenkey warning
    const kenkeyCount = countKenkeyPieces();
    const warnEl = document.getElementById('kenkey-warning');
    if (warnEl) warnEl.classList.toggle('hidden', kenkeyCount < C.KENKEY_LARGE_ORDER_MIN);
  }

  function renderCartMenuOptions() {
    // Cart uses live menuItems – no separate render needed
  }

  // ─── Business Hours ──────────────────────────────────────────────
  function isWithinBusinessHours(pickupDate) {
    const hours = parseBusinessHours();
    const d = new Date(pickupDate);
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dayKey = days[d.getDay()];
    const day = hours[dayKey];
    if (!day || day.closed) return { ok: false, msg: `We're closed on ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}s.` };

    const [oh, om] = day.open.split(':').map(Number);
    const [ch, cm] = day.close.split(':').map(Number);
    const mins = d.getHours() * 60 + d.getMinutes();
    const openMins = oh * 60 + om;
    const closeMins = ch * 60 + cm;

    if (mins < openMins || mins >= closeMins) {
      return { ok: false, msg: `Pickup must be during business hours (${day.open} – ${day.close}).` };
    }
    return { ok: true };
  }

  function updateLiveStatus() {
    const now = new Date();
    const fakePickup = now;
    const check = isWithinBusinessHours(fakePickup);
    const statusEl = document.getElementById('live-status');
    const dotEl = document.getElementById('status-dot');
    const textEl = document.getElementById('status-text');
    if (!statusEl) return;

    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dayKey = days[now.getDay()];
    const hours = parseBusinessHours();
    const day = hours[dayKey];

    if (day?.closed) {
      statusEl.className = 'inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-red-50 text-red-700 text-sm font-semibold';
      if (dotEl) dotEl.className = 'w-2.5 h-2.5 rounded-full bg-red-400';
      if (textEl) textEl.textContent = 'Closed today — fermenting kenkey 🌽';
    } else if (check.ok) {
      statusEl.className = 'inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-green-50 text-green-800 text-sm font-semibold status-open';
      if (dotEl) dotEl.className = 'w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse';
      if (textEl) textEl.textContent = 'Open now — order pickup or delivery!';
    } else {
      statusEl.className = 'inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-semibold';
      if (dotEl) dotEl.className = 'w-2.5 h-2.5 rounded-full bg-gray-400';
      if (textEl) textEl.textContent = day ? `Opens at ${fmtTime(day.open)}` : 'Check hours below';
    }
  }

  function fmtTime(t) {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2,'0')}${ampm}`;
  }

  // ─── Order Submit ────────────────────────────────────────────────
  async function submitOrder(e) {
    e.preventDefault();
    if (!supabase) { showToast('Database not configured', 'error'); return; }

    const name = document.getElementById('full-name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const pickup = document.getElementById('pickup-time').value;
    const instructions = document.getElementById('instructions').value.trim();
    const orderType = document.querySelector('input[name="order-type"]:checked')?.value || 'pickup';
    const address = document.getElementById('delivery-address')?.value.trim() || '';

    const errors = [];
    if (!name) errors.push('Full name is required');
    if (!phone || phone.replace(/\D/g,'').length < 10) errors.push('Valid phone number is required');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email');
    if (!cart.length) errors.push('Your cart is empty — add menu items first');
    if (!pickup) errors.push('Pickup/delivery date & time is required');
    if (new Date(pickup) <= new Date()) errors.push('Date must be in the future');
    if (orderType === 'delivery' && !address) errors.push('Delivery address is required');
    if (orderType === 'delivery' && address) {
      const zipCheck = validateDeliveryZip(address);
      if (!zipCheck.ok) errors.push(zipCheck.msg);
    }

    const spiceLevel = document.querySelector('input[name="spice-level"]:checked')?.value || 'medium';

    const hoursCheck = pickup ? isWithinBusinessHours(pickup) : { ok: true };
    if (!hoursCheck.ok) errors.push(hoursCheck.msg);

    showFormErrors(errors);
    if (errors.length) return;

    const orderItems = cart.map((c) => ({ id: c.id, name: c.name, price: c.price, quantity: c.quantity }));
    const total = getTotal(orderType);

    const btn = document.getElementById('submit-order-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Placing order…';

    const rpcPayload = {
      p_customer_name: name,
      p_phone: phone,
      p_email: email || '',
      p_order_type: orderType,
      p_delivery_address: orderType === 'delivery' ? address : '',
      p_order_items: orderItems,
      p_total_amount: total,
      p_pickup_date: new Date(pickup).toISOString(),
      p_special_instructions: instructions || '',
      p_spice_level: spiceLevel,
    };

    let { data, error } = await supabase.rpc('create_order', rpcPayload);

    if (error && /spice|argument|function/i.test(error.message)) {
      delete rpcPayload.p_spice_level;
      ({ data, error } = await supabase.rpc('create_order', rpcPayload));
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Place Order';

    if (error) {
      console.error('Order insert error:', error);
      showToast('Order failed: ' + error.message, 'error');
      return;
    }

    const orderRow = Array.isArray(data) ? data[0] : data;
    const orderId = orderRow?.order_id;
    const trackingToken = orderRow?.tracking_token;

    if (!orderId || !trackingToken) {
      showToast('Order placed but confirmation unavailable. Contact us.', 'error');
      return;
    }

    localStorage.setItem('cbb_active_order', JSON.stringify({
      id: orderId,
      tracking_token: trackingToken,
    }));

    cart = [];
    saveCartToStorage();
    updateCartUI();
    document.getElementById('order-form').reset();
    toggleDeliveryFields();

    showOrderSuccess(orderId, trackingToken, name, phone, total, pickup, orderType, orderItems, spiceLevel);
    showTrackingPanel(orderId, trackingToken, 'pending');
    subscribeOrderTracking(trackingToken);
    startOrderPolling(trackingToken);
    showToast('Order placed successfully!', 'success');
  }

  const TRACK_STEPS = ['pending', 'confirmed', 'ready', 'completed'];
  const TRACK_LABELS = {
    pending: 'Your order was received — we will confirm shortly.',
    confirmed: 'Confirmed! Our kitchen is preparing your order.',
    ready: 'Your order is ready for pickup or delivery!',
    completed: 'Order complete — thank you and enjoy!',
    cancelled: 'This order was cancelled. Contact us if you have questions.',
  };

  function showTrackingPanel(orderId, trackingToken, status) {
    const empty = document.getElementById('tracking-empty');
    const panel = document.getElementById('tracking-panel');
    const idEl = document.getElementById('tracking-order-id');
    if (!panel) return;
    empty?.classList.add('hidden');
    panel.classList.remove('hidden');
    if (idEl) idEl.textContent = '#' + orderId.slice(0, 8).toUpperCase();
    updateTrackingUI(status || 'pending');
    if (trackingToken) {
      localStorage.setItem('cbb_active_order', JSON.stringify({ id: orderId, tracking_token: trackingToken }));
    }
  }

  function updateTrackingUI(status) {
    const steps = document.querySelectorAll('.tracking-step');
    const msgEl = document.getElementById('tracking-status-msg');
    const currentIdx = TRACK_STEPS.indexOf(status);

    steps.forEach((step) => {
      const stepName = step.dataset.step;
      const idx = TRACK_STEPS.indexOf(stepName);
      step.classList.remove('active', 'done');
      if (status === 'cancelled') {
        step.classList.toggle('done', idx < 0);
      } else if (idx < currentIdx) {
        step.classList.add('done');
      } else if (idx === currentIdx) {
        step.classList.add('active');
      }
    });

    if (msgEl) {
      msgEl.textContent = TRACK_LABELS[status] || 'Tracking your order…';
      msgEl.className = 'text-center mt-6 text-sm font-semibold ' +
        (status === 'ready' ? 'text-green-700' : status === 'cancelled' ? 'text-red-600' : 'text-secondary');
    }
  }

  function showFormErrors(errors) {
    const box = document.getElementById('form-errors');
    const list = document.getElementById('error-list');
    if (!errors.length) { box?.classList.add('hidden'); return; }
    list.innerHTML = errors.map((e) => `<li>${esc(e)}</li>`).join('');
    box.classList.remove('hidden');
  }

  function showOrderSuccess(orderId, trackingToken, name, phone, total, pickup, orderType, items, spiceLevel) {
    const panel = document.getElementById('order-success');
    const shortId = orderId.slice(0, 8).toUpperCase();
    document.getElementById('success-order-id').textContent = shortId;

    const pickupFmt = new Date(pickup).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    let msg = `🍽️ *Order Confirmation – Chef by Birth*\n\n`;
    msg += `Order #${shortId}\n👤 ${name}\n📱 ${phone}\n`;
    msg += `${orderType === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}: ${pickupFmt}\n`;
    msg += `🌶️ Spice: ${spiceLevel || 'medium'}\n\n`;
    items.forEach((i) => { msg += `• ${i.quantity}x ${i.name}\n`; });
    msg += `\n💰 Total: $${total.toFixed(2)}\n\nThank you!`;

    const waNum = getSetting('business_whatsapp', C.BUSINESS_WHATSAPP);
    const waBtn = document.getElementById('whatsapp-confirm-btn');
    const waUrl = `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`;
    waBtn.href = waUrl;

    panel.classList.remove('hidden');
    panel.classList.remove('success-pop');
    void panel.offsetWidth;
    panel.classList.add('success-pop');
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
      showToast('Opening WhatsApp to confirm your order…', 'info', 3000);
      window.open(waUrl, '_blank', 'noopener');
    }, 2000);
  }

  // ─── Realtime ────────────────────────────────────────────────────
  function subscribeMenuRealtime() {
    if (!supabase || menuChannel) return;
    menuChannel = supabase
      .channel('menu-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => loadMenu())
      .subscribe();
  }

  function handleOrderStatusUpdate(status) {
    updateTrackingUI(status);
    if (status === 'ready') {
      showToast('🎉 Your order is READY for pickup!', 'success', 8000);
      const banner = document.getElementById('order-ready-banner');
      if (banner) { banner.classList.remove('hidden'); banner.classList.add('animate-pulse'); }
    } else if (status === 'confirmed') {
      showToast('✅ Your order has been confirmed!', 'success');
    } else if (status === 'cancelled') {
      showToast('Your order was cancelled. Please contact us.', 'error');
    }
  }

  function subscribeOrderTracking(trackingToken) {
    if (!supabase) return;
    const stored = trackingToken || JSON.parse(localStorage.getItem('cbb_active_order') || '{}').tracking_token;
    if (!stored) return;

    if (trackingChannel) supabase.removeChannel(trackingChannel);

    trackingChannel = supabase
      .channel('order-track-' + stored)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'order_tracking',
        filter: `tracking_token=eq.${stored}`,
      }, (payload) => {
        handleOrderStatusUpdate(payload.new?.status);
      })
      .subscribe();

    fetchAndShowTracking(stored);
  }

  async function fetchAndShowTracking(token) {
    if (!supabase || !token) return;
    const { data, error } = await supabase.rpc('get_order_status', { p_tracking_token: token });
    if (error || !data?.length) return;
    const row = data[0];
    showTrackingPanel(row.order_id, token, row.status);
  }

  let pollInterval = null;
  function startOrderPolling(trackingToken) {
    if (pollInterval) clearInterval(pollInterval);
    const token = trackingToken || JSON.parse(localStorage.getItem('cbb_active_order') || '{}').tracking_token;
    if (!token) return;

    let lastStatus = null;
    pollInterval = setInterval(async () => {
      const { data, error } = await supabase.rpc('get_order_status', { p_tracking_token: token });
      if (error || !data?.length) return;
      const status = data[0].status;
      if (status !== lastStatus) {
        if (lastStatus !== null) handleOrderStatusUpdate(status);
        else updateTrackingUI(status);
        lastStatus = status;
      }
      if (status === 'completed' || status === 'cancelled') clearInterval(pollInterval);
    }, 20000);
  }

  // ─── UI Helpers ──────────────────────────────────────────────────
  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = {
      success: 'bg-secondary text-white',
      error: 'bg-red-600 text-white',
      info: 'bg-primary text-white',
    };
    toast.className = `toast-item ${colors[type] || colors.info} px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transform translate-y-4 opacity-0 transition-all duration-300`;
    toast.innerHTML = `<span>${esc(message)}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-4', 'opacity-0'));
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function toggleDeliveryFields() {
    const isDelivery = document.querySelector('input[name="order-type"]:checked')?.value === 'delivery';
    document.getElementById('delivery-address-wrap')?.classList.toggle('hidden', !isDelivery);
    updateCartUI();
  }

  function initMenuFilters() {
    document.querySelectorAll('.menu-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-filter-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        renderMenu(btn.dataset.filter);
      });
    });
  }

  function initMenuSearch() {
    const input = document.getElementById('menu-search');
    if (!input) return;
    input.addEventListener('input', () => {
      menuSearch = input.value;
      renderMenu(menuFilter);
    });
  }

  function initAnnouncement() {
    document.getElementById('announcement-dismiss')?.addEventListener('click', () => {
      localStorage.setItem(ANNOUNCEMENT_KEY, '1');
      document.getElementById('site-announcement')?.classList.add('hidden');
      document.body.classList.remove('has-announcement');
    });
  }

  function initCateringForm() {
    document.getElementById('catering-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('catering-name').value.trim();
      const phone = document.getElementById('catering-phone').value.trim();
      const date = document.getElementById('catering-date').value;
      const guests = document.getElementById('catering-guests').value;
      const details = document.getElementById('catering-details').value.trim();
      const dateFmt = date ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : date;
      let msg = `🍽️ *Catering Inquiry – Chef by Birth*\n\n`;
      msg += `👤 ${name}\n📱 ${phone}\n📅 ${dateFmt}\n👥 ${guests} guests\n`;
      if (details) msg += `\n${details}\n`;
      msg += `\nPlease confirm availability and pricing. Thank you!`;
      const waNum = getSetting('business_whatsapp', C.BUSINESS_WHATSAPP);
      window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
      showToast('Opening WhatsApp for your catering inquiry…', 'success');
    });
    const dateInput = document.getElementById('catering-date');
    if (dateInput) {
      const min = new Date();
      min.setDate(min.getDate() + 2);
      dateInput.min = min.toISOString().slice(0, 10);
    }
  }

  function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-hidden', String(!open));
    });
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }));
  }

  function initCartToggle() {
    document.getElementById('cart-toggle')?.addEventListener('click', () => {
      const panel = document.getElementById('cart-panel');
      if (panel?.classList.contains('translate-x-full')) openCart();
      else closeCart();
    });
    document.getElementById('cart-close')?.addEventListener('click', closeCart);
    document.getElementById('cart-backdrop')?.addEventListener('click', closeCart);
    document.getElementById('cart-checkout-btn')?.addEventListener('click', () => closeCart());
  }

  // ─── Scroll reveal & parallax ────────────────────────────────────
  let revealObserver = null;

  function observeRevealElements(elements) {
    if (!revealObserver) return;
    elements.forEach((el) => {
      if (!el.classList.contains('revealed')) revealObserver.observe(el);
    });
  }

  function initRevealObserver() {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

    observeRevealElements(document.querySelectorAll('.reveal'));

    const howSection = document.getElementById('how-it-works');
    if (howSection) {
      const stepsObs = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          document.getElementById('steps-fill')?.classList.add('animate');
          stepsObs.disconnect();
        }
      }, { threshold: 0.3 });
      stepsObs.observe(howSection);
    }
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const id = anchor.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        const headerH = document.getElementById('site-header')?.offsetHeight || 80;
        window.scrollTo({ top: target.offsetTop - headerH - 8, behavior: 'smooth' });
      });
    });
  }

  function initScrollEffects() {
    const header = document.getElementById('site-header');
    const heroImg = document.querySelector('.hero-bg-image');
    const hero = document.getElementById('hero');
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      header?.classList.toggle('scrolled', scrollY > 60);
      if (heroImg && hero && !prefersReduced && scrollY < hero.offsetHeight) {
        heroImg.style.transform = `scale(1.1) translateY(${scrollY * 0.32}px)`;
      }
    }, { passive: true });

    document.querySelectorAll('.hero-enter').forEach((el, i) => {
      setTimeout(() => el.classList.add('loaded'), 80 + i * 100);
    });
  }

  function getPage() {
    return document.body.dataset.page || 'home';
  }

  // ─── Boot ────────────────────────────────────────────────────────
  async function init() {
    const page = getPage();

    loadCartFromStorage();
    updateCartUI();
    initMobileMenu();
    if (document.body.dataset.cart === 'true') initCartToggle();
    initAnnouncement();
    initRevealObserver();

    if (page === 'home') initScrollEffects();
    else initSmoothScroll();

    if (document.getElementById('menu-container') || document.getElementById('menu-loading')) {
      initMenuFilters();
      initMenuSearch();
    }

    if (document.getElementById('catering-form')) initCateringForm();

    const orderForm = document.getElementById('order-form');
    if (orderForm) {
      toggleDeliveryFields();
      document.querySelectorAll('input[name="order-type"]').forEach((r) => {
        r.addEventListener('change', toggleDeliveryFields);
      });
      orderForm.addEventListener('submit', submitOrder);
      const pickupInput = document.getElementById('pickup-time');
      if (pickupInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        pickupInput.min = now.toISOString().slice(0, 16);
      }
    }

    document.getElementById('track-token-btn')?.addEventListener('click', () => {
      const token = document.getElementById('track-token-input')?.value.trim();
      if (!token) { showToast('Enter a tracking token', 'error'); return; }
      localStorage.setItem('cbb_active_order', JSON.stringify({ tracking_token: token }));
      subscribeOrderTracking(token);
      startOrderPolling(token);
      fetchAndShowTracking(token);
    });

    if (!initSupabase()) return;

    await loadSettings();

    if (page === 'menu') {
      await loadMenu();
      subscribeMenuRealtime();
    }

    if (page === 'order' || page === 'track') {
      const saved = JSON.parse(localStorage.getItem('cbb_active_order') || 'null');
      if (saved?.tracking_token) {
        subscribeOrderTracking(saved.tracking_token);
        startOrderPolling(saved.tracking_token);
        fetchAndShowTracking(saved.tracking_token);
      }
    }

    if (document.getElementById('live-status')) {
      updateLiveStatus();
      setInterval(updateLiveStatus, 60000);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  window.ChefByBirth = { addToCart, cart, loadMenu, showToast };
})();
