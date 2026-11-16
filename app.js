'use strict';

// 1. SUPABASE CONNECTION
const SUPABASE_URL = 'https://cocsqaesrydolbimdqcy.supabase.co'; // Must NOT end with /rest/v1/
const SUPABASE_ANON_KEY = 'sb_publishable_ibMXXEnxh8_-Z75wir_EkQ_eBzndObG';

let supabaseClient = null;
if (window.supabase && SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// 2. INITIAL FALLBACK DATA (used only when Supabase is unreachable)
let listingsData = [
  {
    id: 'bk-1', title: 'Concepts of Physics (Vol 1 & 2)', author: 'H.C. Verma', isbn: '978-8177091878',
    campus: 'School • Class 11', category: 'Core Textbooks', condition: 'Mint', mrp: 980, price: 588,
    delivery_mode: 'Same City Pickup', seller_name: 'Aarav Mehta', seller_phone: '9876543210',
    seller_city: 'New Delhi', seller_pincode: '110016',
    seller_address: 'H-24, Green Park Extension, Near Metro Gate 2',
    buyer_name: null, buyer_phone: null, buyer_pincode: null, buyer_address: null,
    status: 'Available', handoff_pin: null, rating: null, feedback_note: null
  },
  {
    id: 'bk-2', title: 'Objective Mathematics Class 11', author: 'R.D. Sharma', isbn: '978-9352533459',
    campus: 'School • Class 11', category: 'Reference & Guides', condition: 'Highlighted', mrp: 1150, price: 518,
    delivery_mode: 'Same City Local Drop', seller_name: 'Riya Sharma', seller_phone: '9811122233',
    seller_city: 'New Delhi', seller_pincode: '110085',
    seller_address: 'Flat 302, Shanti Apartments, Sector 14, Rohini',
    buyer_name: null, buyer_phone: null, buyer_pincode: null, buyer_address: null,
    status: 'Available', handoff_pin: null, rating: null, feedback_note: null
  },
  {
    id: 'bk-3', title: 'Full Class 11 PCM Allen + NCERT Bundle (10 Books)', author: 'NCERT & Allen Kota', isbn: '978-8174506351',
    campus: 'School • Class 11', category: 'Full-Year Bundles', condition: 'Mint', mrp: 2400, price: 1200,
    delivery_mode: 'Same City Pickup', seller_name: 'Kabir Verma', seller_phone: '9988776655',
    seller_city: 'Kota', seller_pincode: '324005',
    seller_address: 'B-12, Talwandi Main Road, Near Commerce College',
    buyer_name: 'Rohan Gupta', buyer_phone: '9123456789', buyer_pincode: '324001',
    buyer_address: 'Hostel 4, Landmark City, Kota',
    status: 'Reserved', handoff_pin: '4829', rating: null, feedback_note: null
  },
  {
    id: 'bk-4', title: 'Introduction to Algorithms (CLRS 4th Ed)', author: 'Cormen, Leiserson', isbn: '978-0262046305',
    campus: 'College • Sem 3', category: 'Core Textbooks', condition: 'Highlighted', mrp: 1450, price: 653,
    delivery_mode: 'Same City Local Drop', seller_name: 'Devika Nair', seller_phone: '9765432109',
    seller_city: 'Bengaluru', seller_pincode: '560034',
    seller_address: '1st Block Koramangala, Near Sony World Signal',
    buyer_name: null, buyer_phone: null, buyer_pincode: null, buyer_address: null,
    status: 'Available', handoff_pin: null, rating: null, feedback_note: null
  }
];

let activeCategory = 'ALL';
let selectedCondition = 'Mint';
let selectedMultiplier = 0.60;
let currentStarRating = 5;
let lastFocusedEl = null;

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);

// Escape user-supplied text before putting it in innerHTML (prevents script injection)
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Stored value stays "Highlighted" (matches existing rows); screen shows "Marked"
const conditionLabel = (c) => (c === 'Highlighted' ? 'Marked' : c);
const isMobile = (v) => /^[6-9]\d{9}$/.test(v);
const isPincode = (v) => /^[1-9]\d{5}$/.test(v);
const priceText = (n) => (n === 0 ? 'FREE' : '₹' + n);

let toastTimer;
function toast(message, type = 'info') {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.className = 'toast show' + (type === 'error' ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
}

// 3. CORE LOGIC & FILTERING (SAME-CITY)
function isSamePincodeDistrict(pinA, pinB) {
  if (!pinA || !pinB || pinA.length < 3 || pinB.length < 3) return false;
  return pinA.substring(0, 3) === pinB.substring(0, 3);
}

async function loadListings() {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast('Could not reach the database. Showing demo data.', 'error');
    } else if (data) {
      listingsData = data;
    }
  }
  renderAllViews();
}

