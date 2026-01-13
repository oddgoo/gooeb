import { _ as store_get, a2 as unsubscribe_stores } from "../../../../chunks/index2.js";
import { p as page } from "../../../../chunks/stores.js";
import { a as attr } from "../../../../chunks/attributes.js";
import { e as escape_html } from "../../../../chunks/escaping.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let layoutData = store_get($$store_subs ??= {}, "$page", page).data;
    let guest = layoutData.guest;
    let maskCode = layoutData.maskCode;
    $$renderer2.push(`<div class="p-4 max-w-md mx-auto"><div class="card mb-6"><div class="flex items-center gap-4"><img${attr("src", guest.photo_url)}${attr("alt", guest.nickname)} class="w-20 h-20 rounded-full object-cover border-4 border-gooeb-500"/> <div><h1 class="text-2xl font-bold text-gray-900">${escape_html(guest.nickname)}</h1> <p class="text-gray-500">Code: <span class="font-mono font-bold">${escape_html(maskCode)}</span></p></div></div></div> <div class="card mb-6"><h2 class="text-lg font-semibold text-gray-900 mb-3">Your Stats</h2> <div class="grid grid-cols-2 gap-4"><div class="bg-gooeb-50 rounded-xl p-4 text-center"><p class="text-3xl font-bold text-gooeb-600">0</p> <p class="text-sm text-gray-500">Bonds</p></div> <div class="bg-gray-100 rounded-xl p-4 text-center"><p class="text-3xl font-bold text-gray-600">0</p> <p class="text-sm text-gray-500">Pending</p></div></div></div> <div class="card"><h2 class="text-lg font-semibold text-gray-900 mb-3">Your Bonds</h2> <div class="text-center py-8 text-gray-400"><div class="text-4xl mb-2">🤝</div> <p>No bonds yet.</p> <p class="text-sm">Go to the Bond tab to start connecting!</p></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
