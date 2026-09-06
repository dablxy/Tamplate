import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BLOG_ID = process.env.BLOGGER_BLOG_ID || '4263033619836681299';
const SITE = (process.env.SITE_URL || 'https://azexai.com').replace(/\/$/,'');
const INDEX_FILE = path.join(ROOT, 'index.html');

const INDEX_HTML = await fs.readFile(INDEX_FILE, 'utf8');

const API_KEY =
  process.env.BLOGGER_API_KEY ||
  extractKey(INDEX_HTML);

const API =
  `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts`;

if (!API_KEY) {
  throw new Error('Missing BLOGGER_API_KEY');
}

function extractKey(html) {
  const patterns = [
    /API_KEY\s*:\s*['"]([^'"]+)['"]/i,
    /BLOGGER_API_KEY\s*[:=]\s*['"]([^'"]+)['"]/i,
    /AIza[0-9A-Za-z_-]{20,}/
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1] || match[0];
  }

  return '';
}

function esc(value = '') {
  return String(value).replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char])
  );
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'article';
}

function nativeSlug(post) {
  try {
    const url = new URL(post.url);

    const last =
      url.pathname
        .split('/')
        .filter(Boolean)
        .pop() || '';

    const clean =
      decodeURIComponent(last)
        .replace(/\.html$/i, '');

    if (
      clean &&
      !/^\d+$/.test(clean)
    ) {
      return slugify(clean);
    }
  } catch {}

  return slugify(post.title);
}

function strip(html = '') {
  return String(html)
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ' '
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      ' '
    )
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(html, title = '') {
  const paragraphs = [
    ...String(html || '').matchAll(
      /<p\b[^>]*>([\s\S]*?)<\/p>/gi
    )
  ]
    .map(match => strip(match[1]))
    .filter(text => text.length > 70);

  let text =
    paragraphs[0] ||
    strip(html) ||
    'Technology, intelligence, and the systems shaping tomorrow.';

  if (
    title &&
    text
      .toLowerCase()
      .startsWith(title.toLowerCase())
  ) {
    text =
      text
        .slice(title.length)
        .trim();
  }

  if (text.length > 160) {
    return (
      text
        .slice(0, 157)
        .replace(/\s+\S*$/, '') +
      '…'
    );
  }

  return text;
}

function image(post) {
  const apiImages =
    Array.isArray(post.images)
      ? post.images
          .map(item => item?.url || item)
          .filter(Boolean)
      : [];

  const bodyImages = [
    ...String(post.content || '').matchAll(
      /<img[^>]+src=["']([^"']+)["']/gi
    )
  ].map(match => match[1]);

  return [
    ...apiImages,
    ...bodyImages
  ].find(
    value => /^https?:\/\//i.test(value)
  ) || '';
}

function labels(post) {
  return Array.isArray(post.labels)
    ? post.labels
    : [];
}

function category(post) {
  const values =
    labels(post).map(
      value => String(value).toLowerCase()
    );

  const map = [
    ['ai', [
      'ai',
      'artificial intelligence',
      'machine learning',
      'llm'
    ]],
    ['robotics', [
      'robotics',
      'robots',
      'robot'
    ]],
    ['hardware', [
      'hardware',
      'devices',
      'chips',
      'computers'
    ]],
    ['software', [
      'software',
      'apps',
      'saas',
      'developer tools'
    ]],
    ['future-tech', [
      'future tech',
      'emerging technology',
      'future technology'
    ]],
    ['guides', [
      'guide',
      'guides',
      'how to',
      'tutorial'
    ]],
    ['reviews', [
      'review',
      'reviews'
    ]],
    ['ethics', [
      'ethics',
      'ai ethics'
    ]]
  ];

  for (const [key, aliases] of map) {
    if (
      values.some(
        value => aliases.includes(value)
      )
    ) {
      return {
        key,
        name:
          key === 'ai'
            ? 'AI'
            : key
                .replace('-', ' ')
                .replace(
                  /\b\w/g,
                  char => char.toUpperCase()
                )
      };
    }
  }

  return {
    key: '',
    name: labels(post)[0] || 'Technology'
  };
}

