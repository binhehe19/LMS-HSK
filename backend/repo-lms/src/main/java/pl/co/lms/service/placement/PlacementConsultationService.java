package pl.co.lms.service.placement;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.co.lms.client.IdentityClient;
import pl.co.lms.dto.request.PlacementRequests;
import pl.co.lms.entity.PlacementConsultation;
import pl.co.lms.repository.PlacementConsultationRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;

@Service @RequiredArgsConstructor @Transactional
public class PlacementConsultationService {
    private final PlacementConsultationRepository requests;
    private final ObjectMapper mapper;
    private final IdentityClient identity;

    public ObjectNode request(PlacementRequests.Consult input) {
        String user = PlacementAccess.user();
        PlacementConsultation request = requests.findByUserIdAndRequestKeyAndDeletedFalse(user, input.requestKey()).orElseGet(() -> {
            PlacementConsultation fresh = new PlacementConsultation(); fresh.setUserId(user); fresh.setRequestKey(input.requestKey());
            fresh.setContactDueAt(Instant.now().plus(24, ChronoUnit.HOURS));
            return requests.saveAndFlush(fresh);
        });
        return response(request, false);
    }
    @Transactional(readOnly=true)
    public ObjectNode mine(int page, int size) { return page(requests.findByUserIdAndDeletedFalseOrderByCreatedAtDesc(PlacementAccess.user(), PlacementAttemptService.paging(page, size)), false); }
    /** Admin queue, newest first; `student` (name, email, code...) is resolved to user ids at Auth and filters on the server. */
    @Transactional(readOnly=true)
    public ObjectNode list(int page, int size, String student) {
        PlacementAccess.admin();
        IdentityClient.UserSearchResult found = PlacementUsers.hasText(student) ? identity.searchUserIds(student.trim()) : null;
        var paging = PlacementAttemptService.paging(page, size);
        Page<PlacementConsultation> data = found == null ? requests.findByDeletedFalseOrderByCreatedAtDesc(paging)
                : found.userIds().isEmpty() ? Page.empty(paging)
                : requests.findByDeletedFalseAndUserIdInOrderByCreatedAtDesc(found.userIds(), paging);
        ObjectNode out = page(data, true);
        if (found != null) out.put("studentSearchTruncated", found.truncated());
        return out;
    }
    public ObjectNode handle(String id, PlacementRequests.HandleConsult input) {
        PlacementAccess.admin();
        PlacementConsultation request = requests.lockById(id).orElseThrow(PlacementAccess::missing);
        if (("RESOLVED".equals(request.getStatus()) || "CANCELLED".equals(request.getStatus())) && !input.status().name().equals(request.getStatus()))
            throw PlacementAccess.invalid("Yêu cầu tư vấn đã kết thúc");
        request.setStatus(input.status().name()); request.setHandledBy(PlacementAccess.user()); request.setInternalNote(input.internalNote());
        return response(request, true);
    }
    private ObjectNode page(Page<PlacementConsultation> data, boolean admin) {
        ObjectNode out = mapper.createObjectNode().put("totalElements", data.getTotalElements()).put("totalPages", data.getTotalPages());
        var items = out.putArray("items");
        // One Auth lookup per page for the requester and the admin who handled it.
        Map<String, IdentityClient.UserSummary> users = admin && data.hasContent() ? identity.lookupByIds(data.stream()
                .flatMap(item -> Stream.of(item.getUserId(), item.getHandledBy())).filter(Objects::nonNull).toList()) : Map.of();
        data.forEach(item -> items.add(response(item, admin, users)));
        return out;
    }
    private ObjectNode response(PlacementConsultation request, boolean admin, Map<String, IdentityClient.UserSummary> users) {
        ObjectNode out = mapper.createObjectNode().put("id", request.getId()).put("status", request.getStatus())
                .put("createdAt", request.getCreatedAt().toString()).put("contactDueAt", request.getContactDueAt().toString());
        if (admin) {
            out.put("userId", request.getUserId()).put("handledBy", request.getHandledBy()).put("internalNote", request.getInternalNote());
            PlacementUsers.put(out, users, request.getUserId());
            IdentityClient.UserSummary handler = request.getHandledBy() == null ? null : users.get(request.getHandledBy());
            out.put("handledByName", handler == null ? null : handler.getFullName());
        }
        return out;
    }
    private ObjectNode response(PlacementConsultation request, boolean admin) { return response(request, admin, Map.of()); }
}
