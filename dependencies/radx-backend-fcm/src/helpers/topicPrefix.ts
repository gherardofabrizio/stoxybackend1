export function addPrefixToTopic(rawTopic: string, config: { topicPrefix?: string }) {
  let topic = rawTopic.slice() // copy original topic

  if (config.topicPrefix && topic.indexOf(config.topicPrefix) !== 0) {
    topic = config.topicPrefix + topic
  }

  return topic
}