function sanitizeBody(html = '') {
  return String(html)
    .replace(
      /<(script|style|object|embed|form|noscript|template)\b[\s\S]*?<\/\1>/gi,
      ''
    )
    .replace(
      /<\/?(script|style|object|embed|form|noscript|template)\b[^>]*>/gi,
      ''
    )
    .replace(
      /<iframe([^>]*)>/gi,
      '<iframe$1 loading="lazy" referrerpolicy="strict-origin-when-cross-origin">'
    )
    .replace(
      /\sstyle\s*=\s*["'][^"']*["']/gi,
      ''
    )
    .replace(
      /\son\w+\s*=\s*["'][^"']*["']/gi,
      ''
    );
}

function dateFmt(value) {
  try {
    return new Intl.DateTimeFormat(
      'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }
    ).format(new Date(value));
  } catch {
    return '';
  }
}

function iso(value) {
  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString();
  } catch {
    return '';
  }
}

function readTime(html = '') {
  const words =
    strip(html)
      .split(/\s+/)
      .filter(Boolean)
      .length;

  return Math.max(
    1,
    Math.ceil(words / 220)
  );
}

async function fetchPosts() {
  const all = [];
  let pageToken = '';

  do {
    const url = new URL(API);

    url.searchParams.set(
      'key',
      API_KEY
    );

    url.searchParams.set(
      'fetchBodies',
      'true'
    );

    url.searchParams.set(
      'fetchImages',
      'true'
    );

    url.searchParams.set(
      'orderBy',
      'published'
    );

    url.searchParams.set(
      'maxResults',
      '50'
    );

    if (pageToken) {
      url.searchParams.set(
        'pageToken',
        pageToken
      );
    }

    const response =
      await fetch(url, {
        headers: {
          accept: 'application/json'
        }
      });

    if (!response.ok) {
      throw new Error(
        `Blogger API ${response.status}: ${await response.text()}`
      );
    }

    const data =
      await response.json();

    all.push(
      ...(data.items || [])
    );

    pageToken =
      data.nextPageToken || '';

  } while (pageToken);

  const unique =
    new Map();

  for (const post of all) {
    if (post?.id) {
      unique.set(
        String(post.id),
        post
      );
    }
  }

  return [
    ...unique.values()
  ].sort(
    (a, b) =>
      new Date(
        b.published || b.updated
      ) -
      new Date(
        a.published || a.updated
      )
  );
}

function card(post, slug) {
  const c = category(post);
  const img = image(post);
  const desc =
    excerpt(
      post.content,
      post.title
    );

  return `
<article class="card">
  <a
    class="card-media"
    href="/article/${encodeURIComponent(slug)}"
    aria-label="Read ${esc(post.title)}">

    ${
      img
        ? `<img
            src="${esc(img)}"
            alt="${esc(post.title)}"
            loading="lazy"
            decoding="async">`
        : ''
    }
  </a>

  <div class="tag">
    ${esc(c.name)}
  </div>

  <h3>
    <a href="/article/${encodeURIComponent(slug)}">
      ${esc(post.title)}
    </a>
  </h3>

  <p>
    ${esc(desc)}
  </p>

  <div class="card-foot">
    <span>
      ${esc(
        dateFmt(
          post.published ||
          post.updated
        )
      )}
    </span>

    <span>
      ${readTime(post.content || '')}
      min read
    </span>
  </div>
</article>`;
}