function renderAllViews() {
  filterListings();
  renderVaultViews();
}

function setCategory(cat, btnElement) {
  activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach((btn) => btn.classList.remove('active'));
  btnElement.classList.add('active');
  filterListings();
}

function filterListings() {
  const campusFilter = $('campus-switcher').value;
  const cityFilter = $('city-filter').value;
  const buyerPinFilter = $('buyer-pincode-filter').value.replace(/\D/g, '');
  const searchQuery = $('search-input').value.trim().toLowerCase();
  const container = $('listings-container');

  const filtered = listingsData.filter((book) => {
    if (book.status === 'Sold') return false;

    const matchesCampus = campusFilter === 'ALL' || book.campus === campusFilter;
    const matchesCategory = activeCategory === 'ALL' || book.category === activeCategory;
    const matchesCity = cityFilter === 'ALL' || book.seller_city === cityFilter;
    const matchesSameCityPin = buyerPinFilter.length >= 3 ? isSamePincodeDistrict(buyerPinFilter, book.seller_pincode) : true;

    const matchesSearch =
      !searchQuery ||
      [book.title, book.author, book.isbn, book.seller_city, book.seller_pincode, book.seller_address]
        .some((v) => String(v ?? '').toLowerCase().includes(searchQuery));

    return matchesCampus && matchesCategory && matchesCity && matchesSameCityPin && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="book-card"><p class="empty-note">No textbooks available for this filter.</p></div>`;
    return;
  }

  container.innerHTML = filtered.map((book) => `
    <article class="book-card" data-category="${esc(book.category)}">
      <div class="card-top">
        <div class="card-title-group">
          <h3 class="serif-card-title">${esc(book.title)}</h3>
          <p class="book-meta">${esc(book.author)} · Seller: <strong>${esc(book.seller_name)}</strong></p>
        </div>
        <div class="price-top-right">
          <span class="price-now">${priceText(book.price)}</span>
          <span class="price-mrp">MRP ₹${esc(book.mrp)}</span>
        </div>
      </div>
      <p class="card-location-meta">${esc(book.seller_city)} (${esc(book.seller_pincode)}) · ${esc(book.delivery_mode)} · ${esc(book.seller_address)}</p>
      <div class="card-footer">
        <div>
          <span class="pill-badge pill-condition">${esc(conditionLabel(book.condition))}</span>
          <span class="isbn-line" style="margin-left: 6px;">ISBN ${esc(book.isbn)}</span>
        </div>
        ${book.status === 'Available'
          ? `<button class="btn-primary-meadow" data-act="book" data-id="${esc(book.id)}">Book Order</button>`
          : `<span class="pill-badge">Booked</span>`}
      </div>
    </article>
  `).join('');
}

// 4. BUYER BOOKING (SAME-CITY GUARDRAIL)
function openModal(id) {
  lastFocusedEl = document.activeElement;
  const modal = $(id);
  modal.classList.remove('hidden');
  const first = modal.querySelector('input:not([type=hidden])');
  if (first) first.focus();
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.add('hidden'));
  if (lastFocusedEl && lastFocusedEl.focus) lastFocusedEl.focus();
}

function openReserveModal(bookId) {
  const book = listingsData.find((b) => String(b.id) === String(bookId));
  if (!book) return;
  $('modal-book-id').value = book.id;
  $('modal-book-title').textContent = book.title;
  $('modal-delivery-badge').textContent = book.delivery_mode.toUpperCase();
  $('modal-book-location').textContent =
    `${priceText(book.price)} · ${book.seller_city} (${book.seller_pincode.substring(0, 3)}xxx) · same-city only`;
  $('modal-pincode-warning').textContent = '';

  const topPin = $('buyer-pincode-filter').value.replace(/\D/g, '');
  if (topPin.length === 6) $('buyer-pincode-input').value = topPin;

  openModal('booking-modal');
}

function closeReserveModal() {
  $('booking-modal').classList.add('hidden');
  if (lastFocusedEl && lastFocusedEl.focus) lastFocusedEl.focus();
}

async function confirmReservation(event) {
  event.preventDefault();
  const bookId = $('modal-book-id').value;
  const book = listingsData.find((b) => String(b.id) === String(bookId));
  const warningEl = $('modal-pincode-warning');
  warningEl.style.color = '#B91C1C';
  if (!book) return;

  const buyerName = $('buyer-name-input').value.trim();
  const buyerPhone = $('buyer-phone-input').value.trim();
  const buyerPincode = $('buyer-pincode-input').value.trim();
  const buyerAddress = $('buyer-address-input').value.trim();

  if (!isMobile(buyerPhone)) { warningEl.textContent = 'Enter a valid 10-digit mobile number.'; return; }
  if (!isPincode(buyerPincode)) { warningEl.textContent = 'Enter a valid 6-digit pincode.'; return; }
  if (!isSamePincodeDistrict(buyerPincode, book.seller_pincode)) {
    warningEl.textContent = `Same-city orders only. Your pincode (${buyerPincode}) does not match ${book.seller_city} (${book.seller_pincode.substring(0, 3)}xxx).`;
    return;
  }

  const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
  const btn = $('booking-submit');
  btn.disabled = true;

  if (supabaseClient) {
    // Only succeeds if the book is still Available (stops two buyers booking the same copy)
    const { data, error } = await supabaseClient
      .from('listings')
      .update({
        status: 'Reserved', buyer_name: buyerName, buyer_phone: buyerPhone,
        buyer_pincode: buyerPincode, buyer_address: buyerAddress, handoff_pin: generatedPin
      })
      .eq('id', bookId)
      .eq('status', 'Available')
      .select();

    if (error || !data || data.length === 0) {
      btn.disabled = false;
      warningEl.textContent = error ? 'Could not book. Check your connection and try again.' : 'Sorry, someone just booked this book.';
      await loadListings();
      return;
    }
  }

  listingsData = listingsData.map((b) =>
    String(b.id) === String(bookId)
      ? { ...b, status: 'Reserved', buyer_name: buyerName, buyer_phone: buyerPhone, buyer_pincode: buyerPincode, buyer_address: buyerAddress, handoff_pin: generatedPin }
      : b
  );

  btn.disabled = false;
  $('booking-modal').classList.add('hidden');
  $('buyer-address-input').value = '';
  renderAllViews();
  switchScreen('vault', document.querySelectorAll('.nav-item')[2]);
  toast(`Booked! Your handoff PIN is ${generatedPin}`);
}

async function cancelBooking(bookId) {
  if (!confirm('Cancel this booking and relist the book?')) return;
  const blank = { status: 'Available', buyer_name: null, buyer_phone: null, buyer_pincode: null, buyer_address: null, handoff_pin: null };

  if (supabaseClient) {
    const { error } = await supabaseClient.from('listings').update(blank).eq('id', bookId);
    if (error) { toast('Could not cancel. Try again.', 'error'); return; }
  }
  listingsData = listingsData.map((b) => (String(b.id) === String(bookId) ? { ...b, ...blank } : b));
  renderAllViews();
  toast('Booking cancelled');
}

// 5. SELLER FORM LOGIC
function selectCondition(cond, multiplier, btnEl) {
  selectedCondition = cond;
  selectedMultiplier = multiplier;
  document.querySelectorAll('.cond-btn').forEach((b) => b.classList.remove('active'));
  btnEl.classList.add('active');
  calculateSmartPrice();
}

function calculateSmartPrice() {
  const mrp = Number($('book-mrp').value) || 0;
  const finalPrice = Math.round(mrp * selectedMultiplier);
  $('calculated-price-display').textContent = finalPrice === 0 ? 'FREE (₹0)' : `₹${finalPrice}`;
}

function autoFillBook(title, author, isbn, mrp, category) {
  $('book-title').value = title;
  $('book-author').value = author;
  $('book-isbn').value = isbn;
  $('book-mrp').value = mrp;
  $('book-category').value = category;
  calculateSmartPrice();
}

async function handlePublishBook(event) {
  event.preventDefault();

  const mrp = Number($('book-mrp').value);
  const sellerPhone = $('seller-phone').value.trim();
  const sellerPincode = $('seller-pincode').value.trim();

  if (!(mrp >= 50 && mrp <= 10000)) { toast('MRP must be between ₹50 and ₹10,000.', 'error'); return; }
  if (!isMobile(sellerPhone)) { toast('Enter a valid 10-digit mobile number.', 'error'); return; }
  if (!isPincode(sellerPincode)) { toast('Enter a valid 6-digit pincode.', 'error'); return; }

  const newBook = {
    title: $('book-title').value.trim(),
    author: $('book-author').value.trim(),
    isbn: $('book-isbn').value.trim(),
    campus: $('book-campus').value,
    category: $('book-category').value,
    condition: selectedCondition,
    mrp,
    price: Math.round(mrp * selectedMultiplier),
    delivery_mode: $('book-delivery-mode').value,
    seller_city: $('seller-city').value,
    seller_pincode: sellerPincode,
    seller_name: $('seller-name').value.trim(),
    seller_phone: sellerPhone,
    seller_address: $('seller-address').value.trim(),
    status: 'Available'
  };

  const btn = $('publish-btn');
  btn.disabled = true;

  if (supabaseClient) {
    const { data, error } = await supabaseClient.from('listings').insert([newBook]).select();
    if (error || !data || !data[0]) {
      btn.disabled = false;
      toast('Could not publish. Check your connection and try again.', 'error');
      return;
    }
    listingsData.unshift(data[0]);
  } else {
    listingsData.unshift({ id: 'bk-' + Date.now(), ...newBook, rating: null, feedback_note: null });
  }

  btn.disabled = false;
  $('sell-form').reset();
  selectedCondition = 'Mint';
  selectedMultiplier = 0.60;
  document.querySelectorAll('.cond-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  calculateSmartPrice();
  renderAllViews();
  switchScreen('discover', document.querySelectorAll('.nav-item')[0]);
  toast('Your book is live');
}

// 6. VAULT, HANDOFF & FEEDBACK
function renderVaultViews() {
  const buyerContainer = $('buyer-reserved-list');
  const sellerContainer = $('seller-active-list');
  const reservedBooks = listingsData.filter((b) => b.status === 'Reserved');

  buyerContainer.innerHTML = reservedBooks.length === 0
    ? `<div class="book-card"><p class="empty-note">No active bookings.</p></div>`
    : reservedBooks.map((b) => `
        <div class="book-card">
          <div class="card-top">
            <span class="pill-badge">🛵 ${esc(b.delivery_mode.toUpperCase())}</span>
            <span class="pill-badge pill-condition">PIN: ${esc(b.handoff_pin)}</span>
          </div>
          <h3 class="serif-card-title">${esc(b.title)}</h3>
          <span class="price-now">Final Price: ${priceText(b.price)}</span>
          <div class="policy-pill-banner">⚖️ App price (${priceText(b.price)}) is final. Cancel below if the condition does not match.</div>
          <div class="contact-unlock-box">
            <span class="mono-label">UNLOCKED SELLER CONTACT</span>
            <p>👤 <strong>${esc(b.seller_name)}</strong> (${esc(b.seller_city)} - ${esc(b.seller_pincode)})</p>
            <p>📞 <span class="phone-highlight">+91 ${esc(b.seller_phone)}</span></p>
            <p>📍 Landmark: <strong>${esc(b.seller_address)}</strong></p>
            <div class="call-wa-row">
              <a href="tel:${esc(b.seller_phone)}" class="btn-call">📞 Call</a>
              <a href="https://wa.me/91${esc(b.seller_phone)}?text=${encodeURIComponent(`Hi ${b.seller_name}, I booked "${b.title}" on Folio at ${priceText(b.price)}.`)}" target="_blank" rel="noopener" class="btn-wa">💬 WhatsApp</a>
            </div>
            <button class="btn-cancel-booking" data-act="cancel" data-id="${esc(b.id)}">Cancel Order</button>
          </div>
        </div>
      `).join('');

  sellerContainer.innerHTML = listingsData.map((b) => `
    <div class="book-card">
      <div class="card-top">
        <span class="pill-badge">${esc(b.status.toUpperCase())}</span>
        <span class="isbn-line">${priceText(b.price)}</span>
      </div>
      <h3 class="serif-card-title">${esc(b.title)}</h3>
      <p class="book-meta">${esc(b.delivery_mode)} • ${esc(b.seller_address)}</p>
      ${b.status === 'Reserved' ? `
        <div class="policy-pill-banner">⚖️ Do not accept less than ${priceText(b.price)}.</div>
        <div class="contact-unlock-box">
          <span class="mono-label">UNLOCKED BUYER DETAILS</span>
          <p>👤 <strong>${esc(b.buyer_name)}</strong> (Pincode: ${esc(b.buyer_pincode)})</p>
          <p>📞 <span class="phone-highlight">+91 ${esc(b.buyer_phone)}</span></p>
          <p>🏠 <strong>${esc(b.buyer_address)}</strong></p>
          <div class="call-wa-row">
            <a href="tel:${esc(b.buyer_phone)}" class="btn-call">📞 Call</a>
            <a href="https://wa.me/91${esc(b.buyer_phone)}?text=${encodeURIComponent(`Hi ${b.buyer_name}, confirming your Folio booking for "${b.title}" at ${priceText(b.price)}.`)}" target="_blank" rel="noopener" class="btn-wa">💬 WhatsApp</a>
          </div>
          <button class="btn-cancel-booking" data-act="cancel" data-id="${esc(b.id)}">Cancel & Relist</button>
        </div>
      ` : b.status === 'Sold'
        ? `<div class="policy-pill-banner">✓ Sold at ${priceText(b.price)}${b.rating ? ` • ${esc(b.rating)} ★` : ''}</div>`
        : `<p class="isbn-line">Waiting for buyer...</p>`}
    </div>
  `).join('');
}

async function verifyHandoffPin() {
  const pinInput = $('verify-pin-input').value.trim();
  const feedback = $('pin-feedback');
  const matchedBook = listingsData.find((b) => b.status === 'Reserved' && b.handoff_pin === pinInput);

  if (!/^\d{4}$/.test(pinInput) || !matchedBook) {
    feedback.textContent = 'Invalid PIN. Check the 4-digit PIN on the buyer\'s screen.';
    feedback.style.color = '#B91C1C';
    return;
  }

  if (supabaseClient) {
    const { error } = await supabaseClient.from('listings').update({ status: 'Sold' }).eq('id', matchedBook.id);
    if (error) {
      feedback.textContent = 'Could not save. Check your connection and try again.';
      feedback.style.color = '#B91C1C';
      return;
    }
  }

  matchedBook.status = 'Sold';
  feedback.textContent = `Handoff verified at ${priceText(matchedBook.price)}!`;
  feedback.style.color = '#1F6E43';
  $('verify-pin-input').value = '';
  renderAllViews();
  openFeedbackModal(matchedBook);
}

function openFeedbackModal(book) {
  currentStarRating = 5;
  document.querySelectorAll('.rating-pill').forEach((b, i) => b.classList.toggle('active', i === 4));
  $('feedback-book-id').value = book.id;
  $('feedback-book-title').textContent = book.title;
  $('feedback-final-price').textContent = `Final Price Settled: ${priceText(book.price)}`;
  $('feedback-note-input').value = '';
  openModal('feedback-modal');
}

function selectStarRating(stars, btnEl) {
  currentStarRating = stars;
  document.querySelectorAll('.rating-pill').forEach((b) => b.classList.remove('active'));
  btnEl.classList.add('active');
}

function setFeedbackTag(tagText) {
  $('feedback-note-input').value = tagText;
}

async function submitOrderFeedback(event) {
  event.preventDefault();
  const bookId = $('feedback-book-id').value;
  const note = $('feedback-note-input').value.trim();

  if (supabaseClient) {
    const { error } = await supabaseClient
      .from('listings')
      .update({ rating: currentStarRating, feedback_note: note })
      .eq('id', bookId);
    if (error) { toast('Could not save feedback. Try again.', 'error'); return; }
  }

  listingsData = listingsData.map((b) =>
    String(b.id) === String(bookId) ? { ...b, rating: currentStarRating, feedback_note: note } : b
  );
  $('feedback-modal').classList.add('hidden');
  renderAllViews();
  toast('Thanks for the feedback');
}

function switchVaultRole(role) {
  $('vault-buying-view').classList.toggle('hidden', role !== 'BUYING');
  $('vault-selling-view').classList.toggle('hidden', role !== 'SELLING');
  $('tab-buying').classList.toggle('active', role === 'BUYING');
  $('tab-selling').classList.toggle('active', role === 'SELLING');
}

function switchScreen(screenId, navBtn) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active-screen'));
  const screen = $(`screen-${screenId}`);
  screen.classList.add('active-screen');
  screen.scrollTop = 0;
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
  navBtn.classList.add('active');
}

// 7. STARTUP, EVENTS & SPLASH
const digitsOnly = (id) => $(id).addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });

window.addEventListener('DOMContentLoaded', async () => {
  // Buttons built from data use one delegated listener instead of inline onclick
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'book') openReserveModal(el.dataset.id);
    if (el.dataset.act === 'cancel') cancelBooking(el.dataset.id);
  });

  // Esc closes any open modal; tapping the dark backdrop does too
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllModals(); });
  document.querySelectorAll('.modal-overlay').forEach((m) =>
    m.addEventListener('click', (e) => { if (e.target === m) closeAllModals(); })
  );

  ['buyer-pincode-filter', 'seller-pincode', 'seller-phone', 'buyer-phone-input',
   'buyer-pincode-input', 'verify-pin-input'].forEach(digitsOnly);

  const minimumSplash = new Promise((resolve) => setTimeout(resolve, 1800));
  await loadListings();
  await minimumSplash;

  const splash = $('splash-screen');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 700);
  }
});