import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const BLOG_ID =
  process.env.BLOGGER_BLOG_ID ||
  '4263033619836681299';

const SITE =
  (
    process.env.SITE_URL ||
    'https://azexai.com'
  ).replace(/\/$/, '');

const INDEX_FILE =
  path.join(ROOT, 'index.html');

const INDEX_HTML =
  await fs.readFile(
    INDEX_FILE,
    'utf8'
  );

const API_KEY =
  process.env.BLOGGER_API_KEY ||
  extractKey(INDEX_HTML);

const API =
  `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts`;

if (!API_KEY) {
  throw new Error(
    'Missing BLOGGER_API_KEY'
  );
}


/* =========================================================
   HELPERS
   ========================================================= */

function extractKey(html) {

  const patterns = [

    /API_KEY\s*:\s*['"]([^'"]+)['"]/i,

    /BLOGGER_API_KEY\s*[:=]\s*['"]([^'"]+)['"]/i,

    /AIza[0-9A-Za-z_-]{20,}/

  ];

  for (
    const pattern
    of patterns
  ) {

    const match =
      html.match(pattern);

    if (match) {
      return match[1] || match[0];
    }

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


/*
  Fallback slug generator.

  This is ONLY used when Blogger does not
  provide a usable URL slug.
*/

function slugify(value = '') {

  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /&/g,
      ' and '
    )
    .replace(
      /[^a-z0-9]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    )
    .slice(0, 100)
    || 'article';
}


/* =========================================================
   BLOGGER SLUG
   ========================================================= */

/*
  IMPORTANT:

  Blogger's own URL is the source of truth.

  Example:

  https://azexai.blogspot.com/2026/09/
  amd-free-ai-api-deepseek-qwen-2026.html

  becomes:

  amd-free-ai-api-deepseek-qwen-2026

  We DO NOT slugify this value again.

  This guarantees that the static page and
  client-side router use the same slug.
*/

function bloggerSlug(post) {

  try {

    if (post?.url) {

      const url =
        new URL(post.url);

      const parts =
        url.pathname
          .split('/')
          .filter(Boolean);

      const last =
        parts[parts.length - 1] ||
        '';

      const decoded =
        decodeURIComponent(
          last
        ).trim();

      const clean =
        decoded.replace(
          /\.html$/i,
          ''
        );

      if (
        clean &&
        !/^\d+$/.test(clean)
      ) {

        return clean;

      }

    }

  } catch {}

  return slugify(
    post?.title || 'article'
  );
}


/* =========================================================
   TEXT
   ========================================================= */

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

    .replace(
      /<[^>]+>/g,
      ' '
    )

    .replace(
      /&nbsp;/gi,
      ' '
    )

    .replace(
      /&amp;/gi,
      '&'
    )

    .replace(
      /&quot;/gi,
      '"'
    )

    .replace(
      /&#39;/gi,
      "'"
    )

    .replace(
      /&lt;/gi,
      '<'
    )

    .replace(
      /&gt;/gi,
      '>'
    )

    .replace(
      /\s+/g,
      ' '
    )

    .trim();
}


function excerpt(
  html,
  title = ''
) {

  const paragraphs = [
    ...String(html || '')
      .matchAll(
        /<p\b[^>]*>([\s\S]*?)<\/p>/gi
      )
  ]

    .map(
      match =>
        strip(match[1])
    )

    .filter(
      text =>
        text.length > 70
    );


  let text =
    paragraphs[0] ||
    strip(html) ||
    'Technology, intelligence, and the systems shaping tomorrow.';


  if (
    title &&
    text
      .toLowerCase()
      .startsWith(
        title.toLowerCase()
      )
  ) {

    text =
      text
        .slice(title.length)
        .trim();

  }


  if (
    text.length > 160
  ) {

    return (
      text
        .slice(0, 157)
        .replace(
          /\s+\S*$/,
          ''
        ) +
      '…'
    );

  }

  return text;
}


/* =========================================================
   IMAGE
   ========================================================= */

function image(post) {

  const apiImages =
    Array.isArray(
      post.images
    )
      ? post.images
          .map(
            item =>
              item?.url ||
              item
          )
          .filter(Boolean)
      : [];


  const bodyImages = [
    ...String(
      post.content || ''
    ).matchAll(
      /<img[^>]+src=["']([^"']+)["']/gi
    )
  ].map(
    match => match[1]
  );


  return [
    ...apiImages,
    ...bodyImages
  ].find(
    value =>
      /^https?:\/\//i.test(
        value
      )
  ) || '';
}


/* =========================================================
   LABELS / CATEGORY
   ========================================================= */

