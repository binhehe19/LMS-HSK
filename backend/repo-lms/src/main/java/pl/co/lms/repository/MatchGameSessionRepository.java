package pl.co.lms.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import pl.co.lms.entity.MatchGameSession;
import java.util.Optional;

public interface MatchGameSessionRepository extends JpaRepository<MatchGameSession, String> {
    Optional<MatchGameSession> findByIdAndUserIdAndDeletedFalse(String id, String userId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from MatchGameSession s where s.id = :id and s.userId = :userId and s.deleted = false")
    Optional<MatchGameSession> lockOwned(@Param("id") String id, @Param("userId") String userId);

    List<MatchGameSession> findByDatasetKeyAndUserIdAndCompletedAtIsNotNullAndDeletedFalseOrderByScoreDescElapsedTenthsAsc(
            String datasetKey, String userId, Pageable pageable);

    interface RankedScore {
        String getUserId(); String getDisplayName(); Integer getScore(); Integer getElapsedTenths();
    }
    // Rank each user's personal best BEFORE limiting, so repeat attempts cannot hide other users.
    @Query(value = """
        WITH ranked AS (
            SELECT s.*, ROW_NUMBER() OVER (
                PARTITION BY user_id ORDER BY score DESC, elapsed_tenths ASC, completed_at ASC, id ASC
            ) AS best_rank
            FROM match_game_sessions s
            WHERE dataset_key = :datasetKey AND deleted = false AND completed_at IS NOT NULL
        )
        SELECT user_id AS "userId", display_name AS "displayName", score AS "score", elapsed_tenths AS "elapsedTenths"
        FROM ranked WHERE best_rank = 1
        ORDER BY score DESC, elapsed_tenths ASC, completed_at ASC, id ASC
        LIMIT 50
        """, nativeQuery = true)
    List<RankedScore> leaderboard(@Param("datasetKey") String datasetKey);
}
