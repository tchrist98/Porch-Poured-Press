// netlify/functions/catalog.js
//
// Pulls live items from your Square catalog (name, price, image, stock)
// so the website's shop section always matches what's in Square —
// no manual re-typing of prices or products on the site itself.
//
// Requires these environment variables to be set in Netlify:
//   SQUARE_ACCESS_TOKEN   (secret - from Square Developer Dashboard)
//   SQUARE_LOCATION_ID    (public - L6PF6R4W1EXCG)
//   SQUARE_ENVIRONMENT    ("sandbox" while testing, "production" when live)

const { SquareClient, SquareEnvironment } = require("square");

exports.handler = async function (event) {
  try {
    const client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      environment:
        process.env.SQUARE_ENVIRONMENT === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });

    // 1. Get all catalog items (books + merch)
    const catalogResponse = await client.catalog.list({ types: "ITEM" });
    const items = catalogResponse.data || [];

    // 1b. Get category names, so we can label each product "Books" or "Merch"
    const categoryResponse = await client.catalog.list({ types: "CATEGORY" });
    const categoryMap = {};
    (categoryResponse.data || []).forEach((cat) => {
      categoryMap[cat.id] = cat.categoryData?.name || "";
    });

    // 2. Get current inventory counts for every variation in one batch call
    const variationIds = [];
    items.forEach((item) => {
      (item.itemData?.variations || []).forEach((v) => variationIds.push(v.id));
    });

    let inventoryMap = {};
    if (variationIds.length > 0) {
      const inventoryResponse = await client.inventory.batchGetCounts({
        catalogObjectIds: variationIds,
        locationIds: [process.env.SQUARE_LOCATION_ID],
      });
      (inventoryResponse.data || []).forEach((count) => {
        inventoryMap[count.catalogObjectId] = parseInt(count.quantity || "0", 10);
      });
    }

    // 3. Shape a clean, simple product list for the front end
    const products = items.map((item) => {
      const data = item.itemData;
      const variation = (data.variations || [])[0];
      const priceMoney = variation?.itemVariationData?.priceMoney;

      return {
        id: item.id,
        variationId: variation?.id || null,
        name: data.name,
        description: data.description || "",
        price: priceMoney ? Number(priceMoney.amount) / 100 : null, // cents -> dollars
        currency: priceMoney?.currency || "USD",
        imageId: (data.imageIds || [])[0] || null,
        inStock: variation ? (inventoryMap[variation.id] ?? null) : null,
        category: categoryMap[data.reportingCategory?.id || (data.categories && data.categories[0]?.id)] || "Uncategorized",
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products }),
    };
  } catch (err) {
    console.error("Catalog fetch error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not load products right now." }),
    };
  }
};
