export function addPrefixToTopic(rawTopic: string, config: { topicPrefix?: string }) {
  let topic = rawTopic.slice() // copy original topic

  topic = topic.replace('*', '_asterisk_') // * symbol is forbidden by FCM topic format

  if (config.topicPrefix && topic.indexOf(config.topicPrefix) !== 0) {
    topic = config.topicPrefix + topic
  }

  return topic
}
