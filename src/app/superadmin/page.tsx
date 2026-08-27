import { redirect } from "next/navigation";

export default function SuperAdminIndexPage() {
  const superAdminSecret = process.env.SUPER_ADMIN_SECRET_PATH || "superadmin";
  redirect(`/${superAdminSecret}/departments`);
}
