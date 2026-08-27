import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const accessSecret = () => new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const superAdminSecret = process.env.SUPER_ADMIN_SECRET_PATH || "superadmin";
  const deptAdminSecret = process.env.DEPT_ADMIN_SECRET_PATH || "admin";
  const staffSecret = process.env.STAFF_SECRET_PATH || "staff";

  // 1. Block direct public probes on /superadmin, /admin, or /teacher if secret paths are active
  if (superAdminSecret !== "superadmin" && (pathname === "/superadmin" || pathname.startsWith("/superadmin/"))) {
    return new NextResponse(null, { status: 404 });
  }
  if (deptAdminSecret !== "admin" && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    return new NextResponse(null, { status: 404 });
  }
  if (staffSecret !== "teacher" && (pathname === "/teacher" || pathname.startsWith("/teacher/"))) {
    return new NextResponse(null, { status: 404 });
  }

  // 2. Handle Super Admin secret path
  if (pathname === `/${superAdminSecret}` || pathname.startsWith(`/${superAdminSecret}/`)) {
    const internalPath = pathname.replace(`/${superAdminSecret}`, "/superadmin") || "/superadmin";
    const rewriteUrl = new URL(internalPath, req.url);

    if (pathname === `/${superAdminSecret}/login`) {
      return NextResponse.rewrite(rewriteUrl);
    }

    const token = req.cookies.get("attend_access")?.value;
    if (!token) {
      return NextResponse.redirect(new URL(`/${superAdminSecret}/login`, req.url));
    }

    try {
      const { payload } = await jwtVerify(token, accessSecret());
      if (payload.role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL(`/${superAdminSecret}/login`, req.url));
      }
      return NextResponse.rewrite(rewriteUrl);
    } catch {
      return NextResponse.redirect(new URL(`/${superAdminSecret}/login`, req.url));
    }
  }

  // 3. Handle Department Admin secret path
  if (pathname === `/${deptAdminSecret}` || pathname.startsWith(`/${deptAdminSecret}/`)) {
    const internalPath = pathname.replace(`/${deptAdminSecret}`, "/admin") || "/admin";
    const rewriteUrl = new URL(internalPath, req.url);

    if (pathname === `/${deptAdminSecret}/login`) {
      return NextResponse.rewrite(rewriteUrl);
    }

    const token = req.cookies.get("attend_access")?.value;
    if (!token) {
      return NextResponse.redirect(new URL(`/${deptAdminSecret}/login`, req.url));
    }

    try {
      const { payload } = await jwtVerify(token, accessSecret());
      if (payload.role !== "DEPARTMENT_ADMIN") {
        return NextResponse.redirect(new URL(`/${deptAdminSecret}/login`, req.url));
      }
      return NextResponse.rewrite(rewriteUrl);
    } catch {
      return NextResponse.redirect(new URL(`/${deptAdminSecret}/login`, req.url));
    }
  }

  // 4. Handle Staff secret path
  if (pathname === `/${staffSecret}` || pathname.startsWith(`/${staffSecret}/`)) {
    const internalPath = pathname.replace(`/${staffSecret}`, "/teacher") || "/teacher";
    const rewriteUrl = new URL(internalPath, req.url);

    if (pathname === `/${staffSecret}/login`) {
      return NextResponse.rewrite(rewriteUrl);
    }

    const token = req.cookies.get("attend_access")?.value;
    if (!token) {
      return NextResponse.redirect(new URL(`/${staffSecret}/login`, req.url));
    }

    try {
      const { payload } = await jwtVerify(token, accessSecret());
      if (payload.role !== "TEACHER") {
        return NextResponse.redirect(new URL(`/${staffSecret}/login`, req.url));
      }
      return NextResponse.rewrite(rewriteUrl);
    } catch {
      return NextResponse.redirect(new URL(`/${staffSecret}/login`, req.url));
    }
  }

  // 5. Handle Student protected routes
  if (
    pathname === "/student" ||
    pathname.startsWith("/student/") && pathname !== "/student/login"
  ) {
    const token = req.cookies.get("attend_access")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/student/login", req.url));
    }

    try {
      const { payload } = await jwtVerify(token, accessSecret());
      if (payload.role !== "STUDENT") {
        return NextResponse.redirect(new URL("/student/login", req.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/student/login", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons|fonts).*)",
  ],
};
