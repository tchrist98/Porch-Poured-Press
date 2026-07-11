// netlify/functions/checkout.js
//
// Receives the cart + a one-time card token (created in the browser by
// Square's Web Payments SDK) and:
//   1. Creates an Order in Square from the cart line items
//   2. Charges the card token against that Order
//   3. Returns success/failure to the front end
//
// The card number itself NEVER touches this function or your website's
// code - the browser SDK tokenizes it directly with Square first.
//
// Requires the same environment variables as catalog.js.

const { SquareClient, SquareEnvironment } = require("square");
const { randomUUID } = require("crypto");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { cart, sourceId, buyer } = JSON.parse(event.body);

    if (!cart || !cart.length || !sourceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing cart or payment token." }),
      };
    }

    const client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      environment:
        process.env.SQUARE_ENVIRONMENT === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });

    const locationId = process.env.SQUARE_LOCATION_ID;

    // 1. Build the order from cart items (references live catalog variations,
    //    so price always matches what's actually in Square - not something
    //    the browser could tamper with)
    const lineItems = cart.map((line) => ({
      quantity: String(line.quantity),
      catalogObjectId: line.variationId,
    }));

    const orderResponse = await client.orders.create({
      order: {
        locationId,
        lineItems,
      },
      idempotencyKey: randomUUID(),
    });

    const order = orderResponse.order;

    // 2. Charge the card token against that order's total
    const paymentResponse = await client.payments.create({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: order.totalMoney,
      orderId: order.id,
      locationId,
      buyerEmailAddress: buyer?.email || undefined,
      note: "Porch Poured Press website order",
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        orderId: order.id,
        paymentId: paymentResponse.payment.id,
        receiptUrl: paymentResponse.payment.receiptUrl || null,
      }),
    };
  } catch (err) {
    console.error("Checkout error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: "Payment could not be processed. Please try again.",
      }),
    };
  }
};
