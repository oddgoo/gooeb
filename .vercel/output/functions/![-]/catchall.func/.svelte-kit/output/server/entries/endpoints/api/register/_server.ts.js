import { error, json } from "@sveltejs/kit";
import { c as createServerClient } from "../../../../chunks/server.js";
import { v4 } from "uuid";
const POST = async ({ request, cookies }) => {
  const supabase = createServerClient();
  let body;
  try {
    body = await request.json();
  } catch {
    error(400, { message: "Invalid request body" });
  }
  const { nickname, photoDataUrl, maskCodeId, eventId } = body;
  if (!nickname || typeof nickname !== "string" || nickname.trim().length === 0) {
    error(400, { message: "Nickname is required" });
  }
  if (nickname.length > 20) {
    error(400, { message: "Nickname must be 20 characters or less" });
  }
  if (!photoDataUrl || typeof photoDataUrl !== "string" || !photoDataUrl.startsWith("data:image")) {
    error(400, { message: "Valid photo is required" });
  }
  if (!maskCodeId || !eventId) {
    error(400, { message: "Missing registration context" });
  }
  const { data: maskCodeData, error: codeError } = await supabase.from("mask_codes").select("id, is_claimed, event_id").eq("id", maskCodeId).single();
  const maskCode = maskCodeData;
  if (codeError || !maskCode) {
    error(404, { message: "Invalid mask code" });
  }
  if (maskCode.is_claimed) {
    error(409, { message: "This code has already been claimed" });
  }
  if (maskCode.event_id !== eventId) {
    error(400, { message: "Event mismatch" });
  }
  const authToken = v4();
  const guestId = v4();
  const base64Match = photoDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!base64Match) {
    error(400, { message: "Invalid photo format" });
  }
  const [, imageType, base64Data] = base64Match;
  const photoBuffer = Buffer.from(base64Data, "base64");
  if (photoBuffer.length > 2 * 1024 * 1024) {
    error(400, { message: "Photo is too large. Please try a smaller image." });
  }
  const photoPath = `guests/${guestId}.${imageType === "jpeg" ? "jpg" : imageType}`;
  const { error: uploadError } = await supabase.storage.from("photos").upload(photoPath, photoBuffer, {
    contentType: `image/${imageType}`,
    upsert: false
  });
  if (uploadError) {
    console.error("Photo upload error:", uploadError);
    error(500, { message: "Failed to upload photo. Please try again." });
  }
  const {
    data: { publicUrl }
  } = supabase.storage.from("photos").getPublicUrl(photoPath);
  const { error: claimError, count: claimCount } = await supabase.from("mask_codes").update({
    is_claimed: true,
    claimed_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", maskCodeId).eq("is_claimed", false);
  if (claimError || claimCount === 0) {
    await supabase.storage.from("photos").remove([photoPath]);
    error(409, { message: "This code was just claimed by someone else. Please get a new code." });
  }
  const { error: guestError } = await supabase.from("guests").insert({
    id: guestId,
    event_id: eventId,
    mask_code_id: maskCodeId,
    nickname: nickname.trim(),
    photo_url: publicUrl,
    auth_token: authToken
  });
  if (guestError) {
    console.error("Guest creation error:", guestError);
    await supabase.from("mask_codes").update({ is_claimed: false, claimed_at: null }).eq("id", maskCodeId);
    await supabase.storage.from("photos").remove([photoPath]);
    error(500, { message: "Failed to create your profile. Please try again." });
  }
  cookies.set("gooeb_auth", authToken, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    // 1 week
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production"
  });
  return json({
    guestId,
    authToken
  });
};
export {
  POST
};
