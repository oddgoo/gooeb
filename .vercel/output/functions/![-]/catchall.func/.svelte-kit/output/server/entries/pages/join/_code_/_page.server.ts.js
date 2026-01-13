import { redirect, error } from "@sveltejs/kit";
import { c as createServerClient, g as getGuestByToken } from "../../../../chunks/server.js";
const load = async ({ params, cookies }) => {
  const supabase = createServerClient();
  const code = params.code.toUpperCase();
  const authToken = cookies.get("gooeb_auth");
  if (authToken) {
    const existingGuest = await getGuestByToken(supabase, authToken);
    if (existingGuest) {
      const { data: targetMaskCode } = await supabase.from("mask_codes").select("id, is_claimed").eq("code", code).single();
      const maskCodeData = targetMaskCode;
      if (maskCodeData?.is_claimed) {
        const { data: targetGuest } = await supabase.from("guests").select("id").eq("mask_code_id", maskCodeData.id).single();
        const guestData = targetGuest;
        if (guestData && guestData.id !== existingGuest.id) {
          redirect(303, `/bond?invite=${code}`);
        }
      }
      redirect(303, "/me");
    }
  }
  const { data: maskCode, error: codeError } = await supabase.from("mask_codes").select("id, is_claimed, event_id").eq("code", code).single();
  const maskCodeResult = maskCode;
  if (codeError || !maskCodeResult) {
    error(404, {
      message: "Invalid mask code. Please check your code and try again."
    });
  }
  if (maskCodeResult.is_claimed) {
    error(400, {
      message: "This code has already been claimed. Ask for help at the registration desk."
    });
  }
  return {
    code,
    maskCodeId: maskCodeResult.id,
    eventId: maskCodeResult.event_id
  };
};
export {
  load
};
