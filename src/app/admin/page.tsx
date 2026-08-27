import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  const deptAdminSecret = process.env.DEPT_ADMIN_SECRET_PATH || "admin";
  redirect(`/${deptAdminSecret}/students`);
}
