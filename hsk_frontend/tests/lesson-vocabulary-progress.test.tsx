import {it,expect,vi,beforeEach} from "vitest";
import {render,screen,fireEvent,waitFor,cleanup} from "@testing-library/react";
import LessonVocabulary from "@/components/student/timetable/lesson-vocabulary";
const api=vi.hoisted(()=>({save:vi.fn()}));
vi.mock("@/lib/api/student-client",()=>({studentApi:{saveVocabularyState:api.save}}));
const word={id:"link:0",resourceId:"word",word:"你好",pinyin:"ni hao",meaning:"Xin chào",pos:"",image:null,audio:null,examples:[],learned:false,progressKnown:true};
beforeEach(()=>{cleanup();vi.resetAllMocks();});
it("marks complete only after the server confirms the real vocabulary state",async()=>{let resolve!:(value:unknown)=>void;api.save.mockReturnValue(new Promise(r=>{resolve=r;}));render(<LessonVocabulary words={[word]} view="flashcards"/>);fireEvent.click(screen.getByRole("button",{name:"Đánh dấu đã thuộc"}));expect(screen.queryByText(/Bạn đã hoàn thành/)).toBeNull();expect(screen.getByRole("button",{name:"Đang lưu…"}).hasAttribute("disabled")).toBe(true);resolve({learningResourceId:"word",comprehensionLevel:"KNOWN"});await waitFor(()=>expect(screen.getByText(/Bạn đã hoàn thành toàn bộ/)).toBeTruthy());expect(api.save).toHaveBeenCalledWith("word",true);});
it("keeps the word incomplete and shows an error if saving fails",async()=>{api.save.mockRejectedValue(Error("Server offline"));render(<LessonVocabulary words={[word]} view="flashcards"/>);fireEvent.click(screen.getByRole("button",{name:"Đánh dấu đã thuộc"}));await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Server offline"));expect(screen.queryByText(/Bạn đã hoàn thành/)).toBeNull();});
it("renders previously saved completion when the lesson is reopened",()=>{render(<LessonVocabulary words={[{...word,learned:true}]} view="flashcards"/>);expect(screen.getByRole("button",{name:"Đã thuộc"})).toBeTruthy();expect(screen.getByText(/Bạn đã hoàn thành toàn bộ/)).toBeTruthy();});

it("starts a different flashcard on the front without reusing the flipped element", () => {
  const secondWord = { ...word, id: "link:1", word: "谢谢", meaning: "Cảm ơn" };
  render(<LessonVocabulary words={[word, secondWord]} view="flashcards" />);
  const firstCard = screen.getByRole("button", { name: "Lật thẻ từ vựng" });
  fireEvent.click(firstCard);
  expect(firstCard).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: /Thẻ sau/ }));
  const secondCard = screen.getByRole("button", { name: "Lật thẻ từ vựng" });
  expect(secondCard).not.toBe(firstCard);
  expect(secondCard).toHaveTextContent("谢谢");
  expect(secondCard).toHaveAttribute("aria-pressed", "false");
});
