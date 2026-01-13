import "clsx";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    $$renderer2.push(`<div class="min-h-screen flex items-center justify-center bg-gooeb-50"><div class="text-center"><div class="w-12 h-12 border-4 border-gooeb-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div> <p class="text-gray-600">Preparing your registration...</p></div></div>`);
  });
}
export {
  _page as default
};
