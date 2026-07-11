// cart.js
// Handles: loading live products, the cart (stored in localStorage so it
// survives page reloads), and the embedded Square checkout - all without
// ever leaving the site.
//
// Include this file with: <script src="cart.js" defer></script>
// It expects these elements to exist somewhere in your HTML:
//   <div id="shop-grid"></div>              (products render here)
//   <div id="cart-count"></div>              (shows # items, e.g. in nav)
//   <div id="cart-drawer"></div>             (cart panel contents)
//   <div id="card-container"></div>          (Square card form renders here)
//   <button id="checkout-button">Pay now</button>

const CART_KEY = "ppp_cart";
let squarePayments = null;
let squareCard = null;

// ---------- Cart storage ----------

function getCart() {
  return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCartCount();
  renderCartDrawer();
}

function addToCart(product, quantity = 1) {
  const cart = getCart();
  const existing = cart.find((line) => line.variationId === product.variationId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      variationId: product.variationId,
      name: product.name,
      price: product.price,
      quantity,
    });
  }
  saveCart(cart);
}

function updateQuantity(variationId, quantity) {
  let cart = getCart();
  if (quantity <= 0) {
    cart = cart.filter((line) => line.variationId !== variationId);
  } else {
    cart.forEach((line) => {
      if (line.variationId === variationId) line.quantity = quantity;
    });
  }
  saveCart(cart);
}

function cartTotal() {
  return getCart().reduce((sum, line) => sum + line.price * line.quantity, 0);
}

// ---------- Rendering ----------

function renderCartCount() {
  const el = document.getElementById("cart-count");
  if (!el) return;
  const count = getCart().reduce((sum, line) => sum + line.quantity, 0);
  el.textContent = count;
}

function renderCartDrawer() {
  const el = document.getElementById("cart-drawer");
  if (!el) return;
  const cart = getCart();

  if (cart.length === 0) {
    el.innerHTML = "<p>Your cart is empty.</p>";
    return;
  }

  el.innerHTML =
    cart
      .map(
        (line) => `
      <div class="cart-line">
        <span>${line.name}</span>
        <input type="number" min="0" value="${line.quantity}"
          onchange="updateQuantity('${line.variationId}', parseInt(this.value))" />
        <span>$${(line.price * line.quantity).toFixed(2)}</span>
      </div>`
      )
      .join("") +
    `<div class="cart-total">Total: $${cartTotal().toFixed(2)}</div>`;
}

async function renderShopGrid() {
  const grid = document.getElementById("shop-grid");
  if (!grid) return;

  grid.innerHTML = "<p>Loading products…</p>";

  try {
    const res = await fetch("/api/catalog");
    const { products } = await res.json();

    grid.innerHTML = products
      .map(
        (p) => `
      <div class="shop-tile">
        <h3>${p.name}</h3>
        <p>$${p.price?.toFixed(2) ?? "—"}</p>
        <p>${p.inStock === 0 ? "Sold out" : ""}</p>
        <button
          ${p.inStock === 0 ? "disabled" : ""}
          onclick='addToCart(${JSON.stringify(p)})'>
          Add to Cart
        </button>
      </div>`
      )
      .join("");
  } catch (err) {
    grid.innerHTML = "<p>Couldn't load products right now. Please refresh.</p>";
    console.error(err);
  }
}

// ---------- Square Web Payments (checkout) ----------

async function initSquarePayments() {
  const cardContainer = document.getElementById("card-container");
  if (!cardContainer || !window.Square) return;

  // NOTE: swap these two values, and swap the <script src> in your HTML
  // from sandbox.web.squarecdn.com to web.squarecdn.com, when you go live.
  const appId = "YOUR_SQUARE_APP_ID";
  const locationId = "YOUR_SQUARE_LOCATION_ID";

  squarePayments = window.Square.payments(appId, locationId);
  squareCard = await squarePayments.card();
  await squareCard.attach("#card-container");
}

async function handleCheckout() {
  const button = document.getElementById("checkout-button");
  const cart = getCart();

  if (cart.length === 0) {
    alert("Your cart is empty.");
    return;
  }
  if (!squareCard) {
    alert("Payment form isn't ready yet - please wait a moment and try again.");
    return;
  }

  button.disabled = true;
  button.textContent = "Processing…";

  try {
    const tokenResult = await squareCard.tokenize();
    if (tokenResult.status !== "OK") {
      throw new Error(tokenResult.errors?.[0]?.message || "Card error");
    }

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cart: cart.map((l) => ({ variationId: l.variationId, quantity: l.quantity })),
        sourceId: tokenResult.token,
      }),
    });

    const result = await res.json();

    if (result.success) {
      localStorage.removeItem(CART_KEY);
      renderCartCount();
      renderCartDrawer();
      alert("Thank you! Your order has been placed.");
    } else {
      throw new Error(result.error || "Payment failed");
    }
  } catch (err) {
    alert("Something went wrong: " + err.message);
    console.error(err);
  } finally {
    button.disabled = false;
    button.textContent = "Pay now";
  }
}

// ---------- Init on page load ----------

document.addEventListener("DOMContentLoaded", () => {
  renderCartCount();
  renderCartDrawer();
  renderShopGrid();
  initSquarePayments();

  const checkoutButton = document.getElementById("checkout-button");
  if (checkoutButton) checkoutButton.addEventListener("click", handleCheckout);
});
