"use client";
import { useStudentIdentity } from "./student-data";
import { buildAuthFrontendUrl } from "@/lib/auth/auth-redirect";
import StudentShell from "./dashboard/student-shell";
import { useTranslation } from "./dashboard/translations";


export default function StudentProfile() {
 const { t } = useTranslation();
 const { name: fullName, user } = useStudentIdentity();
 const email = user?.email || "—";
 const createdAt = "Chưa có dữ liệu";
 const username = "";
 const canShowUsername = false;
 const isActive = user?.emailVerified === true;
 const statusLabel = user?.emailVerified === undefined ? "Chưa có dữ liệu" : isActive ? "Đã xác minh email" : "Chưa xác minh email";
 const profileUrl = buildAuthFrontendUrl("/account/profile", "");
 const loadingProfile = false;
 return <StudentShell profileHeader>
              <div className="student-profile-main-card mb-4">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-4 border-bottom">
                  <h4 className="modern-title mb-0 text-dark d-flex align-items-center gap-3">
                    <div className="bg-primary bg-opacity-10 text-primary p-2 rounded-circle d-flex align-items-center justify-content-center" style={{ width: "48px", height: "48px" }}>
                      <i aria-hidden="true" className="isax isax-user fs-4" />
                    </div>
                    {t("student.myProfile")}
                  </h4>
                  <a href={profileUrl ?? undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!profileUrl} className="btn btn-primary rounded-pill btn-sm px-4 py-2 fw-bold hover-scale shadow-sm d-flex align-items-center gap-2">
                    <i aria-hidden="true" className="isax isax-edit-2" /> {t("student.editProfile")}
                  </a>
                </div>

                {loadingProfile ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status" />
                    <p className="mt-3 text-muted mb-0">{t("student.loadingProfile")}</p>
                  </div>
                ) : (
                  <div className="student-profile-sections">
                    <div className="student-profile-section-card">
                      <h5 className="student-profile-section-title">{t("student.personalInfo")}</h5>
                      <div className="student-profile-grid">
                        <div className="student-profile-item">
                          <span className="student-profile-label">{t("student.fullName")}</span>
                          <span className="student-profile-value" title={fullName}>{fullName}</span>
                        </div>

                        <div className="student-profile-item">
                          <span className="student-profile-label">{t("student.registrationDate")}</span>
                          <span className="student-profile-value">{createdAt}</span>
                        </div>

                        <div className="student-profile-item student-profile-item-full">
                          <span className="student-profile-label">{t("student.status")}</span>
                          <span className={`student-status-badge ${isActive ? "is-active" : "is-inactive"}`}>
                            <span className="student-status-dot" />
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="student-profile-section-card">
                      <h5 className="student-profile-section-title">{t("student.contactInfo")}</h5>
                      <div className="student-profile-grid">
                        <div className="student-profile-item">
                          <span className="student-profile-label">{t("student.email")}</span>
                          <span className="student-profile-value" title={email}>{email}</span>
                        </div>

                        {canShowUsername && (
                          <div className="student-profile-item">
                            <span className="student-profile-label">{t("student.username")}</span>
                            <span className="student-profile-value">{username}</span>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                )}
              </div>


</StudentShell>;
}
