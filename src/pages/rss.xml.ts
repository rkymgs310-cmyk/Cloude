import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async (context) => {
  const posts = (await getCollection('posts', ({ data }) => !data.draft))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const siteUrl = context.site?.toString().replace(/\/$/, '') ?? 'https://example.com';

  const itemsXml = posts
    .map(
      (post) => `    <item>
      <title><![CDATA[${post.data.title}]]></title>
      <link>${siteUrl}/posts/${post.slug}/</link>
      <guid isPermaLink="true">${siteUrl}/posts/${post.slug}/</guid>
      <description><![CDATA[${post.data.description}]]></description>
      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>
      ${post.data.tags.map((tag) => `<category>${tag}</category>`).join('\n      ')}
    </item>`
    )
    .join('\n');

  const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ガジェット比較ラボ</title>
    <link>${siteUrl}/</link>
    <description>AIツール・スマート家電・便利ガジェットをスペック比較・レビューするブログです。</description>
    <language>ja</language>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${itemsXml}
  </channel>
</rss>`;

  return new Response(rssFeed, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
