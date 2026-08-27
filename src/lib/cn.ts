import { clsx, type ClassValue } from "clsx";

/** Thin wrapper around clsx — kept as its own module so it's trivial to
 *  swap in tailwind-merge later if class conflicts start showing up. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
