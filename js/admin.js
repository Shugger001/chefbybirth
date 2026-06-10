/**
 * Chef by Birth – Admin Dashboard
 */
(function () {
  'use strict';

  const C = window.CONFIG;
  let supabase = null;
  let orders = [];
  let menuItems = [];
  let settings = {};
  let ordersChannel = null;
  let currentOrderId = null;

  function initSupabase() {
    supabase = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  }

  // ─── Auth ────────────────────────────────────────────────────────
  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) showDashboard(session.user.email);
    else showLogin();
  }

  function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('dashboard-screen').classList.add('hidden');
  }

  function showDashboard(email) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    document.getElementById('admin-email').textContent = email;
    loadAll();
    subscribeOrders();
  }

  async function login(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.textContent = 'Signing in…';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    btn.disabled = false;
    btn.textContent = 'Sign In';

    if (error) {
      errEl.textContent = error.message;
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    showDashboard(data.user.email);
  }

  async function logout() {
    await supabase.auth.signOut();
    if (ordersChannel) supabase.removeChannel(ordersChannel);
    showLogin();
  }

  // ─── Data Loading ────────────────────────────────────────────────
  async function loadAll() {
    await Promise.all([loadOrders(), loadMenu(), loadSettings(), loadAnalytics()]);
  }

  async function loadOrders() {
    const statusFilter = document.getElementById('order-status-filter')?.value || 'all';
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false });

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const dateFrom = document.getElementById('date-from')?.value;
    const dateTo = document.getElementById('date-to')?.value;
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

    const { data, error } = await query;
    if (error) { toast('Failed to load orders', 'error'); console.error(error); return; }

    orders = data || [];
    // Pending first
    orders.sort((a, b) => {
      const priority = { pending: 0, confirmed: 1, ready: 2, completed: 3, cancelled: 4 };
      if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
      return new Date(b.created_at) - new Date(a.created_at);
    });
    renderOrders();
  }

  async function loadMenu() {
    const { data, error } = await supabase.from('menu_items').select('*').order('category').order('name');
    if (error) { toast('Failed to load menu', 'error'); return; }
    menuItems = data || [];
    renderMenuAdmin();
  }

  async function loadSettings() {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) return;
    settings = {};
    (data || []).forEach((r) => { settings[r.key] = r.value; });
    renderSettingsForm();
  }

  async function loadAnalytics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: todayOrders } = await supabase
      .from('orders')
      .select('total_amount, order_items')
      .gte('created_at', today.toISOString())
      .neq('status', 'cancelled');

    const { data: weekOrders } = await supabase
      .from('orders')
      .select('total_amount, order_items')
      .gte('created_at', weekAgo.toISOString())
      .neq('status', 'cancelled');

    const todayCount = todayOrders?.length || 0;
    const weekRevenue = (weekOrders || []).reduce((s, o) => s + Number(o.total_amount), 0);

    // Most popular item (all time recent 100)
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('order_items')
      .neq('status', 'cancelled')
      .limit(100);

    const itemCounts = {};
    (recentOrders || []).forEach((o) => {
      (o.order_items || []).forEach((item) => {
        itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 1);
      });
    });
    const popular = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];

    document.getElementById('stat-today-orders').textContent = todayCount;
    document.getElementById('stat-week-revenue').textContent = '$' + weekRevenue.toFixed(2);
    document.getElementById('stat-popular-item').textContent = popular ? `${popular[0]} (${popular[1]})` : '—';
  }

  // ─── Render Orders ───────────────────────────────────────────────
  function renderOrders() {
    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">No orders found</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map((o) => {
      const shortId = o.id.slice(0, 8).toUpperCase();
      const pickup = new Date(o.pickup_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      const statusColors = {
        pending: 'bg-yellow-100 text-yellow-800',
        confirmed: 'bg-blue-100 text-blue-800',
        ready: 'bg-green-100 text-green-800',
        completed: 'bg-gray-100 text-gray-600',
        cancelled: 'bg-red-100 text-red-800',
      };
      return `<tr class="order-row hover:bg-cream/50 cursor-pointer border-b border-gray-100" data-id="${o.id}">
        <td class="px-4 py-3 font-mono text-sm font-semibold text-primary">#${shortId}</td>
        <td class="px-4 py-3">${esc(o.customer_name)}</td>
        <td class="px-4 py-3 text-sm">${esc(o.phone)}</td>
        <td class="px-4 py-3 text-sm capitalize">${o.order_type}</td>
        <td class="px-4 py-3 font-semibold">$${Number(o.total_amount).toFixed(2)}</td>
        <td class="px-4 py-3 text-sm">${pickup}</td>
        <td class="px-4 py-3">
          <span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold ${statusColors[o.status] || ''}">${o.status}</span>
          ${o.whatsapp_sent ? '<i class="fa-brands fa-whatsapp text-green-500 ml-1" title="WhatsApp sent"></i>' : ''}
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.order-row').forEach((row) => {
      row.addEventListener('click', () => openOrderDetail(row.dataset.id));
    });
  }

  function openOrderDetail(orderId) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    currentOrderId = orderId;

    const modal = document.getElementById('order-modal');
    document.getElementById('modal-order-id').textContent = '#' + order.id.slice(0, 8).toUpperCase();
    document.getElementById('modal-customer').textContent = order.customer_name;
    document.getElementById('modal-phone').textContent = order.phone;
    document.getElementById('modal-email').textContent = order.email || '—';
    document.getElementById('modal-type').textContent = order.order_type;
    document.getElementById('modal-address').textContent = order.delivery_address || '—';
    document.getElementById('modal-total').textContent = '$' + Number(order.total_amount).toFixed(2);
    document.getElementById('modal-pickup').textContent = new Date(order.pickup_date).toLocaleString();
    document.getElementById('modal-instructions').textContent = order.special_instructions || '—';
    document.getElementById('modal-items').textContent = JSON.stringify(order.order_items, null, 2);
    document.getElementById('modal-status').value = order.status;
    document.getElementById('modal-whatsapp').checked = order.whatsapp_sent;

    modal.classList.remove('hidden');
  }

  async function updateOrderFromModal() {
    if (!currentOrderId) return;
    const status = document.getElementById('modal-status').value;
    const whatsappSent = document.getElementById('modal-whatsapp').checked;

    const { error } = await supabase.from('orders').update({ status, whatsapp_sent: whatsappSent }).eq('id', currentOrderId);
    if (error) { toast('Update failed: ' + error.message, 'error'); return; }

    toast('Order updated', 'success');
    document.getElementById('order-modal').classList.add('hidden');
    await loadOrders();
    await loadAnalytics();
  }

  // ─── Menu Admin ──────────────────────────────────────────────────
  function renderMenuAdmin() {
    const tbody = document.getElementById('menu-tbody');
    if (!tbody) return;

    tbody.innerHTML = menuItems.map((item) => `
      <tr class="border-b border-gray-100">
        <td class="px-4 py-3 font-medium">${esc(item.name)}</td>
        <td class="px-4 py-3 text-sm capitalize text-gray-500">${item.category}</td>
        <td class="px-4 py-3 font-semibold text-primary">$${Number(item.price).toFixed(2)}</td>
        <td class="px-4 py-3">
          <button type="button" class="toggle-avail relative w-11 h-6 rounded-full transition-colors ${item.is_available ? 'bg-secondary' : 'bg-gray-300'}" data-id="${item.id}" aria-label="Toggle availability">
            <span class="absolute top-0.5 ${item.is_available ? 'left-5' : 'left-0.5'} w-5 h-5 bg-white rounded-full shadow transition-all"></span>
          </button>
        </td>
        <td class="px-4 py-3 text-sm">
          <button type="button" class="edit-menu-btn text-primary hover:underline mr-3" data-id="${item.id}">Edit</button>
          <button type="button" class="delete-menu-btn text-red-500 hover:underline" data-id="${item.id}">Delete</button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('.toggle-avail').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id, 10);
        const item = menuItems.find((m) => m.id === id);
        if (!item) return;
        const { error } = await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', id);
        if (error) toast('Toggle failed', 'error');
        else { toast('Availability updated', 'success'); loadMenu(); }
      });
    });

    tbody.querySelectorAll('.edit-menu-btn').forEach((btn) => {
      btn.addEventListener('click', () => openMenuForm(parseInt(btn.dataset.id, 10)));
    });

    tbody.querySelectorAll('.delete-menu-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this menu item?')) return;
        const { error } = await supabase.from('menu_items').delete().eq('id', parseInt(btn.dataset.id, 10));
        if (error) toast('Delete failed', 'error');
        else { toast('Item deleted', 'success'); loadMenu(); }
      });
    });
  }

  function openMenuForm(id) {
    const form = document.getElementById('menu-form');
    const modal = document.getElementById('menu-modal');
    form.reset();
    document.getElementById('menu-form-id').value = id || '';

    if (id) {
      const item = menuItems.find((m) => m.id === id);
      if (item) {
        document.getElementById('menu-form-name').value = item.name;
        document.getElementById('menu-form-desc').value = item.description || '';
        document.getElementById('menu-form-price').value = item.price;
        document.getElementById('menu-form-category').value = item.category;
        document.getElementById('menu-form-image').value = item.image_url || '';
        document.getElementById('menu-form-available').checked = item.is_available;
        document.getElementById('menu-modal-title').textContent = 'Edit Menu Item';
      }
    } else {
      document.getElementById('menu-modal-title').textContent = 'Add Menu Item';
    }
    modal.classList.remove('hidden');
  }

  async function saveMenuItem(e) {
    e.preventDefault();
    const id = document.getElementById('menu-form-id').value;
    const payload = {
      name: document.getElementById('menu-form-name').value.trim(),
      description: document.getElementById('menu-form-desc').value.trim(),
      price: parseFloat(document.getElementById('menu-form-price').value),
      category: document.getElementById('menu-form-category').value,
      image_url: document.getElementById('menu-form-image').value.trim() || null,
      is_available: document.getElementById('menu-form-available').checked,
    };

    let error;
    if (id) {
      ({ error } = await supabase.from('menu_items').update(payload).eq('id', parseInt(id, 10)));
    } else {
      ({ error } = await supabase.from('menu_items').insert(payload));
    }

    if (error) { toast('Save failed: ' + error.message, 'error'); return; }
    toast('Menu item saved', 'success');
    document.getElementById('menu-modal').classList.add('hidden');
    loadMenu();
  }

  // ─── Settings ────────────────────────────────────────────────────
  function renderSettingsForm() {
    document.getElementById('settings-hours').value = settings.business_hours || '';
    document.getElementById('settings-delivery-fee').value = settings.delivery_fee || '5.00';
    document.getElementById('settings-free-threshold').value = settings.free_delivery_threshold || '40.00';
    document.getElementById('settings-radius').value = settings.delivery_radius_miles || '20';
    document.getElementById('settings-phone').value = settings.business_phone || '';
    document.getElementById('settings-whatsapp').value = settings.business_whatsapp || '';
    document.getElementById('settings-email').value = settings.business_email || '';
    document.getElementById('settings-city').value = settings.business_city || '';
  }

  async function saveSettings(e) {
    e.preventDefault();
    const updates = [
      { key: 'business_hours', value: document.getElementById('settings-hours').value },
      { key: 'delivery_fee', value: document.getElementById('settings-delivery-fee').value },
      { key: 'free_delivery_threshold', value: document.getElementById('settings-free-threshold').value },
      { key: 'delivery_radius_miles', value: document.getElementById('settings-radius').value },
      { key: 'business_phone', value: document.getElementById('settings-phone').value },
      { key: 'business_whatsapp', value: document.getElementById('settings-whatsapp').value },
      { key: 'business_email', value: document.getElementById('settings-email').value },
      { key: 'business_city', value: document.getElementById('settings-city').value },
    ];

    for (const u of updates) {
      const { error } = await supabase.from('settings').upsert({ key: u.key, value: u.value }, { onConflict: 'key' });
      if (error) { toast('Settings save failed', 'error'); console.error(error); return; }
    }
    toast('Settings saved', 'success');
    loadSettings();
  }

  // ─── Realtime ────────────────────────────────────────────────────
  function subscribeOrders() {
    if (ordersChannel) return;
    ordersChannel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders();
        loadAnalytics();
        toast('Orders updated', 'info', 2000);
      })
      .subscribe();
  }

  // ─── Tabs ────────────────────────────────────────────────────────
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.tab)?.classList.remove('hidden');
      });
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  function toast(msg, type = 'info', ms = 3000) {
    const el = document.getElementById('admin-toast');
    const colors = { success: 'bg-secondary', error: 'bg-red-600', info: 'bg-primary' };
    el.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg ${colors[type]}`;
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), ms);
  }

  // ─── Boot ────────────────────────────────────────────────────────
  function init() {
    if (!C?.SUPABASE_URL || C.SUPABASE_URL.includes('YOUR_PROJECT')) {
      document.getElementById('login-error').textContent = 'Configure config.js first';
      document.getElementById('login-error').classList.remove('hidden');
      return;
    }

    initSupabase();
    initTabs();
    checkSession();

    document.getElementById('login-form')?.addEventListener('submit', login);
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.getElementById('order-status-filter')?.addEventListener('change', loadOrders);
    document.getElementById('date-from')?.addEventListener('change', loadOrders);
    document.getElementById('date-to')?.addEventListener('change', loadOrders);
    document.getElementById('refresh-orders')?.addEventListener('click', loadOrders);
    document.getElementById('save-order-btn')?.addEventListener('click', updateOrderFromModal);
    document.getElementById('close-order-modal')?.addEventListener('click', () => document.getElementById('order-modal').classList.add('hidden'));
    document.getElementById('add-menu-btn')?.addEventListener('click', () => openMenuForm(null));
    document.getElementById('menu-form')?.addEventListener('submit', saveMenuItem);
    document.getElementById('close-menu-modal')?.addEventListener('click', () => document.getElementById('menu-modal').classList.add('hidden'));
    document.getElementById('settings-form')?.addEventListener('submit', saveSettings);

    document.querySelectorAll('.close-modal').forEach((btn) => {
      btn.addEventListener('click', () => btn.closest('.modal')?.classList.add('hidden'));
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