function labels(post) {

  return Array.isArray(
    post.labels
  )
    ? post.labels
    : [];
}


function category(post) {

  const values =
    labels(post).map(
      value =>
        String(value)
          .toLowerCase()
          .trim()
    );


  const map = [

    [
      'ai',
      [
        'ai',
        'artificial intelligence',
        'machine learning',
        'llm'
      ]
    ],

    [
      'robotics',
      [
        'robotics',
        'robots',
        'robot'
      ]
    ],

    [
      'hardware',
      [
        'hardware',
        'devices',
        'chips',
        'computers'
      ]
    ],

    [
      'software',
      [
        'software',
        'apps',
        'saas',
        'developer tools'
      ]
    ],

    [
      'future-tech',
      [
        'future tech',
        'emerging technology',
        'future technology'
      ]
    ],

    [
      'guides',
      [
        'guide',
        'guides',
        'how to',
        'tutorial'
      ]
    ],

    [
      'reviews',
      [
        'review',
        'reviews'
      ]
    ],

    [
      'ethics',
      [
        'ethics',
        'ai ethics'
      ]
    ]

  ];


  for (
    const [key, aliases]
    of map
  ) {

    if (
      values.some(
        value =>
          aliases.includes(value)
      )
    ) {

      return {

        key,

        name:
          key === 'ai'
            ? 'AI'
            : key
                .replace(
                  '-',
                  ' '
                )
                .replace(
                  /\b\w/g,
                  char =>
                    char.toUpperCase()
                )

      };

    }

  }


  return {

    key: '',

    name:
      labels(post)[0] ||
      'Technology'

  };
}


/* =========================================================
   SANITIZE
   ========================================================= */

function sanitizeBody(
  html = ''
) {

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


/* =========================================================
   DATE
   ========================================================= */

function dateFmt(value) {

  try {

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }

    return new Intl.DateTimeFormat(
      'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }
    ).format(date);

  } catch {

    return '';

  }
}


function iso(value) {

  try {

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return '';
    }

    return date.toISOString();

  } catch {

    return '';

  }
}


function readTime(
  html = ''
) {

  const words =
    strip(html)
      .split(/\s+/)
      .filter(Boolean)
      .length;

  return Math.max(
    1,
    Math.ceil(
      words / 220
    )
  );
}


/* =========================================================
   FETCH BLOGGER POSTS
   ========================================================= */

async function fetchPosts() {

  const all = [];

  let pageToken = '';


  do {

    const url =
      new URL(API);


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
      await fetch(
        url,
        {
          headers: {
            accept:
              'application/json'
          }
        }
      );


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
      data.nextPageToken ||
      '';


  } while (pageToken);


  /*
    Remove duplicate Blogger IDs.
  */

  const unique =
    new Map();


  for (
    const post
    of all
  ) {

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
        b.published ||
        b.updated
      ) -
      new Date(
        a.published ||
        a.updated
      )
  );

}


/* =========================================================
   CARD
   ========================================================= */

function card(
  post,
  slug
) {

  const c =
    category(post);

  const img =
    image(post);

  const desc =
    excerpt(
      post.content,
      post.title
    );


  return `
<article class="card">

  <a
    class="card-media"
    href="/article/${encodeURIComponent(slug)}/"
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

  <div class="card-body">

    <div class="tag">
      ${esc(c.name)}
    </div>

    <h3>

      <a
        href="/article/${encodeURIComponent(slug)}/">

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
        ${readTime(
          post.content || ''
        )}
        min read
      </span>

    </div>

  </div>

</article>`;
}


/* =========================================================
   ARTICLE STRUCTURED DATA
   ========================================================= */

function structuredData(
  post,
  slug
) {

  const c =
    category(post);

  const url =
    `${SITE}/article/${encodeURIComponent(slug)}/`;

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


  const graph = [

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

      isAccessibleForFree:
        true,

      wordCount:
        strip(
          post.content || ''
        )
          .split(/\s+/)
          .filter(Boolean)
          .length,

      ...(img
        ? {
            image: [img],
            thumbnailUrl: img
          }
        : {})
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

  ];


  return {

    '@context':
      'https://schema.org',

    '@graph':
      graph

  };

}


/* =========================================================
   ARTICLE PAGE
   ========================================================= */

