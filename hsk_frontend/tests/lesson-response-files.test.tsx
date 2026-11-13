import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {beforeEach,expect,it,vi} from "vitest";
const storage=vi.hoisted(()=>({upload:vi.fn(),configured:vi.fn(()=>true)}));
vi.mock("@/lib/api/storage-client",()=>({uploadFile:storage.upload,isStorageApiConfigured:storage.configured,fileUrl:()=>"/file"}));
vi.mock("@/lib/api/write-gate",()=>({assertWriteEnabled:vi.fn(),getWriteAvailability:()=>"enabled"}));
import {LessonFileResponse} from "@/components/student/timetable/lesson-question-fields";
beforeEach(()=>{cleanup();vi.clearAllMocks();storage.configured.mockReturnValue(true);});
it("only saves the confirmed file metadata after upload succeeds",async()=>{
 storage.upload.mockResolvedValue({fileId:"confirmed",mimeType:"application/pdf",sizeBytes:3});const onChange=vi.fn();render(<LessonFileResponse question={{maxFiles:1}} onChange={onChange}/>);
 fireEvent.change(screen.getByLabelText("Tệp trả lời"),{target:{files:[new File(["pdf"],"answer.pdf",{type:"application/pdf"})]}});
 await waitFor(()=>expect(onChange).toHaveBeenCalled());expect(JSON.parse(onChange.mock.calls[0][0])).toEqual({files:[{fileId:"confirmed",fileName:"answer.pdf",mimeType:"application/pdf",sizeBytes:3}]});
});
it("keeps the prior answer when upload fails",async()=>{
 storage.upload.mockRejectedValue(Error("Upload unavailable"));const onChange=vi.fn();render(<LessonFileResponse question={{}} value='{"files":[{"fileId":"old","fileName":"old.pdf"}]}' onChange={onChange}/>);
 fireEvent.change(screen.getByLabelText("Tệp trả lời"),{target:{files:[new File(["pdf"],"answer.pdf",{type:"application/pdf"})]}});
 expect(await screen.findByRole("alert")).toHaveTextContent("Upload unavailable");expect(onChange).not.toHaveBeenCalled();expect(screen.getByText("old.pdf")).toBeInTheDocument();
});
it("does not upload anything when storage is not configured",()=>{
 storage.configured.mockReturnValue(false);render(<LessonFileResponse question={{}} onChange={()=>{}}/>);
 expect(screen.getByLabelText("Tệp trả lời")).toBeDisabled();expect(storage.upload).not.toHaveBeenCalled();
});
