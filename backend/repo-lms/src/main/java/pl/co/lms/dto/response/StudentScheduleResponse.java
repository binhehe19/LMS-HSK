package pl.co.lms.dto.response;
import java.util.List;
public record StudentScheduleResponse(String id,Integer sessionNo,String topic,String content,String studentTasks,List<MaterialRefResponse> studentMaterials,List<PracticeModuleResponse> moduleOnLuyen){}
