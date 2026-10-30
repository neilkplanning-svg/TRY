/**
 * אפשרות 1 — Pages CMS.
 * הלקוח עורך בממשק של Pages CMS → נשמר commit לקבצי content/*.json בריפו
 * → GitHub Pages מפרסם מחדש → כאן אנחנו רק קוראים את ה-JSON.
 */

const memo = new Map();

export function loadContent(name) {
  if (!memo.has(name)) {
    // no-cache = revalidate with the server on every visit, so a fresh commit shows up
    // as soon as GitHub Pages finishes deploying (instead of waiting for the browser cache).
    const request = fetch(`content/${name}.json`, { cache: "no-cache" }).then((res) => {
      if (!res.ok) throw new Error(`content/${name}.json → HTTP ${res.status}`);
      return res.json();
    });
    memo.set(name, request);
  }
  return memo.get(name);
}

/** Load several content files in parallel; a single broken file doesn't take the page down. */
export async function loadAll(names) {
  const results = await Promise.allSettled(names.map(loadContent));
  return Object.fromEntries(
    names.map((name, i) => {
      const r = results[i];
      if (r.status === "rejected") console.error("[cms]", r.reason);
      return [name, r.status === "fulfilled" ? r.value : null];
    })
  );
}
