// Builds a single DOM element (with a "view" wrapper) from an HTML string.
export function el(html) {
  const wrap = document.createElement("div");
  wrap.className = "view";
  wrap.innerHTML = html.trim();
  return wrap;
}

export function qs(root, sel) {
  return root.querySelector(sel);
}

export function qsa(root, sel) {
  return Array.from(root.querySelectorAll(sel));
}
