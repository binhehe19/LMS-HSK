package pl.co.lms.service.placement;

import com.fasterxml.jackson.databind.node.ObjectNode;
import pl.co.lms.client.IdentityClient;
import java.util.Map;

/** Adds the Auth-side name, email and code of a user to an admin response; the name is looked up per request, never stored. */
final class PlacementUsers {
    private PlacementUsers() {}

    static boolean hasText(String value) { return value != null && !value.isBlank(); }

    /** userName/userEmail/userCode are null when Auth does not answer or does not know the id (the screen then falls back to the id). */
    static void put(ObjectNode out, Map<String, IdentityClient.UserSummary> users, String userId) {
        IdentityClient.UserSummary user = users.get(userId);
        out.put("userName", user == null ? null : user.getFullName())
                .put("userEmail", user == null ? null : user.getEmail())
                .put("userCode", user == null ? null : user.getUserCode());
    }
}
