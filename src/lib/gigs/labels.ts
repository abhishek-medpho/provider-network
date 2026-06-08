import { type GigType } from "@prisma/client";

/** Human label for a gig's task, used in broadcast/reconfirm messages and UI. */
export function gigTaskLabel(type: GigType): string {
  switch (type) {
    case "SAMPLE_COLLECTION":
      return "blood sample pickup";
    case "HOME_NURSING_VISIT":
      return "home nursing visit";
    default:
      return "service request";
  }
}
