import { _ as store_get, a2 as unsubscribe_stores } from "../../../chunks/index2.js";
import { p as page } from "../../../chunks/stores.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import { a as attr } from "../../../chunks/attributes.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/state.svelte.js";
import { w as writable } from "../../../chunks/index.js";
import { a as ssr_context } from "../../../chunks/context.js";
import "clsx";
import { e as escape_html } from "../../../chunks/escaping.js";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
function getInitialAuth() {
  {
    return { guestId: null, authToken: null, isAuthenticated: false };
  }
}
function createAuthStore() {
  const { subscribe, set, update } = writable(getInitialAuth());
  return {
    subscribe,
    /**
     * Set auth state (after registration or login)
     */
    setAuth(guestId, authToken) {
      const newState = { guestId, authToken, isAuthenticated: true };
      set(newState);
    },
    /**
     * Clear auth state (logout)
     */
    clearAuth() {
      set({ guestId: null, authToken: null, isAuthenticated: false });
    },
    /**
     * Initialize from cookie (for SSR hydration)
     */
    initFromCookie(guestId, authToken) {
      const currentState = getInitialAuth();
      if (!currentState.isAuthenticated && authToken) {
        this.setAuth(guestId, authToken);
      }
    }
  };
}
const auth = createAuthStore();
auth.setAuth.bind(auth);
auth.clearAuth.bind(auth);
function PhotoCapture($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let isCapturing = false;
    onDestroy(() => {
    });
    $$renderer2.push(`<div class="relative aspect-square bg-gray-900 rounded-2xl overflow-hidden">`);
    {
      $$renderer2.push("<!--[!-->");
      {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<video autoplay playsinline muted class="w-full h-full object-cover scale-x-[-1]"></video> <div class="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-4"><button type="button" class="bg-black/30 backdrop-blur p-3 rounded-full text-white hover:bg-black/50 transition-colors" aria-label="Switch camera"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg></button> <button type="button"${attr("disabled", isCapturing, true)} class="w-16 h-16 bg-white rounded-full border-4 border-gooeb-500 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Take photo"></button> <label class="bg-black/30 backdrop-blur p-3 rounded-full text-white cursor-pointer hover:bg-black/50 transition-colors" aria-label="Upload photo"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> <input type="file" accept="image/*" class="hidden"/></label></div> `);
        {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]-->`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let nickname = "";
    store_get($$store_subs ??= {}, "$page", page).url.searchParams.get("maskCodeId");
    store_get($$store_subs ??= {}, "$page", page).url.searchParams.get("eventId");
    const code = store_get($$store_subs ??= {}, "$page", page).url.searchParams.get("code");
    $$renderer2.push(`<div class="min-h-screen bg-gradient-to-b from-gooeb-50 to-white p-4 safe-area-pt"><div class="max-w-md mx-auto pt-4"><div class="text-center mb-6"><h1 class="text-2xl font-bold text-gray-900">Create Your Profile</h1> `);
    if (
      // Clear error when inputs change
      code
    ) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="text-gray-500 mt-1">Mask code: <span class="font-mono font-bold text-gooeb-600">${escape_html(code)}</span></p>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div> <form class="space-y-6"><div><p class="block text-sm font-medium text-gray-700 mb-2">Your Photo</p> `);
    PhotoCapture($$renderer2);
    $$renderer2.push(`<!----> <p class="text-xs text-gray-400 mt-2 text-center">This will be shown on the network graph</p></div> <div><label for="nickname" class="block text-sm font-medium text-gray-700 mb-2">Nickname</label> <input id="nickname" type="text"${attr("value", nickname)} placeholder="What should we call you?" maxlength="20" autocomplete="off" class="input-field"/> <p class="text-xs text-gray-400 mt-1">Max 20 characters</p></div> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <button type="submit"${attr("disabled", !nickname.trim() || true, true)} class="btn-primary w-full text-lg">`);
    {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`Join the Party!`);
    }
    $$renderer2.push(`<!--]--></button></form> <div class="mt-6 text-center"><a href="/" class="text-gray-500 hover:text-gray-700 text-sm">← Use a different code</a></div></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
