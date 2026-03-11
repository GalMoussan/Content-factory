import type { ScoredTopic, ScoredTopicList } from '@shared/schemas';

/**
 * Select the highest-scoring topic from the scored topic list.
 */
export function selectTopTopic(list: ScoredTopicList): ScoredTopic {
  if (list.topics.length === 0) {
    throw new Error('Cannot select a topic from an empty topic list.');
  }
  return list.topics.reduce((best, topic) =>
    topic.score > best.score ? topic : best,
  );
}
