import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StudentCourses from "@/components/student/student-courses";
import { listStudentCourses, getStudentCourse } from "@/lib/api/lms-course-client";
vi.mock("@/lib/api/lms-course-client", () => ({ listStudentCourses: vi.fn(), getStudentCourse: vi.fn() }));
vi.mock("@/components/student/dashboard/student-shell", () => ({ default: ({ children }: {
        children: React.ReactNode;
    }) => <div>{children}</div> }));
vi.mock("@/components/student/student-data", () => ({ useStudentIdentity: () => ({ name: "Student", avatarUrl: "" }) }));
vi.mock("@/components/student/course/components/course-hero", () => ({ default: () => null }));
vi.mock("@/components/student/course/components/course-detail-modal", () => ({ default: () => null }));
beforeEach(() => vi.resetAllMocks());
it("switches from course catalog to separate class cards", async () => {
    vi.mocked(listStudentCourses).mockImplementation(async (mode) => ({ enrollmentSource: "LIVE", items: mode === "mine" ? [{ id: "class:a", code: "A", name: "Class A", owned: true, progress: 20, doneSessions: 2 }, { id: "class:b", code: "B", name: "Class B", owned: true, progress: 40, doneSessions: 4 }] : [{ id: "course", code: "Course", name: "Course", owned: false, registered: true, progress: 0, doneSessions: 0 }] }));
    render(<StudentCourses />);
    await screen.findByText("Course", { selector: ".hb-course__card-head span:last-child" });
    fireEvent.click(screen.getByRole("tab", { name: "Khoá học của tôi" }));
    await screen.findByText("A", { selector: ".hb-course__card-head span:last-child" });
    expect(screen.getByText("B", { selector: ".hb-course__card-head span:last-child" })).toBeInTheDocument();
    expect(listStudentCourses).toHaveBeenLastCalledWith("mine", expect.any(Object));
    expect(getStudentCourse).not.toHaveBeenCalled();
});
it("restores the original sidebar, mode switch and grouped sections", async () => {
    vi.mocked(listStudentCourses).mockResolvedValue({items:[{id:"course",code:"H20",name:"HSK 2",owned:false,progress:0,doneSessions:0}],enrollmentSource:"LIVE"});
    const {container}=render(<StudentCourses/>);
    await screen.findByText("H20",{selector:".hb-course__card-head span:last-child"});
    expect(container.querySelector(".hb-course__layout .hb-course__filter-panel")).toBeInTheDocument();
    expect(container.querySelector(".hb-course__mode-switch")).toBeInTheDocument();
    expect(container.querySelector(".hb-course__section .hb-course__grid")).toBeInTheDocument();
    expect(screen.queryByRole("navigation",{name:"Phân trang khóa học"})).not.toBeInTheDocument();
    expect(listStudentCourses).toHaveBeenCalledWith("all",{allPages:true});
    fireEvent.click(screen.getByRole("button",{name:/^Bộ lọc/}));
    expect(container.querySelector(".hb-course__filter-panel--open")).toBeInTheDocument();
});
