import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * URL for an attendance selfie in the admin web UI.
 *
 * The bytes live in the database, so they are served by an authenticated route
 * rather than from `public/`. `photoUrl` on the row points at the JWT route the
 * Flutter app uses; the browser authenticates with a session cookie instead, so
 * it needs the sibling `/api/attendance/photo/:id` route.
 */
export function attendancePhotoUrl(photoId: string | null | undefined): string | null {
  return photoId ? `/api/attendance/photo/${photoId}` : null
}
