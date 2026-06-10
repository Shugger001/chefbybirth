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
    updateLiveStatus();
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
    renderMenu();
    renderCartMenuOptions();
  }

  function setMenuLoading(loading) {
    const el = document.getElementById('menu-loading');
    const grid = document.getElementById('menu-container');
    if (el) el.classList.toggle('hidden', !loading);
    if (grid) grid.classList.toggle('hidden', loading);
  }

  const CATEGORY_LABELS = { main: 'Main Plates', side: 'Extra Sides', drink: 'Drinks' };
  const CATEGORY_ICONS = { main: 'fa-plate-wheat', side: 'fa-plus', drink: 'fa-glass-water' };

  function renderMenu(filter = 'all') {
    const container = document.getElementById('menu-container');
    if (!container) return;

    const grouped = { main: [], side: [], drink: [] };
    menuItems.forEach((item) => {
      if (filter === 'all' || item.category === filter) grouped[item.category]?.push(item);
    });

    let html = '';
    ['main', 'side', 'drink'].forEach((cat) => {
      if (!grouped[cat].length) return;
      if (filter !== 'all' && filter !== cat) return;
      html += `<div class="menu-group mb-12" data-category="${cat}">
        <h3 class="font-display text-2xl font-bold text-secondary mb-6 flex items-center gap-2">
          <i class="fa-solid ${CATEGORY_ICONS[cat]} text-primary"></i> ${CATEGORY_LABELS[cat]}
        </h3>
        <div class="grid sm:grid-cols-2 ${cat === 'main' ? 'lg:grid-cols-2' : cat === 'side' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4 sm:gap-6">`;

      grouped[cat].forEach((item, i) => {
        const featured = item.name.includes('Classic Kenkey') ? ' featured' : '';
        const inCart = cart.find((c) => c.id === item.id);
        html += `<article class="menu-card${featured} bg-white rounded-2xl p-5 sm:p-6 shadow-md border border-primary/10 reveal revealed" data-id="${item.id}">
          ${item.image_url ? `<img src="${esc(item.image_url)}" alt="" class="w-full h-36 object-cover rounded-xl mb-4" loading="lazy">` : ''}
          <div class="flex justify-between items-start gap-3 mb-2">
            <h4 class="font-display text-lg font-bold text-secondary">${esc(item.name)}</h4>
            <span class="text-primary font-bold text-lg whitespace-nowrap">$${Number(item.price).toFixed(2)}</span>
          </div>
          ${featured ? '<span class="inline-block text-xs font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full mb-2">Most Popular</span>' : ''}
          <p class="text-gray-600 text-sm leading-relaxed mb-4">${esc(item.description || '')}</p>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full"><i class="fa-solid fa-circle text-[6px] mr-1"></i>Available</span>
            <button type="button" class="add-to-cart-btn btn-primary bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-1.5" data-id="${item.id}">
              <i class="fa-solid fa-cart-plus"></i> ${inCart ? 'Add More' : 'Add'}
            </button>
          </div>
        </article>`;
      });
      html += '</div></div>';
    });

    container.innerHTML = html || '<p class="text-center text-gray-500 py-12">No items available right now. Check back soon!</p>';
    bindAddToCartButtons();
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
    if (existing) existing.quantity += qty;
    else cart.push({ id: item.id, name: item.name, price: Number(item.price), quantity: qty, category: item.category });
    updateCartUI();
    showToast(`${item.name} added to cart`, 'success');
    document.getElementById('cart-panel')?.classList.remove('translate-x-full');
  }

  function removeFromCart(itemId) {
    cart = cart.filter((c) => c.id !== itemId);
    updateCartUI();
  }

  function setCartQty(itemId, qty) {
    const item = cart.find((c) => c.id === itemId);
    if (!item) return;
    if (qty <= 0) removeFromCart(itemId);
    else { item.quantity = qty; updateCartUI(); }
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

  function updateCartUI() {
    const countEl = document.getElementById('cart-count');
    const itemsEl = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalItems = cart.reduce((s, c) => s + c.quantity, 0);

    if (countEl) {
      countEl.textContent = totalItems;
      countEl.classList.toggle('hidden', totalItems === 0);
    }

    if (itemsEl) {
      if (!cart.length) {
        itemsEl.innerHTML = '<p class="text-gray-500 text-center py-8 text-sm">Your cart is empty</p>';
      } else {
        itemsEl.innerHTML = cart.map((c) => `
          <div class="flex items-center gap-3 py-3 border-b border-gray-100">
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
    if (totalEl) totalEl.textContent = '$' + getTotal(orderType).toFixed(2);

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
      statusEl.className = 'inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-full bg-red-50 text-red-700 text-sm font-semibold';
      if (dotEl) dotEl.className = 'w-2.5 h-2.5 rounded-full bg-red-400';
      if (textEl) textEl.textContent = 'Closed today — fermenting kenkey 🌽';
    } else if (check.ok) {
      statusEl.className = 'inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-full bg-green-50 text-green-800 text-sm font-semibold';
      if (dotEl) dotEl.className = 'w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse';
      if (textEl) textEl.textContent = 'Open now — order pickup or delivery!';
    } else {
      statusEl.className = 'inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-semibold';
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

    const hoursCheck = pickup ? isWithinBusinessHours(pickup) : { ok: true };
    if (!hoursCheck.ok) errors.push(hoursCheck.msg);

    showFormErrors(errors);
    if (errors.length) return;

    const orderItems = cart.map((c) => ({ id: c.id, name: c.name, price: c.price, quantity: c.quantity }));
    const total = getTotal(orderType);

    const btn = document.getElementById('submit-order-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Placing order…';

    const { data, error } = await supabase.rpc('create_order', {
      p_customer_name: name,
      p_phone: phone,
      p_email: email || '',
      p_order_type: orderType,
      p_delivery_address: orderType === 'delivery' ? address : '',
      p_order_items: orderItems,
      p_total_amount: total,
      p_pickup_date: new Date(pickup).toISOString(),
      p_special_instructions: instructions || '',
    });

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
    updateCartUI();
    document.getElementById('order-form').reset();
    toggleDeliveryFields();

    showOrderSuccess(orderId, trackingToken, name, phone, total, pickup, orderType, orderItems);
    subscribeOrderTracking(trackingToken);
    startOrderPolling(trackingToken);
    showToast('Order placed successfully!', 'success');
  }

  function showFormErrors(errors) {
    const box = document.getElementById('form-errors');
    const list = document.getElementById('error-list');
    if (!errors.length) { box?.classList.add('hidden'); return; }
    list.innerHTML = errors.map((e) => `<li>${esc(e)}</li>`).join('');
    box.classList.remove('hidden');
  }

  function showOrderSuccess(orderId, trackingToken, name, phone, total, pickup, orderType, items) {
    const panel = document.getElementById('order-success');
    const shortId = orderId.slice(0, 8).toUpperCase();
    document.getElementById('success-order-id').textContent = shortId;

    const pickupFmt = new Date(pickup).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

    let msg = `🍽️ *Order Confirmation – Chef by Birth*\n\n`;
    msg += `Order #${shortId}\n👤 ${name}\n📱 ${phone}\n`;
    msg += `${orderType === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}: ${pickupFmt}\n\n`;
    items.forEach((i) => { msg += `• ${i.quantity}x ${i.name}\n`; });
    msg += `\n💰 Total: $${total.toFixed(2)}\n\nThank you!`;

    const waNum = getSetting('business_whatsapp', C.BUSINESS_WHATSAPP);
    const waBtn = document.getElementById('whatsapp-confirm-btn');
    waBtn.href = `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`;

    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      document.getElementById('cart-panel')?.classList.toggle('translate-x-full');
    });
    document.getElementById('cart-close')?.addEventListener('click', () => {
      document.getElementById('cart-panel')?.classList.add('translate-x-full');
    });
  }

  function initScrollEffects() {
    const header = document.getElementById('site-header');
    const floatBtn = document.getElementById('floating-order-btn');
    window.addEventListener('scroll', () => {
      header?.classList.toggle('scrolled', window.scrollY > 60);
      const hero = document.getElementById('hero');
      if (floatBtn && hero) {
        floatBtn.classList.toggle('hidden-scroll', window.scrollY < hero.offsetHeight - 100);
      }
    }, { passive: true });

    document.querySelectorAll('.hero-enter').forEach((el, i) => {
      setTimeout(() => el.classList.add('loaded'), 100 + i * 120);
    });
  }

  // ─── Boot ────────────────────────────────────────────────────────
  async function init() {
    initMobileMenu();
    initCartToggle();
    initMenuFilters();
    initScrollEffects();
    toggleDeliveryFields();

    document.querySelectorAll('input[name="order-type"]').forEach((r) => {
      r.addEventListener('change', toggleDeliveryFields);
    });

    document.getElementById('order-form')?.addEventListener('submit', submitOrder);

    const pickupInput = document.getElementById('pickup-time');
    if (pickupInput) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      pickupInput.min = now.toISOString().slice(0, 16);
    }

    if (!initSupabase()) return;

    await Promise.all([loadSettings(), loadMenu()]);
    subscribeMenuRealtime();

    const saved = JSON.parse(localStorage.getItem('cbb_active_order') || 'null');
    if (saved?.tracking_token) {
      subscribeOrderTracking(saved.tracking_token);
      startOrderPolling(saved.tracking_token);
    }

    setInterval(updateLiveStatus, 60000);
  }

  document.addEventListener('DOMContentLoaded', init);
  window.ChefByBirth = { addToCart, cart, loadMenu, showToast };
})();