function articleMarkup(
  post,
  related,
  slug
) {
  const c = category(post);
  const img = image(post);

  const desc =
    excerpt(
      post.content,
      post.title
    );

  const published =
    iso(
      post.published ||
      post.updated
    );

  const updated =
    iso(
      post.updated ||
      post.published
    );

  const words =
    strip(
      post.content || ''
    )
      .split(/\s+/)
      .filter(Boolean)
      .length;

  const relatedHtml =
    related
      .slice(0, 3)
      .map(item =>
        card(
          item.post,
          item.slug
        )
      )
      .join('');

  return `
<article class="article-view">

  <header class="article-head">

    <nav
      class="breadcrumbs"
      aria-label="Breadcrumb">

      <a href="/">
        AZEXAI
      </a>

      <span>/</span>

      <a
        href="/?category=${encodeURIComponent(c.key)}">

        ${esc(c.name)}

      </a>

      <span>/</span>

      <span aria-current="page">
        Story
      </span>

    </nav>

    <div class="tag">
      ${esc(c.name)}
    </div>

    <h1>
      ${esc(post.title)}
    </h1>

    <div class="article-deck">
      ${esc(desc)}
    </div>

    <div class="article-meta">

      <span>
        ${esc(
          dateFmt(
            post.published ||
            post.updated
          )
        )}
      </span>

      ${
        post.updated &&
        post.updated !== post.published
          ? `<span>
              Updated ${esc(
                dateFmt(post.updated)
              )}
            </span>`
          : ''
      }

      ${
        post.author?.displayName
          ? `<span>
              By ${esc(
                post.author.displayName
              )}
            </span>`
          : ''
      }

      <span>
        ${Math.max(
          1,
          Math.ceil(words / 220)
        )}
        min read
      </span>

    </div>

  </header>

  ${
    img
      ? `<div class="article-hero">
          <img
            src="${esc(img)}"
            alt="${esc(post.title)}"
            fetchpriority="high"
            decoding="async">
        </div>`
      : ''
  }

  <div
    class="prose"
    id="articleContent">

    ${sanitizeBody(
      post.content ||
      '<p>This article contains no published body content.</p>'
    )}

  </div>

  ${
    relatedHtml
      ? `<section class="related">

          <div class="section-head">
            <h2>Related Stories</h2>
            <span class="label">
              ${esc(c.name)}
            </span>
          </div>

          <div class="grid">
            ${relatedHtml}
          </div>

        </section>`
      : ''
  }

</article>`;
}

function structuredData(
  post,
  slug
) {
  const c = category(post);
  const url =
    `${SITE}/article/${encodeURIComponent(slug)}`;

  const desc =
    excerpt(
      post.content,
      post.title
    );

  const img =
    image(post);

  const published =
    iso(
      post.published ||
      post.updated
    );

  const updated =
    iso(
      post.updated ||
      post.published
    );

  const author =
    post.author?.displayName ||
    'AZEXAI';

  return {
    '@context':
      'https://schema.org',

    '@graph': [

      {
        '@type':
          'Organization',

        '@id':
          `${SITE}/#organization`,

        name:
          'AZEXAI',

        url:
          SITE
      },

      {
        '@type':
          'WebSite',

        '@id':
          `${SITE}/#website`,

        name:
          'AZEXAI',

        url:
          SITE,

        publisher: {
          '@id':
            `${SITE}/#organization`
        }
      },

      {
        '@type':
          'BlogPosting',

        '@id':
          `${url}#article`,

        headline:
          post.title,

        description:
          desc,

        url,

        mainEntityOfPage: {
          '@type':
            'WebPage',

          '@id':
            url
        },

        datePublished:
          published,

        dateModified:
          updated,

        author: {
          '@type':
            'Person',

          name:
            author
        },

        publisher: {
          '@id':
            `${SITE}/#organization`
        },

        articleSection:
          c.name,

        keywords:
          labels(post),

        ...(img
          ? {
              image: [img],
              thumbnailUrl: img
            }
          : {}),

        wordCount:
          strip(
            post.content || ''
          )
            .split(/\s+/)
            .filter(Boolean)
            .length,

        isAccessibleForFree:
          true
      },

      {
        '@type':
          'BreadcrumbList',

        '@id':
          `${url}#breadcrumb`,

        itemListElement: [

          {
            '@type':
              'ListItem',

            position: 1,

            name:
              'AZEXAI',

            item:
              `${SITE}/`
          },

          {
            '@type':
              'ListItem',

            position: 2,

            name:
              c.name,

            item:
              `${SITE}/?category=${encodeURIComponent(c.key)}`
          },

          {
            '@type':
              'ListItem',

            position: 3,

            name:
              post.title,

            item:
              url
          }

        ]
      }

    ]
  };
}

