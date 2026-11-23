import { format, formatDistanceToNowStrict } from "date-fns";

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "d MMM yyyy");
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "d MMM yyyy, HH:mm");
}

export function timeAgo(value: string | null | undefined) {
  if (!value) return "";
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.replace(/^Unauthorized:.*/, "Please sign in again.");
  return "Something went wrong. Please try again.";
}