function articleMarkup(
  post,
  related,
  slug
) {

  const c =
    category(post);

  const img =
    image(post);

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
      .map(
        item =>
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

      ${
        c.key
          ? `
            <a
              href="/?category=${encodeURIComponent(c.key)}">

              ${esc(c.name)}

            </a>
          `
          : `
            <span>
              ${esc(c.name)}
            </span>
          `
      }

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
        post.updated !==
          post.published

          ? `
            <span>
              Updated
              ${esc(
                dateFmt(
                  post.updated
                )
              )}
            </span>
          `
          : ''
      }


      ${
        post.author?.displayName

          ? `
            <span>
              By
              ${esc(
                post.author.displayName
              )}
            </span>
          `

          : ''
      }


      <span>
        ${Math.max(
          1,
          Math.ceil(
            words / 220
          )
        )}
        min read
      </span>

    </div>

  </header>


  ${
    img
      ? `
        <div class="article-hero">

          <img
            src="${esc(img)}"
            alt="${esc(post.title)}"
            fetchpriority="high"
            decoding="async">

        </div>
      `
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
      ? `
        <section class="related">

          <div class="section-head">

            <h2>
              Related Stories
            </h2>

            <span class="label">
              ${esc(c.name)}
            </span>

          </div>

          <div class="grid">

            ${relatedHtml}

          </div>

        </section>
      `
      : ''
  }

</article>`;
}


/* =========================================================
   STATIC ARTICLE HTML
   ========================================================= */

function makePage(
  template,
  post,
  related,
  slug
) {

  const url =
    `${SITE}/article/${encodeURIComponent(slug)}/`;

  const desc =
    excerpt(
      post.content,
      post.title
    );

  const img =
    image(post);

  const title =
    `${post.title} — AZEXAI`;

  const author =
    post.author?.displayName ||
    'AZEXAI';


  const json =
    JSON.stringify(
      structuredData(
        post,
        slug
      )
    )
    .replace(
      /</g,
      '\\u003c'
    );


  let html =
    template;


  /*
    TITLE
  */

  html =
    html.replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${esc(title)}</title>`
    );


  /*
    DESCRIPTION
  */

  html =
    html.replace(
      /<meta id="metaDescription"[^>]*>/i,
      `<meta id="metaDescription" name="description" content="${esc(desc)}">`
    );


  /*
    ROBOTS
  */

  html =
    html.replace(
      /<meta id="metaRobots"[^>]*>/i,
      `<meta id="metaRobots" name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">`
    );


  /*
    CANONICAL
  */

  html =
    html.replace(
      /<link id="canonical"[^>]*>/i,
      `<link id="canonical" rel="canonical" href="${esc(url)}">`
    );


  /*
    OPEN GRAPH / TWITTER
  */

  const metas = [

    [
      'ogType',
      'article'
    ],

    [
      'ogTitle',
      title
    ],

    [
      'ogDescription',
      desc
    ],

    [
      'ogImage',
      img
    ],

    [
      'ogImageAlt',
      post.title
    ],

    [
      'ogUrl',
      url
    ],

    [
      'twTitle',
      title
    ],

    [
      'twDescription',
      desc
    ],

    [
      'twImage',
      img
    ],

    [
      'twImageAlt',
      post.title
    ],

    [
      'metaAuthor',
      author
    ],

    [
      'articleAuthor',
      author
    ],

    [
      'ogPublished',
      iso(
        post.published ||
        post.updated
      )
    ],

    [
      'ogModified',
      iso(
        post.updated ||
        post.published
      )
    ],

    [
      'ogSection',
      category(post).name
    ]

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


  /*
    JSON-LD

    Avoid duplicate generated
    scripts if build is run repeatedly.
  */

  html =
    html.replace(
      /<script id="jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/gi,
      ''
    );


  html =
    html.replace(
      '</head>',
      `<script id="jsonld" type="application/ld+json">${json}</script>
</head>`
    );


  /*
    ARTICLE BODY

    Replace ONLY the app main area.
  */

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


/* =========================================================
   HOMEPAGE
   ========================================================= */

function homeMarkup(
  template,
  posts,
  slugMap
) {

  let html =
    template;


  const first =
    posts[0];


  /*
    No Blogger posts.
  */

  if (!first) {

    return html.replace(
      /<main id="app"[^>]*>[\s\S]*?<\/main>/i,

      `<main id="app" data-prerendered="true">

        <section class="section">

          <div class="wrap">

            <div class="notice center">

              <h2>
                No articles available.
              </h2>

              <p>
                Blogger returned no published posts.
              </p>

            </div>

          </div>

        </section>

      </main>`
    );

  }


  const firstSlug =
    slugMap.get(
      String(first.id)
    );


  const img =
    image(first);

  const c =
    category(first);

  const desc =
    excerpt(
      first.content,
      first.title
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

      <span>
        ${esc(c.name)}
      </span>

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
        href="/article/${encodeURIComponent(firstSlug)}/">

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
        href="/article/${encodeURIComponent(firstSlug)}/">

        Read Story →

      </a>

    </div>

  </div>

</article>`;


  /*
    IMPORTANT:

    Show ALL fetched posts.

    Not only 9.
    Not only 24.
  */

  const stories =
    posts
      .map(
        post =>
          card(
            post,
            slugMap.get(
              String(post.id)
            )
          )
      )
      .join('');


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

            <h2>
              Featured
            </h2>

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

            <h2>
              Latest Stories
            </h2>

            <span class="label">
              ${posts.length} stories
            </span>

          </div>


          <div class="grid">

            ${stories}

          </div>

        </div>

      </section>

    </main>`
  );
}


/* =========================================================
   SITEMAP
   ========================================================= */

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
        )}/`
    )

  ];


  const lines =
    urls
      .map(
        url =>
          `  <url>
    <loc>${esc(url)}</loc>
  </url>`
      )
      .join('\n');


  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${lines}
</urlset>
`;
}


