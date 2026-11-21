-- Fresh sessions in the last seven days, including eligible people below the first page.
WITH candidates AS (
  SELECT DISTINCT s.algorithm_version,i.target_id
  FROM discovery_feed_sessions s JOIN discovery_feed_items i ON i.session_id=s.id
  WHERE s.created_at >= now()-interval '7 days'
), seen AS (
  SELECT s.algorithm_version,i.target_id,count(DISTINCT i.user_id) AS viewers
  FROM discovery_impressions i JOIN discovery_feed_sessions s ON s.id=i.session_id
  WHERE s.created_at >= now()-interval '7 days'
  GROUP BY s.algorithm_version,i.target_id
)
SELECT c.algorithm_version,count(*) AS unique_eligible_people,
       count(*) FILTER (WHERE seen.viewers IS NULL) AS people_with_zero_exposure,
       percentile_disc(0.5) WITHIN GROUP (ORDER BY coalesce(seen.viewers,0)) AS median_unique_viewers
FROM candidates c LEFT JOIN seen USING(algorithm_version,target_id) GROUP BY c.algorithm_version;
