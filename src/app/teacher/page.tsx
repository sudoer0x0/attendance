import { redirect } from "next/navigation";

export default function TeacherIndexPage() {
  const staffSecret = process.env.STAFF_SECRET_PATH || "staff";
  redirect(`/${staffSecret}/courses`);
}
