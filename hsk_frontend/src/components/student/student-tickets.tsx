"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, type ChangeEvent, type FormEvent } from "react";
import dayjs from "dayjs";
import StudentShell from "./dashboard/student-shell";
import { useTranslation } from "./dashboard/translations";
import NativeModal from "./native-modal";

type Ticket = { id: string; title: string; description: string; category: string; priority: string; status: string; createdAt: string; files: string[] };
const sampleTickets: Ticket[] = [
 { id: "TK001", title: "Hỗ trợ truy cập lớp học HSK3", description: "Em cần hướng dẫn truy cập lớp học trực tuyến và xem tài liệu của buổi 13.", category: "TECHNICAL_SUPPORT", priority: "HIGH", status: "OPEN", createdAt: "2026-08-07T08:30:00", files: [] },
 { id: "TK002", title: "Hỏi về bài tập ngữ pháp bài 8", description: "Nhờ thầy cô giải thích thêm cách dùng bổ ngữ kết quả trong bài 8.", category: "ACADEMIC_AND_LECTURE", priority: "NORMAL", status: "COMPLETED", createdAt: "2026-08-05T10:00:00", files: [] },
 { id: "TK003", title: "Tư vấn lộ trình học HSK4", description: "Em muốn được tư vấn lộ trình phù hợp sau khi hoàn thành khóa HSK3.", category: "OTHER", priority: "NORMAL", status: "OPEN", createdAt: "2026-08-03T16:00:00", files: [] },
];
const emptyTicket = { title: "", description: "", category: "TECHNICAL_SUPPORT", priority: "NORMAL", files: [] as string[] };
export default function StudentTickets() {
 const { t } = useTranslation();
 const [allTickets, setAllTickets] = useState(sampleTickets);
 const [creating, setCreating] = useState(false);
 const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
 const [newTicket, setNewTicket] = useState(emptyTicket);
 const [notice, setNotice] = useState("");
 const [filters, setFilters] = useState({ search: "", sortDirection: "desc" as "asc" | "desc", status: "", category: "", priority: "", page: 0, size: 10 });
 const filtered = allTickets.filter(ticket => ticket.title.toLocaleLowerCase("vi").includes(filters.search.toLocaleLowerCase("vi")) && (!filters.status || ticket.status === filters.status) && (!filters.category || ticket.category === filters.category) && (!filters.priority || ticket.priority === filters.priority)).sort((a,b) => filters.sortDirection === "desc" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt));
 const pagination = { totalElements: filtered.length, totalPages: Math.ceil(filtered.length / filters.size) };
 const tickets = filtered.slice(filters.page * filters.size, (filters.page + 1) * filters.size);
 const loading = false;
 const loadingDetail = false;
 const submitting = false;
 const comments = selectedTicket?.id === "TK002" ? [{ id: "reply-1", creatorName: "Mentor Học Bá", creatorAvatarUrl: "/assets/figma-home/0e447.png", createdAt: "2026-08-06T09:00:00", content: "Chào em, bổ ngữ kết quả đứng sau động từ để diễn đạt kết quả của hành động. Em xem lại ví dụ trong bài 8 và luyện tập thêm nhé!" }] : [];
 const handleViewDetail = (ticket: Ticket) => setSelectedTicket(ticket);
 const removeFile = (index: number) => setNewTicket(previous => ({ ...previous, files: previous.files.filter((_, i) => i !== index) }));
 const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { setNotice("Chọn ảnh có dung lượng tối đa 5 MB."); return; }
  const reader = new FileReader();
  reader.onload = () => { if (typeof reader.result === "string") { const url = reader.result; setNewTicket(previous => ({ ...previous, files: [...previous.files, url] })); } };
  reader.readAsDataURL(file);
 };
 const handleCreateTicket = (event: FormEvent) => {
  event.preventDefault();
  if (!newTicket.title.trim() || !newTicket.description.trim()) return;
  setAllTickets(previous => [{ ...newTicket, title: newTicket.title.trim(), description: newTicket.description.trim(), id: `LOCAL-${Date.now()}`, status: "OPEN", createdAt: new Date().toISOString() }, ...previous]);
  setFilters({ search: "", sortDirection: "desc", status: "", category: "", priority: "", page: 0, size: 10 });
  setNewTicket(emptyTicket); setCreating(false); setNotice("Đã tạo yêu cầu trong phiên xem trước.");
 };
    const getStatusBadge = (status: string) => {
        switch (status) {
            case "OPEN": return <span className="badge bg-primary">{t("student.ticketsStatusOpen")}</span>;
            case "COMPLETED": return <span className="badge bg-success">{t("student.ticketsStatusCompleted")}</span>;
            case "CANCELLED": return <span className="badge bg-secondary">{t("student.ticketsStatusCancelled")}</span>;
            default: return <span className="badge bg-light text-dark">{status}</span>;
        }
    };

    const getPriorityBadge = (priority?: string) => {
        switch (priority) {
            case "NORMAL": return <span className="badge bg-soft-success text-success">{t("student.ticketsPriorityNormal")}</span>;
            case "HIGH": return <span className="badge bg-soft-warning text-warning">{t("student.ticketsPriorityHigh")}</span>;
            case "URGENT": return <span className="badge bg-soft-danger text-danger">{t("student.ticketsPriorityUrgent")}</span>;
            default: return null;
        }
    };

    const getCategoryLabel = (category?: string) => {
        switch (category) {
            case "TECHNICAL_SUPPORT": return t("student.ticketsCatTechnical");
            case "TUITION_AND_PAYMENT": return t("student.ticketsCatPayment");
            case "ACADEMIC_AND_LECTURE": return t("student.ticketsCatAcademic");
            case "OTHER": return t("student.ticketsCatOther");
            default: return category;
        }
    };

 return <StudentShell profileHeader>
{notice && <div role="status" className="student-local-feedback">{notice}</div>}
                            <div className="tickets">
                                <div className="d-flex align-items-center justify-content-between flex-wrap page-title mb-4">
                                    <h5 className="mb-0">{t("student.ticketsTitle")}</h5>
                                    <button 
                                        className="btn btn-primary d-flex align-items-center"
                                        onClick={() => setCreating(true)}
                                        
                                    >
                                        <i aria-hidden="true" className="isax isax-add-circle5 me-2" /> {t("student.ticketsAddNew")}
                                    </button>
                                </div>

                                <div className="card mb-4">
                                    <div className="card-body p-3">
                                        <div className="row align-items-center g-3">
                                            <div className="col-md-4">
                                                <div className="input-group">
                                                    <span className="input-group-text bg-transparent border-end-0">
                                                        <i aria-hidden="true" className="isax isax-search-normal-1" />
                                                    </span>
                                                    <input 
                                                        type="text" 
                                                        className="form-control border-start-0" 
                                                        placeholder={t("student.ticketsSearchPlaceholder")}
                                                        value={filters.search}
                                                        onChange={(e) => setFilters({...filters, search: e.target.value, page: 0})}
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-md-8">
                                                <div className="d-flex flex-wrap gap-2 justify-content-md-end align-items-center">
                                                    <select 
                                                        className="form-select w-auto"
                                                        value={filters.status}
                                                        onChange={(e) => setFilters({...filters, status: e.target.value, page: 0})}
                                                    >
                                                        <option value="">{t("student.ticketsAllStatus")}</option>
                                                        <option value="OPEN">{t("student.ticketsStatusOpen")}</option>
                                                        <option value="COMPLETED">{t("student.ticketsStatusCompleted")}</option>
                                                    </select>
                                                    <select 
                                                        className="form-select w-auto"
                                                        value={filters.category}
                                                        onChange={(e) => setFilters({...filters, category: e.target.value, page: 0})}
                                                    >
                                                        <option value="">{t("student.ticketsAllCategory")}</option>
                                                        <option value="TECHNICAL_SUPPORT">{t("student.ticketsCatTechnicalShort")}</option>
                                                        <option value="TUITION_AND_PAYMENT">{t("student.ticketsCatPaymentShort")}</option>
                                                        <option value="ACADEMIC_AND_LECTURE">{t("student.ticketsCatAcademicShort")}</option>
                                                        <option value="OTHER">{t("student.ticketsCatOther")}</option>
                                                    </select>
                                                    <select 
                                                        className="form-select w-auto"
                                                        value={filters.priority}
                                                        onChange={(e) => setFilters({...filters, priority: e.target.value, page: 0})}
                                                    >
                                                        <option value="">{t("student.ticketsPriority")}</option>
                                                        <option value="NORMAL">{t("student.ticketsPriorityNormal")}</option>
                                                        <option value="HIGH">{t("student.ticketsPriorityHigh")}</option>
                                                        <option value="URGENT">{t("student.ticketsPriorityUrgent")}</option>
                                                    </select>
                                                    <select 
                                                        className="form-select w-auto"
                                                        value={filters.sortDirection}
                                                        onChange={(e) => setFilters({...filters, sortDirection: e.target.value as "asc" | "desc"})}
                                                    >
                                                        <option value="desc">{t("student.sortNewest")}</option>
                                                        <option value="asc">{t("student.sortOldest")}</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-primary" role="status">
                                            <span className="visually-hidden">Loading...</span>
                                        </div>
                                    </div>
                                ) : tickets.length > 0 ? (
                                    <div className="row">
                                        {tickets.map(ticket => (
                                            <div className="col-md-12 mb-3" key={ticket.id}>
                                                <div className="card ticket-card hover-shadow" role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleViewDetail(ticket); } }} onClick={() => handleViewDetail(ticket)} style={{cursor: 'pointer'}}>
                                                    <div className="card-body p-3">
                                                        <div className="d-flex align-items-center justify-content-between">
                                                            <div className="d-flex align-items-center">
                                                                <div className="icon-box bg-primary-transparent me-3">
                                                                    <i aria-hidden="true" className="isax isax-ticket-2" />
                                                                </div>
                                                                <div>
                                                                    <h6 className="mb-1">{ticket.title}</h6>
                                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                                        <span className="small text-primary bg-light px-2 rounded">{getCategoryLabel(ticket.category)}</span>
                                                                        {getPriorityBadge(ticket.priority)}
                                                                    </div>
                                                                    <p className="text-muted small mb-0">
                                                                        <i aria-hidden="true" className="isax isax-calendar me-1" />
                                                                        {dayjs(ticket.createdAt).format("DD/MM/YYYY HH:mm")}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="text-end">
                                                                {getStatusBadge(ticket.status)}
                                                                <i aria-hidden="true" className="isax isax-arrow-right-3 ms-3 text-muted" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {pagination.totalPages > 1 && (
                                            <div className="col-12 mt-4">
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <div className="text-muted small">
                                                        {t("student.ticketsShowingResults", { start: filters.page * filters.size + 1, end: Math.min((filters.page + 1) * filters.size, pagination.totalElements), total: pagination.totalElements })}
                                                    </div>
                                                    <nav aria-label="Page navigation">
                                                        <ul className="pagination mb-0">
                                                            <li className={`page-item ${filters.page === 0 ? 'disabled' : ''}`}>
                                                                <button className="page-link" onClick={() => setFilters({...filters, page: filters.page - 1})}>
                                                                    <i aria-hidden="true" className="fas fa-angle-left" />
                                                                </button>
                                                            </li>
                                                            {[...Array(pagination.totalPages)].map((_, i) => (
                                                                <li key={i} className={`page-item ${filters.page === i ? 'active' : ''}`}>
                                                                    <button className="page-link" onClick={() => setFilters({...filters, page: i})}>
                                                                        {i + 1}
                                                                    </button>
                                                                </li>
                                                            ))}
                                                            <li className={`page-item ${filters.page === pagination.totalPages - 1 ? 'disabled' : ''}`}>
                                                                <button className="page-link" onClick={() => setFilters({...filters, page: filters.page + 1})}>
                                                                    <i aria-hidden="true" className="fas fa-angle-right" />
                                                                </button>
                                                            </li>
                                                        </ul>
                                                    </nav>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="premium-card text-center py-5 shadow-sm bg-white rounded">
                                        <i aria-hidden="true" className="isax isax-ticket fs-1 text-muted mb-3 d-inline-block" />
                                        <h5 className="modern-title mb-2 text-dark">{t("student.ticketsNoTickets")}</h5>
                                        <p className="text-muted mb-0">{t("student.ticketsNoTicketsDesc")}</p>
                                    </div>
                                )}
                            </div>
<NativeModal show={creating} onHide={() => setCreating(false)} title={t("student.ticketsCreateTitle")}>
<form onSubmit={handleCreateTicket}>
                                <div className="row">
                                    <div className="col-md-12 mb-3">
                                        <label className="form-label fw-semibold">
                                            {t("student.ticketsTitleLabel")} <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder={t("student.ticketsTitlePlaceholder")}
                                            value={newTicket.title}
                                            onChange={(e) => setNewTicket({...newTicket, title: e.target.value})}
                                            required
                                        />
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label fw-semibold">
                                            {t("student.ticketsCategoryLabel")} <span className="text-danger">*</span>
                                        </label>
                                        <select 
                                            className="form-select"
                                            value={newTicket.category}
                                            onChange={(e) => setNewTicket({...newTicket, category: e.target.value})}
                                            required
                                        >
                                            <option value="TECHNICAL_SUPPORT">{t("student.ticketsCatTechnical")}</option>
                                            <option value="TUITION_AND_PAYMENT">{t("student.ticketsCatPayment")}</option>
                                            <option value="ACADEMIC_AND_LECTURE">{t("student.ticketsCatAcademic")}</option>
                                            <option value="OTHER">{t("student.ticketsCatOther")}</option>
                                        </select>
                                    </div>
                                    <div className="col-md-6 mb-3">
                                        <label className="form-label fw-semibold">
                                            {t("student.ticketsPriorityLabel")} <span className="text-danger">*</span>
                                        </label>
                                        <div className="d-flex gap-3 mt-2">
                                            <div className="form-check">
                                                <input className="form-check-input" type="radio" name="priority" id="pNormal" value="NORMAL" checked={newTicket.priority === 'NORMAL'} onChange={(e) => setNewTicket({...newTicket, priority: e.target.value})} />
                                                <label className="form-check-label" htmlFor="pNormal">{t("student.ticketsPriorityNormal")}</label>
                                            </div>
                                            <div className="form-check text-warning">
                                                <input className="form-check-input" type="radio" name="priority" id="pHigh" value="HIGH" checked={newTicket.priority === 'HIGH'} onChange={(e) => setNewTicket({...newTicket, priority: e.target.value})} />
                                                <label className="form-check-label" htmlFor="pHigh">{t("student.ticketsPriorityHigh")}</label>
                                            </div>
                                            <div className="form-check text-danger">
                                                <input className="form-check-input" type="radio" name="priority" id="pUrgent" value="URGENT" checked={newTicket.priority === 'URGENT'} onChange={(e) => setNewTicket({...newTicket, priority: e.target.value})} />
                                                <label className="form-check-label" htmlFor="pUrgent">{t("student.ticketsPriorityUrgent")}</label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-12 mb-3">
                                        <label className="form-label fw-semibold">
                                            {t("student.ticketsDescriptionLabel")} <span className="text-danger">*</span>
                                        </label>
                                        <textarea
                                            className="form-control"
                                            rows={5}
                                            placeholder={t("student.ticketsDescriptionPlaceholder")}
                                            value={newTicket.description}
                                            onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                                            required
                                        ></textarea>
                                    </div>
                                    <div className="col-md-12 mb-3">
                                        <label className="form-label fw-semibold">
                                            {t("student.ticketsAttachments")}
                                        </label>
                                        <div className="upload-ticket-files p-3 border rounded border-dashed bg-light">
                                            <input 
                                                type="file" 
                                                className="form-control d-none" 
                                                id="ticketFileUpload" 
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                            />
                                            <label htmlFor="ticketFileUpload" className="btn btn-outline-primary btn-sm mb-0">
                                                <i aria-hidden="true" className="isax isax-cloud-upload me-2" /> {t("student.ticketsChooseImage")}
                                            </label>
                                            
                                            {newTicket.files.length > 0 && (
                                                <div className="d-flex flex-wrap gap-2 mt-3">
                                                    {newTicket.files.map((url, i) => (
                                                        <div key={i} className="position-relative">
                                                            <img src={url} alt="upload" style={{width: '60px', height: '60px', objectFit: 'cover'}} className="rounded border" />
                                                            <button 
                                                                type="button"
                                                                className="btn btn-danger btn-sm rounded-circle p-0 position-absolute" 
                                                                style={{top: '-8px', right: '-8px', width: '20px', height: '20px', fontSize: '12px'}}
                                                                onClick={() => removeFile(i)}
                                                            >
                                                                &times;
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-0 px-0 pb-0 mt-3">
                                    <button
                                        type="button"
                                        className="btn btn-light rounded-pill px-4"
                                        onClick={() => setCreating(false)}
                                    >
                                        {t("student.ticketsCancel")}
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary rounded-pill px-4"
                                        disabled={submitting}
                                    >
                                        {submitting ? t("student.ticketsSubmitting") : t("student.ticketsSubmit")}
                                    </button>
                                </div>
                            </form>
</NativeModal>
<NativeModal show={!!selectedTicket} onHide={() => setSelectedTicket(null)} title="Chi tiết yêu cầu hỗ trợ">
                            {selectedTicket && (
                                <>
                                    <div className="mb-4 bg-light p-3 rounded">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <div>
                                                <h5 className="mb-1 text-primary">{selectedTicket.title}</h5>
                                                <div className="d-flex gap-2 align-items-center">
                                                    <span className="small text-muted">{getCategoryLabel(selectedTicket.category)}</span>
                                                    {getPriorityBadge(selectedTicket.priority)}
                                                </div>
                                            </div>
                                            {getStatusBadge(selectedTicket.status)}
                                        </div>
                                        <p className="text-muted small mb-3">
                                            <i aria-hidden="true" className="isax isax-calendar me-1" />
                                            {t("student.ticketsSentDate", { date: dayjs(selectedTicket.createdAt).format("DD/MM/YYYY HH:mm") })}
                                        </p>
                                        <div className="bg-white p-3 rounded border mb-3">
                                            <p className="mb-0 text-dark" style={{whiteSpace: 'pre-wrap'}}>{selectedTicket.description}</p>
                                        </div>
                                        
                                        {selectedTicket.files && selectedTicket.files.length > 0 && (
                                            <div className="mb-3">
                                                <h6 className="small fw-bold mb-2">{t("student.ticketsAttachedImages")}</h6>
                                                <div className="d-flex flex-wrap gap-2">
                                                    {selectedTicket.files.map((url, i) => (
                                                        <a key={i} href={url} target="_blank" rel="noreferrer" className="d-block border rounded p-1">
                                                            <img src={url} alt="attach" style={{width: '80px', height: '80px', objectFit: 'cover'}} />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <h6 className="fw-bold mb-3 d-flex align-items-center">
                                        <i aria-hidden="true" className="isax isax-message-2 me-2 text-primary" />
                                        {t("student.ticketsAdminReply")}
                                    </h6>

                                    {loadingDetail ? (
                                        <div className="text-center py-4">
                                            <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                                        </div>
                                    ) : comments.length > 0 ? (
                                        <div className="reply-list">
                                            {comments.map(comment => (
                                                <div key={comment.id} className="card border-0 bg-light-blue mb-2 p-3">
                                                    <div className="d-flex align-items-center mb-2">
                                                        <div className="avatar avatar-sm me-2">
                                                            <img src={comment.creatorAvatarUrl || "/assets/figma-home/0e447.png"} className="rounded-circle" alt="" />
                                                        </div>
                                                        <div>
                                                            <span className="fw-bold d-block text-dark">{comment.creatorName || t("student.ticketsAdminName")}</span>
                                                            <span className="text-muted small">{dayjs(comment.createdAt).format("DD/MM/YYYY HH:mm")}</span>
                                                        </div>
                                                    </div>
                                                    <div className="reply-content text-dark" style={{whiteSpace: 'pre-wrap'}}>
                                                        {comment.content}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="alert alert-info py-3 border-0">
                                            <i aria-hidden="true" className="isax isax-info-circle me-2" />
                                            {t("student.ticketsPendingReply")}
                                        </div>
                                    )}
                                </>
                            )}
</NativeModal>
</StudentShell>;
}
