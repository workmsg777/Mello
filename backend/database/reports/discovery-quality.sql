-- Attribute each unordered pair to its first recorded fresh-feed exposure.
-- Historical impressions with no recorded scorer remain explicitly unknown.
WITH first_exposure AS (
  SELECT DISTINCT ON (LEAST(user_id,target_id),GREATEST(user_id,target_id))
         LEAST(user_id,target_id) AS user_low,GREATEST(user_id,target_id) AS user_high,
         algorithm_version,coalesce(served_version,'UNKNOWN') AS served_version,first_seen_at
  FROM discovery_impressions
  ORDER BY LEAST(user_id,target_id),GREATEST(user_id,target_id),first_seen_at,session_id,target_id
), outcomes AS (
  SELECT e.*,m.id AS match_id,first_message.created_at AS first_message_at,reply.created_at AS reply_at,
         feedback.responses,feedback.positive,
         EXISTS(SELECT 1 FROM discovery_exclusions x WHERE ((x.actor_id=e.user_low AND x.target_id=e.user_high) OR (x.actor_id=e.user_high AND x.target_id=e.user_low)) AND x.reported_at BETWEEN e.first_seen_at AND e.first_seen_at+interval '7 days') AS reported,
         EXISTS(SELECT 1 FROM discovery_exclusions x WHERE
           ((x.actor_id=e.user_low AND x.target_id=e.user_high) OR (x.actor_id=e.user_high AND x.target_id=e.user_low))
           AND x.created_at BETWEEN e.first_seen_at AND e.first_seen_at+interval '7 days') AS excluded
  FROM first_exposure e LEFT JOIN matches m ON m.user_low=e.user_low AND m.user_high=e.user_high
    AND m.created_at BETWEEN e.first_seen_at AND e.first_seen_at+interval '7 days'
    AND EXISTS(SELECT 1 FROM discovery_actions d WHERE d.actor_id=m.user_low AND d.target_id=m.user_high AND d.action='LIKE' AND d.source='USER')
    AND EXISTS(SELECT 1 FROM discovery_actions d WHERE d.actor_id=m.user_high AND d.target_id=m.user_low AND d.action='LIKE' AND d.source='USER')
  LEFT JOIN LATERAL(SELECT sender_id,created_at,sequence FROM chat_messages WHERE match_id=m.id ORDER BY sequence LIMIT 1) first_message ON true
  LEFT JOIN LATERAL(SELECT created_at FROM chat_messages WHERE match_id=m.id AND sender_id<>first_message.sender_id AND sequence>first_message.sequence ORDER BY sequence LIMIT 1) reply ON true
  LEFT JOIN LATERAL(SELECT count(*) AS responses,count(*) FILTER(WHERE worthwhile) AS positive FROM match_feedback f WHERE f.match_id=m.id AND f.updated_at BETWEEN e.first_seen_at AND e.first_seen_at+interval '7 days') feedback ON true
  WHERE e.first_seen_at <= now()-interval '7 days'
)
SELECT algorithm_version,served_version,count(*) AS exposed_pairs,count(match_id) AS mutual_matches_within_7_days,
       round(count(match_id)::numeric/count(*),4) AS mutual_match_rate,
       count(*) FILTER(WHERE reply_at<=first_seen_at+interval '7 days') AS two_way_conversations_within_7_days,
       round(count(*) FILTER(WHERE reply_at<=first_seen_at+interval '7 days')::numeric/count(*),4) AS two_way_conversations_per_exposed_pair,
       sum(responses) AS optional_feedback_responses,sum(positive) AS worthwhile_responses,
       count(*) FILTER(WHERE positive=2) AS both_found_worthwhile,
       count(*) FILTER(WHERE reported) AS reported_pairs_within_7_days,
       count(*) FILTER(WHERE excluded) AS excluded_pairs_within_7_days,
       count(*) FILTER(WHERE first_message_at<=now()-interval '7 days') AS mature_first_message_conversations,
       round(count(*) FILTER(WHERE first_message_at<=now()-interval '7 days' AND reply_at<=first_message_at+interval '7 days')::numeric/
         NULLIF(count(*) FILTER(WHERE first_message_at<=now()-interval '7 days'),0),4) AS reply_rate_within_7_days
FROM outcomes GROUP BY algorithm_version,served_version;
