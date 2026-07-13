// netlify/functions/blog.js
//
// Pulls published posts from a beehiiv publication and returns them in a
// simple shape the front end can render natively (your fonts, your colors,
// your URL — readers never see beehiiv's own site).
//
// Works for BOTH publications (PPP and After Dark) — just pass a different
// ?publicationId= from the front end. One API key covers your whole
// beehiiv account, since publications live under the same workspace.
//
// Requires this environment variable in Netlify:
//   BEEHIIV_API_KEY   (secret - from beehiiv: Settings > Workspace > API)

exports.handler = async function (event) {
  const publicationId = event.queryStringParameters?.publicationId;

  if (!publicationId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing publicationId." }),
    };
  }

  try {
    const url = `https://api.beehiiv.com/v2/publications/${publicationId}/posts?limit=6&order_by=publish_date&direction=desc&status=confirmed&platform=web&expand[]=free_web_content`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`beehiiv API returned ${res.status}`);
    }

    const data = await res.json();

    const posts = (data.data || []).map((post) => {
      const fullHtml = post.content?.free?.web || "";
      return {
        id: post.id,
        title: post.title,
        subtitle: post.subtitle || "",
        publishDate: post.publish_date,
        thumbnailUrl: post.thumbnail_url || null,
        content: fullHtml,
        excerpt: fullHtml
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160),
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posts }),
    };
  } catch (err) {
    console.error("Blog fetch error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not load blog posts right now." }),
    };
  }
};
