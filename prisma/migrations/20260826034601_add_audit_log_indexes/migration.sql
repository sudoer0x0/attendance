-- CreateIndex
CREATE INDEX "AuditLog_superAdminId_idx" ON "AuditLog"("superAdminId");

-- CreateIndex
CREATE INDEX "AuditLog_departmentAdminId_idx" ON "AuditLog"("departmentAdminId");

-- CreateIndex
CREATE INDEX "AuditLog_teacherId_idx" ON "AuditLog"("teacherId");

-- CreateIndex
CREATE INDEX "AuditLog_studentId_idx" ON "AuditLog"("studentId");
