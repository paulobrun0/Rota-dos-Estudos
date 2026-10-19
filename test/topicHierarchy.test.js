import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildTopicTree, filterHierarchyTopics, topicsInGroup} from '../src/lib/topicHierarchy.js';
import {prepareEditalTemplate, exportEditalTemplate} from '../src/lib/editalTemplates.js';

test('nested groups preserve topic identity, practice, links and first appearance order', () => {
  const topics = [
    {id:'a',name:'Acentuação',groupPath:['Ortografia'],questionsTotal:15,links:{tec:'https://www.tecconcursos.com.br/questoes/cadernos/1'}},
    {id:'b',name:'Pronomes pessoais',groupPath:['Morfologia','Pronomes']},
    {id:'c',name:'Uso do hífen',groupPath:['Ortografia']},
    {id:'d',name:'Crase'},
  ];
  const before = JSON.stringify(topics);
  const tree = buildTopicTree(topics);
  assert.deepEqual(tree.items.map(item=>item.group?.name || item.topic.name),['Ortografia','Morfologia','Crase']);
  assert.deepEqual(topicsInGroup(tree.children[0]),[topics[0],topics[2]]);
  assert.equal(tree.children[0].topics[0],topics[0]);
  assert.equal(JSON.stringify(topics),before);
});

test('searching a parent group finds descendants while respecting status and ordering', () => {
  const topics=[{id:'a',name:'Uso do hífen',groupPath:['Ortografia'],status:'pendente'},{id:'b',name:'Acentuação',groupPath:['Ortografia'],status:'estudado'},{id:'c',name:'Verbos',status:'pendente'}];
  assert.deepEqual(filterHierarchyTopics(topics,{query:'ortografia',sort:'name'}).map(t=>t.id),['b','a']);
  assert.deepEqual(filterHierarchyTopics(topics,{query:'ORTOGRAFIA',status:'pending'}).map(t=>t.id),['a']);
  assert.deepEqual(filterHierarchyTopics(topics,{query:'acentuacao'}).map(t=>t.id),['b']);
});

test('template round trip preserves hierarchy and rejects malformed paths', () => {
  const template={name:'PM AL',materias:[{name:'Português',topics:[{name:'Acentuação',groupPath:['Ortografia'],links:{tec:'https://www.tecconcursos.com.br/questoes/cadernos/1'}}]}]};
  const saved=prepareEditalTemplate(template);
  assert.deepEqual(exportEditalTemplate(saved).materias[0].topics[0].groupPath,['Ortografia']);
  assert.equal(saved.materias[0].topics[0].links.tec,template.materias[0].topics[0].links.tec);
  assert.throws(()=>prepareEditalTemplate({...template,materias:[{name:'Português',topics:[{name:'Acentuação',groupPath:'Ortografia'}]}]}),/grupos/);
});
