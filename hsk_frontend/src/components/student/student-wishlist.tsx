"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import StudentShell from "./dashboard/student-shell";
import { Link, all_routes } from "./dashboard/preview-navigation";
import { useTranslation } from "./dashboard/translations";
import { CATALOG_COURSES, COURSE_CATEGORIES } from "./course/data/catalog-courses";
import "./course/student-course.scss";

const wishlist = CATALOG_COURSES.slice(0, 12).map((course, i) => ({
 id: course.code, source: (course.studyForm === "online-tu-hoc" ? "VIDEO" : "ONLINE") as "ONLINE" | "VIDEO",
 itemId: course.code, title: course.title, description: course.description, category: course.category,
 type: course.category === "gia-su" ? "ONE_ON_ONE" : "GROUP", thumbnail: course.image, price: course.price,
 addedAt: `2026-08-${String(20 - i).padStart(2, "0")}`,
}));
type StudentWishlistItem = typeof wishlist[number];
export default function StudentWishlist() {
 const { t } = useTranslation();
 const [savedItems, setSavedItems] = useState(wishlist);
 const [removed, setRemoved] = useState<StudentWishlistItem | null>(null);
 const [currentPage, setCurrentPage] = useState(1);
 const [pageSize, setPageSize] = useState(9);
 const [source, setSource] = useState<"ALL" | "ONLINE" | "VIDEO">("ALL");
 const [keyword, setKeyword] = useState("");
 const [courseType, setCourseType] = useState("");
 const [videoCategory, setVideoCategory] = useState("");
 const [minPrice, setMinPrice] = useState("");
 const [maxPrice, setMaxPrice] = useState("");
 const [sortBy, setSortBy] = useState("createdAt,desc");
 const videoCategories = COURSE_CATEGORIES.map(category => ({ code: category.id, name: category.filterLabel }));
 const loading = false;
 const filtered = savedItems.filter(item =>
  item.title.toLocaleLowerCase("vi").includes(keyword.toLocaleLowerCase("vi")) &&
  (source === "ALL" || source === item.source) &&
  (!(source !== "VIDEO" && courseType) || item.type === courseType) &&
  (!(source !== "ONLINE" && videoCategory) || item.category === videoCategory) &&
  (!minPrice || item.price >= Number(minPrice)) && (!maxPrice || item.price <= Number(maxPrice))
 ).sort((a, b) => sortBy === "price,asc" ? a.price - b.price : sortBy === "price,desc" ? b.price - a.price : sortBy === "title,asc" ? a.title.localeCompare(b.title, "vi") : sortBy === "createdAt,asc" ? a.addedAt.localeCompare(b.addedAt) : b.addedAt.localeCompare(a.addedAt));
 const totalElements = filtered.length;
 const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
 const page = Math.min(currentPage, totalPages);
 const items = filtered.slice((page - 1) * pageSize, page * pageSize);
 const startIdx = totalElements ? (page - 1) * pageSize + 1 : 0;
 const endIdx = Math.min(page * pageSize, totalElements);
 const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
 const handleToggleWishlist = (item: StudentWishlistItem) => { setSavedItems(savedItems.filter(saved => saved.id !== item.id)); setRemoved(item); };
 const buildItemLink = () => all_routes.studentCourses;
 const resolveThumbnail = (item: StudentWishlistItem) => item.thumbnail;
 return <StudentShell profileHeader>
 {removed && <div className="student-local-feedback">Đã bỏ “{removed.title}” khỏi danh sách. <button type="button" className="btn btn-link p-0 ms-2" onClick={() => { setSavedItems([...savedItems, removed]); setRemoved(null); }}>Hoàn tác</button></div>}
                            <div className="page-title d-flex align-items-center justify-content-between mb-3">
                                <h5>{t('student.wishlistTitle')}</h5>
                            </div>

                            <div className="premium-card mb-4">
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-6 col-lg-4">
                                        <label className="form-label fw-semibold">{t('student.keyword')}</label>
                                        <input
                                            value={keyword}
                                            onChange={(e) => { setKeyword(e.target.value); setCurrentPage(1); }}
                                            className="form-control"
                                            placeholder={t('student.searchPlaceholder')}
                                        />
                                    </div>

                                    <div className="col-md-6 col-lg-2">
                                        <label className="form-label fw-semibold">{t('student.source')}</label>
                                        <select className="form-select" value={source} onChange={(e) => { setSource(e.target.value as "ALL" | "ONLINE" | "VIDEO"); setCurrentPage(1); }}>
                                            <option value="ALL">{t('student.all')}</option>
                                            <option value="ONLINE">Online course</option>
                                            <option value="VIDEO">Video course</option>
                                        </select>
                                    </div>

                                    {(source === "ALL" || source === "ONLINE") && (
                                        <div className="col-md-6 col-lg-2">
                                            <label className="form-label fw-semibold">{t('student.classType')}</label>
                                            <select className="form-select" value={courseType} onChange={(e) => { setCourseType(e.target.value); setCurrentPage(1); }}>
                                                <option value="">{t('student.all')}</option>
                                                <option value="GROUP">{t('student.groupClass')}</option>
                                                <option value="ONE_ON_ONE">{t('student.oneOnOne')}</option>
                                            </select>
                                        </div>
                                    )}

                                    {(source === "ALL" || source === "VIDEO") && (
                                        <div className="col-md-6 col-lg-2">
                                            <label className="form-label fw-semibold">{t('student.videoCategory')}</label>
                                            <select className="form-select" value={videoCategory} onChange={(e) => { setVideoCategory(e.target.value); setCurrentPage(1); }}>
                                                <option value="">{t('student.all')}</option>
                                                {videoCategories.map((cat) => (
                                                    <option key={cat.code} value={cat.code}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="col-md-6 col-lg-1">
                                        <label className="form-label fw-semibold">{t('student.priceFrom')}</label>
                                        <input
                                            value={minPrice}
                                            onChange={(e) => { setMinPrice(e.target.value); setCurrentPage(1); }}
                                            className="form-control"
                                            type="number"
                                            min={0}
                                        />
                                    </div>

                                    <div className="col-md-6 col-lg-1">
                                        <label className="form-label fw-semibold">{t('student.priceTo')}</label>
                                        <input
                                            value={maxPrice}
                                            onChange={(e) => { setMaxPrice(e.target.value); setCurrentPage(1); }}
                                            className="form-control"
                                            type="number"
                                            min={0}
                                        />
                                    </div>

                                    <div className="col-md-6 col-lg-2">
                                        <label className="form-label fw-semibold">{t('student.sortBy')}</label>
                                        <select className="form-select" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}>
                                            <option value="createdAt,desc">{t('student.sortRecentlyAdded')}</option>
                                            <option value="createdAt,asc">{t('student.sortOldestAdded')}</option>
                                            <option value="price,asc">{t('student.sortPriceAsc')}</option>
                                            <option value="price,desc">{t('student.sortPriceDesc')}</option>
                                            <option value="title,asc">{t('student.sortNameAZ')}</option>
                                        </select>
                                    </div>

                                    <div className="col-md-6 col-lg-1">
                                        <label className="form-label fw-semibold">{t('student.perPage')}</label>
                                        <select className="form-select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}>
                                            <option value={6}>6</option>
                                            <option value={9}>9</option>
                                            <option value={12}>12</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <div className="premium-card text-center py-5">
                                    <div className="spinner-border text-primary" role="status" />
                                    <p className="text-muted mt-3 mb-0">{t('student.loadingWishlist')}</p>
                                </div>
                            ) : items.length === 0 ? (
                                <div className="premium-card text-center py-5">
                                    <i aria-hidden="true" className="isax isax-heart fs-1 text-muted mb-3 d-inline-block" />
                                    <h5 className="modern-title mb-2 text-dark">{t('student.noWishlistItems')}</h5>
                                    <p className="text-muted mb-0">{t('student.noWishlistItemsDesc')}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="row g-4 mb-4">
                                        {items.map((item) => (
                                            <div className="col-xl-4 col-md-6" key={`${item.source}-${item.id}`}>
                                                <div className="course-card-grid-refined h-100">
                                                    <div className="course-img-grid">
                                                        <Link to={buildItemLink()}>
                                                            <img src={resolveThumbnail(item)} alt={item.title} />
                                                        </Link>
                                                        <button
                                                            className="wishlist-btn-refined active text-primary"
                                                            onClick={() => void handleToggleWishlist(item)}
                                                            title={t('student.removeFromWishlist')}
                                                            aria-label={t('student.removeFromWishlist')}
                                                        >
                                                            <i aria-hidden="true" className="isax isax-heart5" />
                                                        </button>
                                                    </div>

                                                    <div className="course-content-grid">
                                                        <div className="course-info-row-refined mb-2">
                                                            <span className="course-category-tag-refined">
                                                                {item.source === "ONLINE" ? "Online" : "Video"}
                                                            </span>
                                                            <small className="text-muted">
                                                                {new Date(item.addedAt).toLocaleDateString("vi-VN")}
                                                            </small>
                                                        </div>

                                                        <Link to={buildItemLink()} className="text-decoration-none">
                                                            <h6 className="course-title-refined text-truncate-2 online-course-title-fixed">{item.title}</h6>
                                                        </Link>

                                                        <p className="course-desc-refined text-muted fs-13 mb-3 line-clamp-2">
                                                            {item.description || t('student.noDescription')}
                                                        </p>

                                                        <div className="course-price-row-refined mt-3">
                                                            <div className="price-refined">
                                                                <span className={`fw-bold ${Number(item.price || 0) <= 0 ? 'text-success' : 'text-crimson'}`}>
                                                                    {Number(item.price || 0) <= 0 ? t('student.free') : `${Number(item.price || 0).toLocaleString("vi-VN")}₫`}
                                                                </span>
                                                            </div>
                                                            <Link to={buildItemLink()} className="btn-detail-refined text-decoration-none">{t('student.viewDetails')}</Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                                        <p className="mb-0 text-muted">
                                            {t('student.showingItems')} <strong>{startIdx}</strong> - <strong>{endIdx}</strong> / <strong>{totalElements}</strong> {t('student.ofItems')}
                                        </p>

                                        <ul className="pagination mb-0">
                                            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                                                <button className="page-link" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}>{t('student.prev')}</button>
                                            </li>

                                            {pageNumbers.map((page) => (
                                                <li key={page} className={`page-item ${currentPage === page ? "active" : ""}`}>
                                                    <button className="page-link" onClick={() => setCurrentPage(page)}>{page}</button>
                                                </li>
                                            ))}

                                            <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                                                <button className="page-link" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}>{t('student.next')}</button>
                                            </li>
                                        </ul>
                                    </div>
                                </>
                            )}
</StudentShell>;
}