function replaceOnce(
  html,
  regex,
  replacement
) {
  return html.replace(
    regex,
    replacement
  );
}

function makePage(
  template,
  post,
  related,
  slug
) {
  const url =
    `${SITE}/article/${encodeURIComponent(slug)}`;

  const desc =
    excerpt(
      post.content,
      post.title
    );

  const img =
    image(post);

  const title =
    `${post.title} — AZEXAI`;

  const json =
    JSON.stringify(
      structuredData(
        post,
        slug
      )
    ).replace(
      /</g,
      '\\u003c'
    );

  let html =
    template;

  html =
    replaceOnce(
      html,
      /<title>[\s\S]*?<\/title>/i,
      `<title>${esc(title)}</title>`
    );

  html =
    replaceOnce(
      html,
      /<meta id="metaDescription"[^>]*>/i,
      `<meta id="metaDescription" name="description" content="${esc(desc)}">`
    );

  html =
    replaceOnce(
      html,
      /<meta id="metaRobots"[^>]*>/i,
      `<meta id="metaRobots" name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">`
    );

  html =
    replaceOnce(
      html,
      /<link id="canonical"[^>]*>/i,
      `<link id="canonical" rel="canonical" href="${esc(url)}">`
    );

  const metas = [
    ['ogType', 'article'],
    ['ogTitle', title],
    ['ogDescription', desc],
    ['ogImage', img],
    ['ogImageAlt', post.title],
    ['ogUrl', url],
    ['twTitle', title],
    ['twDescription', desc],
    ['twImage', img],
    ['twImageAlt', post.title],
    ['metaAuthor',
      post.author?.displayName ||
      'AZEXAI'],
    ['articleAuthor',
      post.author?.displayName ||
      'AZEXAI'],
    ['ogPublished',
      iso(
        post.published ||
        post.updated
      )],
    ['ogModified',
      iso(
        post.updated ||
        post.published
      )],
    ['ogSection',
      category(post).name]
  ];

  for (
    const [id, value]
    of metas
  ) {
    html =
      html.replace(
        new RegExp(
          `<meta id="${id}"[^>]*>`,
          'i'
        ),
        `<meta id="${id}" content="${esc(value)}">`
      );
  }

  html =
    html.replace(
      '</head>',
      `<script type="application/ld+json" id="jsonld">${json}</script>
</head>`
    );

  const body =
    articleMarkup(
      post,
      related,
      slug
    );

  html =
    html.replace(
      /<main id="app"[^>]*>[\s\S]*?<\/main>/i,
      `<main id="app" data-prerendered="true">${body}</main>`
    );

  return html;
}

function homeMarkup(
  template,
  posts,
  slugMap
) {
  const latest =
    posts.slice(0, 24);

  let html =
    template;

  const first =
    posts[0];

  if (!first) {
    return html;
  }

  const img =
    image(first);

  const c =
    category(first);

  const desc =
    excerpt(
      first.content,
      first.title
    );

  const slug =
    slugMap.get(
      String(first.id)
    );

  const feature = `
<article class="feature feature-centered">

  <div class="feature-media">

    ${
      img
        ? `<img
            src="${esc(img)}"
            alt="${esc(first.title)}"
            fetchpriority="high"
            decoding="async">`
        : ''
    }

  </div>

  <div class="feature-copy">

    <div class="feature-kicker">
      <span>${esc(c.name)}</span>
      <i></i>
      <span>
        ${esc(
          dateFmt(
            first.published ||
            first.updated
          )
        )}
      </span>
    </div>

    <h2>
      <a
        href="/article/${encodeURIComponent(slug)}">
        ${esc(first.title)}
      </a>
    </h2>

    <p>
      ${esc(desc)}
    </p>

    <div class="feature-bottom">

      <span class="feature-readtime">
        ${readTime(
          first.content || ''
        )}
        MIN READ
      </span>

      <a
        class="btn"
        href="/article/${encodeURIComponent(slug)}">
        Read Story →
      </a>

    </div>

  </div>

</article>`;

  return html.replace(
    /<main id="app"[^>]*>[\s\S]*?<\/main>/i,

    `<main id="app" data-prerendered="true">

      <section class="hero">

        <div class="wrap hero-inner">

          <div>

            <div class="kicker">
              AZEXAI / TECHNOLOGY PUBLICATION
            </div>

            <h1>
              Technology, intelligence, and the systems shaping tomorrow.
            </h1>

            <p>
              A serious editorial view of artificial intelligence,
              machines, software, hardware, and the ideas changing
              how we live and work.
            </p>

          </div>

          <div class="hero-meta">

            <span>
              Independent / Real articles
            </span>

            <span>
              ${posts.length} published
            </span>

          </div>

        </div>

      </section>

      <section class="section">

        <div class="wrap">

          <div class="section-head">

            <h2>Featured</h2>

            <span class="label">
              Latest signal
            </span>

          </div>

          ${feature}

        </div>

      </section>

      <section class="section alt">

        <div class="wrap">

          <div class="section-head">

            <h2>Latest Stories</h2>

            <span class="label">
              The newest work
            </span>

          </div>

          <div class="grid">

            ${latest
              .map(post =>
                card(
                  post,
                  slugMap.get(
                    String(post.id)
                  )
                )
              )
              .join('')}

          </div>

        </div>

      </section>

    </main>`
  );
}

