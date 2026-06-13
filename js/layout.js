/**
 * Chef by Birth – Shared layout (header, footer, cart shell)
 */
(function () {
  'use strict';

  const NAV = [
    { href: '/about.html', label: 'Our Story', page: 'about' },
    { href: '/menu.html', label: 'Menu', page: 'menu' },
    { href: '/how-it-works.html', label: 'How It Works', page: 'how-it-works' },
    { href: '/hours.html', label: 'Hours', page: 'hours' },
    { href: '/contact.html', label: 'Contact', page: 'contact' },
  ];

  const MORE_LINKS = [
    { href: '/kenkey.html', label: 'What is Kenkey?' },
    { href: '/gallery.html', label: 'Gallery' },
    { href: '/catering.html', label: 'Catering' },
    { href: '/reviews.html', label: 'Reviews' },
    { href: '/faq.html', label: 'FAQ' },
    { href: '/track.html', label: 'Track Order' },
  ];

  function currentPage() {
    return document.body.dataset.page || 'home';
  }

  function navLink(item, mobile) {
    const active = currentPage() === item.page;
    const cls = mobile
      ? `block text-white/90 py-2 px-3 rounded-lg hover:bg-white/10${active ? ' bg-white/10 text-accent font-semibold' : ''}`
      : `nav-link text-white/90 text-sm font-medium${active ? ' active text-accent' : ''}`;
    return `<li><a href="${item.href}" class="${cls}">${item.label}</a></li>`;
  }

  function renderHeader() {
    const page = currentPage();
    const isHome = page === 'home';
    const showCart = document.body.dataset.cart === 'true';
    const navDesktop = NAV.map((n) => navLink(n, false)).join('');
    const navMobile = NAV.map((n) => navLink(n, true)).join('')
      + MORE_LINKS.map((n) => `<li><a href="${n.href}" class="block text-white/90 py-2 px-3 rounded-lg hover:bg-white/10">${n.label}</a></li>`).join('');

    return `
    <header id="site-header" class="fixed top-0 left-0 right-0 z-50 bg-secondary/90 backdrop-blur-md shadow-lg transition-all">
      <nav class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="header-inner flex items-center justify-between h-16 md:h-20">
          <a href="/" class="flex items-center gap-2 group">
            <span class="text-accent text-2xl"><i class="fa-solid fa-bowl-food"></i></span>
            <span class="font-display font-bold text-white text-lg sm:text-xl">Chef by Birth</span>
          </a>
          <ul class="hidden md:flex items-center gap-6" role="list">${navDesktop}</ul>
          <div class="flex items-center gap-2 sm:gap-3">
            <a href="/order.html" class="hidden sm:inline-flex btn-primary bg-accent hover:bg-accent-dark text-secondary-dark font-semibold text-sm px-4 py-2 rounded-full items-center gap-1.5">
              <i class="fa-solid fa-bag-shopping"></i> Order Now
            </a>
            ${showCart ? `<button type="button" id="cart-toggle" class="relative text-white hover:text-accent transition-colors p-2" aria-label="Open cart">
              <i class="fa-solid fa-cart-shopping text-xl"></i>
              <span id="cart-count" class="hidden absolute -top-1 -right-1 bg-accent text-secondary-dark text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">0</span>
            </button>` : ''}
            <button id="mobile-menu-btn" type="button" class="md:hidden text-white p-2" aria-label="Menu"><i class="fa-solid fa-bars text-xl"></i></button>
          </div>
        </div>
        <div id="mobile-menu" class="md:hidden pb-0 overflow-hidden max-h-0 opacity-0 transition-all" aria-hidden="true">
          <ul class="flex flex-col gap-1 pb-4">${navMobile}
            <li><a href="/order.html" class="block text-secondary-dark bg-accent py-2.5 px-3 rounded-lg font-semibold text-center mt-2">Order Now</a></li>
          </ul>
        </div>
      </nav>
    </header>
    ${isHome ? '' : `<div class="ticker-wrap fixed top-16 md:top-20 left-0 right-0 z-40 py-2" aria-hidden="true"><div class="ticker-track">
      <span class="text-secondary-dark text-xs sm:text-sm font-semibold whitespace-nowrap px-8"><i class="fa-solid fa-fire mr-2"></i>Fresh kenkey fermented 3 days</span>
      <span class="text-secondary-dark text-xs sm:text-sm font-semibold whitespace-nowrap px-8"><i class="fa-solid fa-truck mr-2"></i>Free delivery on orders over $40</span>
      <span class="text-secondary-dark text-xs sm:text-sm font-semibold whitespace-nowrap px-8"><i class="fa-solid fa-pepper-hot mr-2"></i>Homemade shito — family recipe</span>
    </div></div>`}`;
  }

  function renderOverlays(showCart) {
    return `
    <div id="toast-container" class="fixed top-24 right-4 z-[100] flex flex-col gap-2 max-w-sm" aria-live="polite"></div>
    <div id="order-ready-banner" class="hidden fixed top-28 left-4 right-4 z-[90] bg-green-600 text-white text-center py-3 px-4 rounded-xl shadow-lg font-semibold text-sm sm:text-base">🎉 Your order is READY for pickup!</div>
    <div id="site-announcement" class="hidden fixed top-16 md:top-20 left-0 right-0 z-[45] bg-primary text-white text-center py-2.5 px-10 text-sm font-medium shadow-md">
      <span id="announcement-text"></span>
      <button type="button" id="announcement-dismiss" class="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-1" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>
    </div>
    ${showCart ? `
    <div id="cart-backdrop" class="fixed inset-0 bg-black/40 z-[70] backdrop-blur-sm" aria-hidden="true"></div>
    <aside id="cart-panel" class="fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-[80] transform translate-x-full transition-transform duration-300 flex flex-col" aria-label="Shopping cart">
      <div class="flex items-center justify-between p-5 border-b border-gray-100">
        <h2 class="font-display text-xl font-bold text-secondary">Your Cart</h2>
        <button type="button" id="cart-close" class="text-gray-400 hover:text-gray-600 p-2" aria-label="Close cart"><i class="fa-solid fa-xmark text-xl"></i></button>
      </div>
      <div id="cart-items" class="flex-1 overflow-y-auto px-5"><p class="text-gray-500 text-center py-8 text-sm">Your cart is empty</p></div>
      <div class="p-5 border-t border-gray-100 bg-cream/50 space-y-2">
        <div class="flex justify-between text-sm"><span>Subtotal</span><span id="cart-subtotal" class="font-semibold">$0.00</span></div>
        <div id="delivery-fee-row" class="hidden flex justify-between text-sm"><span>Delivery fee</span><span id="cart-delivery-fee" class="font-semibold">$5.00</span></div>
        <div class="flex justify-between font-display text-lg font-bold text-secondary pt-1 border-t border-gray-200"><span>Total</span><span id="cart-total">$0.00</span></div>
        <a href="/order.html" id="cart-checkout-btn" class="btn-primary block text-center bg-primary hover:bg-primary-dark text-white font-semibold py-3 rounded-full mt-3">Checkout</a>
      </div>
    </aside>` : ''}`;
  }

  function renderFooter() {
    const links = [
      ...NAV.map((n) => ({ href: n.href, label: n.label })),
      ...MORE_LINKS,
      { href: '/order.html', label: 'Order Online' },
    ];
    const quickLinks = links.map((l) => `<li><a href="${l.href}" class="hover:text-accent transition-colors">${l.label}</a></li>`).join('');
    return `
    <footer class="bg-secondary-dark text-white/70">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <p class="font-display font-bold text-white text-lg mb-3"><i class="fa-solid fa-bowl-food text-accent mr-2"></i>Chef by Birth</p>
            <p class="text-sm leading-relaxed">Authentic Ghanaian kenkey — fermented with tradition, served with love in Pennsylvania.</p>
          </div>
          <div>
            <p class="font-semibold text-white mb-3">Quick Links</p>
            <ul class="space-y-2 text-sm">${quickLinks}</ul>
          </div>
          <div>
            <p class="font-semibold text-white mb-3">Hours</p>
            <div id="footer-hours" class="text-sm space-y-1"></div>
          </div>
          <div>
            <p class="font-semibold text-white mb-3">Connect</p>
            <div class="flex gap-3 mb-3">
              <a id="footer-whatsapp" href="#" target="_blank" rel="noopener" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#25D366] transition-colors" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
              <a id="footer-instagram" href="#" target="_blank" rel="noopener" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
              <a id="footer-phone" href="#" class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-accent hover:text-secondary-dark transition-colors" aria-label="Phone"><i class="fa-solid fa-phone"></i></a>
            </div>
            <p id="footer-city" class="text-sm"></p>
          </div>
        </div>
        <div class="border-t border-white/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs">
          <p>&copy; 2025 Chef by Birth – Authentic Ghanaian Food in Pennsylvania</p>
          <a href="/admin" class="text-white/40 hover:text-accent">Admin</a>
        </div>
      </div>
    </footer>`;
  }

  function init() {
    const showCart = document.body.dataset.cart === 'true';
    const page = currentPage();
    const headerEl = document.getElementById('layout-header');
    const footerEl = document.getElementById('layout-footer');
    const overlaysEl = document.getElementById('layout-overlays');
    if (headerEl) headerEl.innerHTML = renderHeader();
    if (overlaysEl) overlaysEl.innerHTML = renderOverlays(showCart);
    if (footerEl && page !== 'home') footerEl.innerHTML = renderFooter();

    if (page !== 'home' && page !== 'order') {
      const float = document.createElement('a');
      float.href = '/order.html';
      float.id = 'floating-order-btn';
      float.className = 'floating-btn fixed bottom-6 right-6 z-40 bg-accent text-secondary-dark font-bold px-5 py-3.5 rounded-full shadow-lg flex items-center gap-2';
      float.innerHTML = '<i class="fa-solid fa-bag-shopping"></i><span class="hidden sm:inline">Order Now</span>';
      document.body.appendChild(float);
    }

    document.body.classList.toggle('page-home', page === 'home');
  }

  window.SiteLayout = { init, currentPage };
})();
