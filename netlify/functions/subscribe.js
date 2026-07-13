// netlify/functions/subscribe.js
//
// Takes an email + which publication (PPP or After Dark) and subscribes
// the reader via beehiiv's API, so the signup form never has to send
// people to beehiiv's own site.
//
// Requires the same BEEHIIV_API_KEY environment variable as blog.js.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { email, publicationId } = JSON.parse(event.body);

    if (!email || !publicationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing email or publicationId." }),
      };
    }

    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          send_welcome_email: true,
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error("beehiiv subscribe error:", errBody);
      throw new Error("Subscription failed");
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("Subscribe error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: "Couldn't subscribe right now. Please try again.",
      }),
    };
  }
};
