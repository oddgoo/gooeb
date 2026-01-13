import { _ as store_get, a2 as unsubscribe_stores } from "../../../../chunks/index2.js";
import { p as page } from "../../../../chunks/stores.js";
import { a as attr } from "../../../../chunks/attributes.js";
import { e as escape_html } from "../../../../chunks/escaping.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let layoutData = store_get($$store_subs ??= {}, "$page", page).data;
    let maskCode = layoutData.maskCode;
    let targetCode = "";
    $$renderer2.push(`<div class="p-4 max-w-md mx-auto"><div class="text-center mb-8 pt-8"><h1 class="text-2xl font-bold text-gray-900 mb-2">Bond with Someone</h1> <p class="text-gray-500">Enter their mask code to send a bond invite</p></div> <form class="space-y-4"><div><input type="text"${attr("value", targetCode)} placeholder="XXXX" maxlength="4" autocomplete="off" autocapitalize="characters" class="w-full text-center text-4xl tracking-[0.5em] font-mono font-bold p-4 border-2 border-gray-200 rounded-2xl uppercase focus:border-gooeb-500 focus:outline-none transition-colors placeholder:text-gray-300 placeholder:tracking-[0.5em]"/></div> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <button type="submit"${attr("disabled", targetCode.length !== 4, true)} class="btn-primary w-full text-lg">${escape_html("Send Bond Invite")}</button></form> <div class="mt-8 text-center"><p class="text-gray-400 text-sm">Your code:</p> <p class="font-mono font-bold text-2xl text-gooeb-600">${escape_html(maskCode)}</p> <p class="text-gray-400 text-xs mt-1">Share this with others to bond with you</p></div> <div class="mt-8"><h2 class="text-lg font-semibold text-gray-900 mb-3">Pending Invites</h2> <div class="card text-center py-6 text-gray-400"><p>No pending invites</p></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
