import { useStudentIdentity } from "./student-data";
import { Link, all_routes } from "./dashboard/preview-navigation";
import ImageWithBasePath from "./dashboard/image";
import { useTranslation } from "./dashboard/translations";
export default function ProfileCard() {
 const { t } = useTranslation();
 const identity = useStudentIdentity();
  return (
    <div className="modern-profile-card">
      <div className="row align-items-center row-gap-3 position-relative z-index-2">
        <div className="col-lg-8">
          <div className="d-flex align-items-center">
            <span
              className="avatar avatar-xxl avatar-rounded me-4 position-relative"
              style={{ width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}
            >
              <ImageWithBasePath
                src={identity.avatarUrl}
                alt={identity.name}
                className="avatar-premium rounded-circle bg-white"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block', borderRadius: '50%' }}
              />
            </span>
            <div>
              <p className="text-white-50 mb-1 fs-13 text-uppercase fw-semibold" style={{ letterSpacing: '1px' }}>{t('student.welcomeBack')}</p>
              <h3 className="mb-2 text-white fw-bold d-flex align-items-center gap-2" style={{ fontSize: '28px' }}>
                {identity.name}
                <Link
                  to={all_routes.studentProfile}
                  
                  
                  className="btn btn-sm border-0 rounded-circle ms-2 bg-white text-danger"
                  style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}
                  title={t('student.settingsTooltip')}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <i aria-hidden="true" className="isax isax-setting-25 fs-6" />
                </Link>
              </h3>
            </div>
          </div>
        </div>
        <div className="col-lg-4 text-lg-end mt-4 mt-lg-0">
          <Link to={all_routes.studentCourses} className="btn bg-white text-danger rounded-pill px-4 py-3 fw-bold shadow-lg" style={{ transition: 'all 0.3s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
            {t('student.myCourses')} <i aria-hidden="true" className="isax isax-arrow-right-3 ms-2" />
          </Link>
        </div>
      </div>
    </div>
  )
}
