import { filterTopics } from './studyInsights.js';

const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function filterHierarchyTopics(topics, filter = {}) {
  const query = normalize((filter.query || '').trim());
  return filterTopics(topics.filter(topic => !query || normalize([...(topic.groupPath || []), topic.name].join(' ')).includes(query)), {...filter, query: ''});
}

// Groups hold references to the original topics; practice and topic IDs stay intact.
export function buildTopicTree(topics) {
  const root = { children: [], topics: [], items: [] };
  for (const topic of topics) {
    let node = root;
    const path = [];
    for (const name of topic.groupPath || []) {
      path.push(name);
      let child = node.children.find(group => group.name === name);
      if (!child) { child = { name, key: JSON.stringify(path), children: [], topics: [], items: [] }; node.children.push(child); node.items.push({group: child}); }
      node = child;
    }
    node.topics.push(topic);
    node.items.push({topic});
  }
  return root;
}

export function topicsInGroup(group) {
  return [...group.topics, ...group.children.flatMap(topicsInGroup)];
}
