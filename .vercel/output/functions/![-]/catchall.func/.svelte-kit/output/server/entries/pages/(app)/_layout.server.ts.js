import { redirect } from "@sveltejs/kit";
import { v as validateAuth } from "../../../chunks/server.js";
const load = async ({ cookies }) => {
  const guest = await validateAuth(cookies);
  if (!guest) {
    redirect(303, "/");
  }
  return {
    guest: {
      id: guest.id,
      nickname: guest.nickname,
      photo_url: guest.photo_url,
      is_admin: guest.is_admin,
      created_at: guest.created_at
    },
    maskCode: guest.mask_codes?.code || null,
    eventId: guest.event_id
  };
};
export {
  load
};