/* =========================================================
   MAIN BUILD
   ========================================================= */

async function main() {

  console.log(
    'AZEXAI build started.'
  );


  /*
    FETCH ALL BLOGGER POSTS
  */

  const posts =
    await fetchPosts();


  console.log(
    `AZEXAI build: ${posts.length} posts`
  );


  /*
    CREATE ONE CONSISTENT SLUG MAP.

    Blogger ID
         ↓
    exact slug
         ↓
    static article URL
         ↓
    sitemap
         ↓
    homepage links
  */

  const slugMap =
    new Map();


  const used =
    new Set();


  for (
    const post
    of posts
  ) {

    const base =
      bloggerSlug(post);


    let slug =
      base;


    /*
      Only protect against a duplicate slug.

      Normal Blogger URLs should already
      be unique.
    */

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


    console.log(
      `SLUG: ${post.title} -> ${slug}`
    );

  }


  /* =======================================================
     WRITE PRERENDERED HOMEPAGE
     ======================================================= */

  await fs.writeFile(
    INDEX_FILE,
    homeMarkup(
      INDEX_HTML,
      posts,
      slugMap
    ),
    'utf8'
  );


  /* =======================================================
     REMOVE OLD ARTICLE DIRECTORY
     ======================================================= */

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


  /* =======================================================
     GENERATE EVERY ARTICLE
     ======================================================= */

  for (
    const post
    of posts
  ) {

    const slug =
      slugMap.get(
        String(post.id)
      );


    /*
      Related stories.

      Same category or
      shared labels.
    */

    const related =
      posts

        .filter(
          candidate =>
            String(candidate.id) !==
            String(post.id)
        )

        .filter(
          candidate => {

            const sameCategory =
              category(candidate).key &&
              category(candidate).key ===
              category(post).key;


            const sharedLabel =
              labels(candidate).some(
                label =>
                  labels(post)
                    .includes(label)
              );


            return (
              sameCategory ||
              sharedLabel
            );

          }
        )

        .map(
          candidate => ({
            post: candidate,

            slug:
              slugMap.get(
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
      page,
      'utf8'
    );

  }


  /* =======================================================
     SITEMAP
     ======================================================= */

  await fs.writeFile(
    path.join(
      ROOT,
      'sitemap.xml'
    ),
    sitemap(
      posts,
      slugMap
    ),
    'utf8'
  );


  /* =======================================================
     ROBOTS
     ======================================================= */

  await fs.writeFile(
    path.join(
      ROOT,
      'robots.txt'
    ),
`User-agent: *
Allow: /
Disallow: /?search=
Sitemap: ${SITE}/sitemap.xml
`,
    'utf8'
  );


  /* =======================================================
     CNAME
     ======================================================= */

  await fs.writeFile(
    path.join(
      ROOT,
      'CNAME'
    ),
    'azexai.com\n',
    'utf8'
  );


  /* =======================================================
     BUILD SUMMARY
     ======================================================= */

  console.log('');
  console.log(
    '======================================'
  );

  console.log(
    'AZEXAI BUILD COMPLETE'
  );

  console.log(
    '======================================'
  );

  console.log(
    `Posts fetched: ${posts.length}`
  );

  console.log(
    `Article pages: ${posts.length}`
  );

  console.log(
    `Site: ${SITE}`
  );

  console.log(
    'Sitemap: generated'
  );

  console.log(
    'Robots.txt: generated'
  );

  console.log(
    'CNAME: generated'
  );

  console.log(
    '======================================'
  );

}


await main();
