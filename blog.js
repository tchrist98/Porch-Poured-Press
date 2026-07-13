// blog.js
// Loads beehiiv posts and renders them natively (your design, not theirs),
// and handles newsletter signups for both PPP and After Dark - all without
// sending readers to beehiiv's own site.
//
// Include with: <script src="blog.js" defer></script>
// Expects, for the main site:
//   <div id="blog-grid"></div>
//   <form id="newsletter-form"><input type="email" name="email"></form>
// And, for After Dark:
//   <div id="after-dark-blog-grid"></div>
//   <form id="after-dark-newsletter-form"><input type="email" name="email"></form>

// ----- FILL THESE IN once you have both publication IDs from beehiiv -----
// Find them in beehiiv: Settings > Workspace > [publication name] - the ID
// starts with "pub_". Or ask Claude to look them up via the beehiiv API
// once you've shared them.
const PPP_PUBLICATION_ID = "pub_e278a335-1a5b-4227-9f6d-4565564f24ad";
const AFTER_DARK_PUBLICATION_ID = "YOUR_AFTER_DARK_PUBLICATION_ID";
// ---------------------------------------------------------------------

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso * 1000 || iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const postStore = {};

async function loadBlog(gridId, publicationId, dark = false) {
  const grid = document.getElementById(gridId);
  if (!grid || !publicationId || publicationId.startsWith("YOUR_")) return;

  grid.innerHTML = "<p>Loading posts…</p>";

  try {
    const res = await fetch(`/api/blog?publicationId=${encodeURIComponent(publicationId)}`);
    const { posts } = await res.json();

    if (!posts || posts.length === 0) {
      grid.innerHTML = "<p>No posts yet - check back soon.</p>";
      return;
    }

    posts.forEach((post) => (postStore[post.id] = { ...post, dark }));

    grid.innerHTML = posts
      .map(
        (post) => `
      <a href="javascript:void(0)" onclick="openPost('${post.id}')" class="blog-tile ${dark ? "blog-tile-dark" : ""}" style="display:block; text-decoration:none; color:inherit; cursor:pointer;">
        ${post.thumbnailUrl ? `<img src="${post.thumbnailUrl}" alt="" style="width:100%; height:160px; object-fit:cover; margin-bottom:0.8rem;">` : ""}
        <h4 style="font-family:'Fraunces', serif; font-weight:500; font-size:1.1rem; margin-bottom:0.4rem;">${post.title}</h4>
        <p style="font-size:0.82rem; opacity:0.65; margin-bottom:0.5rem;">${formatDate(post.publishDate)}</p>
        <p style="font-size:0.88rem; opacity:0.8; line-height:1.5;">${post.excerpt}${post.excerpt.length >= 160 ? "…" : ""}</p>
      </a>`
      )
      .join("");
  } catch (err) {
    grid.innerHTML = "<p>Couldn't load posts right now.</p>";
    console.error(err);
  }
}

function openPost(postId) {
  const post = postStore[postId];
  if (!post) return;

  let overlay = document.getElementById("post-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "post-overlay";
    overlay.style.cssText =
      "position:fixed; inset:0; z-index:1000; overflow-y:auto; display:flex; justify-content:center; padding:4vh 5vw;";
    document.body.appendChild(overlay);
  }

  const bg = post.dark ? "#1c0d12" : "var(--cream, #FCF1DF)";
  const fg = post.dark ? "#EAD9C8" : "var(--ink, #3A2C28)";

  overlay.innerHTML = `
    <div style="position:fixed; inset:0; background:rgba(0,0,0,0.6);" onclick="closePost()"></div>
    <div style="position:relative; background:${bg}; color:${fg}; max-width:720px; width:100%; padding:3rem 2.4rem; margin-top:2vh; margin-bottom:4vh;">
      <button onclick="closePost()" style="position:absolute; top:1.2rem; right:1.2rem; background:none; border:none; font-size:1.4rem; color:${fg}; cursor:pointer; opacity:0.6;">&times;</button>
      ${post.thumbnailUrl ? `<img src="${post.thumbnailUrl}" alt="" style="width:100%; max-height:280px; object-fit:cover; margin-bottom:1.5rem;">` : ""}
      <h2 style="font-family:'Fraunces', serif; font-weight:500; font-size:1.8rem; margin-bottom:0.5rem;">${post.title}</h2>
      <p style="opacity:0.6; font-size:0.85rem; margin-bottom:2rem;">${formatDate(post.publishDate)}</p>
      <div style="line-height:1.7; font-size:0.95rem;">${post.content}</div>
    </div>
  `;
  document.body.style.overflow = "hidden";
}

function closePost() {
  const overlay = document.getElementById("post-overlay");
  if (overlay) overlay.remove();
  document.body.style.overflow = "";
}

async function handleSubscribe(formId, publicationId) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]').value;
    const button = form.querySelector("button");
    const originalText = button.textContent;

    button.disabled = true;
    button.textContent = "Subscribing…";

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, publicationId }),
      });
      const result = await res.json();

      if (result.success) {
        form.reset();
        button.textContent = "Subscribed!";
      } else {
        throw new Error(result.error || "Subscription failed");
      }
    } catch (err) {
      alert("Something went wrong: " + err.message);
      button.textContent = originalText;
    } finally {
      button.disabled = false;
      setTimeout(() => (button.textContent = originalText), 3000);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadBlog("blog-grid", PPP_PUBLICATION_ID, false);
  loadBlog("after-dark-blog-grid", AFTER_DARK_PUBLICATION_ID, true);
  handleSubscribe("newsletter-form", PPP_PUBLICATION_ID);
  handleSubscribe("after-dark-newsletter-form", AFTER_DARK_PUBLICATION_ID);
});
