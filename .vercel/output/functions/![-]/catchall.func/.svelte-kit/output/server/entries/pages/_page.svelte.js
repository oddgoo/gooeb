import { a as attr } from "../../chunks/attributes.js";
import { e as escape_html } from "../../chunks/escaping.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let code = "";
    $$renderer2.push(`<div class="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gooeb-50 to-white"><div class="text-center mb-10"><h1 class="text-5xl font-bold text-gooeb-600 mb-2">The Gooeb</h1> <p class="text-gray-500 text-lg">Bond with friends at the party</p></div> <div class="w-full max-w-sm"><form class="space-y-6"><div><label for="code" class="block text-sm font-medium text-gray-700 mb-2 text-center">Enter your mask code</label> <input id="code" type="text"${attr("value", code)} placeholder="XXXX" maxlength="4" autocomplete="off" autocapitalize="characters" class="w-full text-center text-4xl tracking-[0.5em] font-mono font-bold p-4 border-2 border-gray-200 rounded-2xl uppercase focus:border-gooeb-500 focus:outline-none transition-colors placeholder:text-gray-300 placeholder:tracking-[0.5em]"/> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div> <button type="submit"${attr("disabled", code.length !== 4, true)} class="btn-primary w-full text-lg">${escape_html("Enter the Party")}</button></form> <div class="mt-8 text-center"><p class="text-gray-400 text-sm">Or tap your mask's NFC tag</p></div></div> <div class="mt-auto pt-8"><p class="text-gray-300 text-xs">Look for the 4-character code on your mask</p></div></div>`);
  });
}
export {
  _page as default
};
