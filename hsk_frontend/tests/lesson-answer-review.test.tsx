import {cleanup,render,screen} from "@testing-library/react";
import {afterEach,expect,it} from "vitest";
import LessonAnswerReview,{resultDraft} from "@/components/student/timetable/lesson-answer-review";
afterEach(cleanup);
it("only shows explanation and grades supplied by the server",()=>{
 render(<LessonAnswerReview question={{answerJson:'{"text":"answer"}',earnedPoints:1,maxPoints:2,explanation:"API explanation",graderComment:"API feedback"}}/>);
 expect(screen.getByText("Điểm: 1 / 2")).toBeInTheDocument();expect(screen.getByText(/API explanation/)).toBeInTheDocument();expect(screen.getByText(/API feedback/)).toBeInTheDocument();
});
it("maps result option indices and blank indices back to the inputs",()=>{
 expect(resultDraft({answerJson:'{"selectedOptionIndex":5}',options:[{optionIndex:5,content:"Answer"}]},"q").selected).toEqual({q:"0"});
 expect(resultDraft({answerJson:'{"blankAnswers":{"3":"word"}}',blanks:[{blankIndex:3}]},"q").answers).toEqual({"q:0":"word"});
});