function sitemap(
  posts,
  slugMap
) {
  const urls = [
    `${SITE}/`,
    ...posts.map(
      post =>
        `${SITE}/article/${encodeURIComponent(
          slugMap.get(
            String(post.id)
          )
        )}`
    )
  ];

  const lines =
    urls
      .map(
        url =>
          `<url><loc>${esc(url)}</loc></url>`
      )
      .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lines}
</urlset>
`;
}

async function main() {
  console.log('AZEXAI build started.');

  const posts =
    await fetchPosts();

  console.log(
    `AZEXAI build: ${posts.length} posts`
  );

  const slugMap =
    new Map();

  const used =
    new Set();

  for (const post of posts) {
    const base =
      nativeSlug(post);

    let slug =
      base;

    let counter =
      2;

    while (
      used.has(slug)
    ) {
      slug =
        `${base}-${counter++}`;
    }

    used.add(slug);

    slugMap.set(
      String(post.id),
      slug
    );
  }

  await fs.writeFile(
    path.join(
      ROOT,
      'index.html'
    ),
    homeMarkup(
      INDEX_HTML,
      posts,
      slugMap
    )
  );

  await fs.rm(
    path.join(
      ROOT,
      'article'
    ),
    {
      recursive: true,
      force: true
    }
  );

  for (const post of posts) {
    const slug =
      slugMap.get(
        String(post.id)
      );

    const related =
      posts
        .filter(
          candidate =>
            candidate.id !== post.id &&
            (
              category(candidate).key ===
                category(post).key ||
              labels(candidate).some(
                label =>
                  labels(post).includes(label)
              )
            )
        )
        .map(
          candidate => ({
            post: candidate,
            slug: slugMap.get(
              String(candidate.id)
            )
          })
        );

    const directory =
      path.join(
        ROOT,
        'article',
        slug
      );

    await fs.mkdir(
      directory,
      {
        recursive: true
      }
    );

    const page =
      makePage(
        INDEX_HTML,
        post,
        related,
        slug
      );

    await fs.writeFile(
      path.join(
        directory,
        'index.html'
      ),
      page
    );
  }

  await fs.writeFile(
    path.join(
      ROOT,
      'sitemap.xml'
    ),
    sitemap(
      posts,
      slugMap
    )
  );

  await fs.writeFile(
    path.join(
      ROOT,
      'robots.txt'
    ),
    `User-agent: *
Allow: /
Disallow: /?search=
Sitemap: ${SITE}/sitemap.xml
`
  );

  await fs.writeFile(
    path.join(
      ROOT,
      'CNAME'
    ),
    'azexai.com\n'
  );

  console.log(
    `Generated ${posts.length} static article pages.`
  );

  console.log(
    'AZEXAI build completed successfully.'
  );
}

await main();
