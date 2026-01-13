import "clsx";
import { _ as store_get, $ as ensure_array_like, a0 as attr_class, a1 as stringify, a2 as unsubscribe_stores } from "../../../chunks/index2.js";
import { p as page } from "../../../chunks/stores.js";
import { a as attr } from "../../../chunks/attributes.js";
import { e as escape_html } from "../../../chunks/escaping.js";
function TabNav($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const tabs = [
      {
        path: "/me",
        label: "Me",
        icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      },
      {
        path: "/bond",
        label: "Bond",
        icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      },
      {
        path: "/web",
        label: "Web",
        icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      }
    ];
    let currentPath = store_get($$store_subs ??= {}, "$page", page).url.pathname;
    $$renderer2.push(`<nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb"><div class="flex justify-around max-w-md mx-auto"><!--[-->`);
    const each_array = ensure_array_like(tabs);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let tab = each_array[$$index];
      $$renderer2.push(`<a${attr("href", tab.path)}${attr_class(`flex flex-col items-center py-3 px-6 transition-colors ${stringify(currentPath === tab.path ? "text-gooeb-600" : "text-gray-400 hover:text-gray-600")}`)}><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"${attr("d", tab.icon)}></path></svg> <span class="text-xs mt-1 font-medium">${escape_html(tab.label)}</span></a>`);
    }
    $$renderer2.push(`<!--]--></div></nav>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _layout($$renderer, $$props) {
  let { children, data } = $$props;
  $$renderer.push(`<div class="min-h-screen pb-20 bg-gray-50">`);
  children($$renderer);
  $$renderer.push(`<!----></div> `);
  TabNav($$renderer);
  $$renderer.push(`<!---->`);
}
export {
  _layout as default
};
