const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname, "../source/moyun.single.html"), "utf8");
test("分支图按parentId显示三层独立路线，自有章节统计准确，损坏的父级不会递归卡死", () => {
  const start = source.indexOf("    function buildBranchRouteMap(");
  const end = source.indexOf("    const branchRouteMap", start);
  const ctx = vm.createContext({});
  vm.runInContext(source.slice(start, end) + ";globalThis.route=buildBranchRouteMap;", ctx);
  const rows = [{id:"main",name:"主线"},{id:"b",parentId:"main",forkIndex:1,forkChapterId:"c2"},{id:"grandchild",parentId:"b",forkIndex:2,forkChapterId:"b3"},{id:"rewrite",forkIndex:-1},{id:"cycle",parentId:"cycle",forkIndex:0}];
  const chapters = [{id:"c1"},{id:"c2"},{id:"c3"},...Array.from({length:3},(_,i)=>({id:"b"+(i+1),branchId:"b"})),...Array.from({length:5},(_,i)=>({id:"g"+(i+1),branchId:"grandchild"}))];
  const result = ctx.route(rows, chapters);
  assert.equal(result.nodes.find(x=>x.id==="b").chapterCount,3);
  assert.equal(result.nodes.find(x=>x.id==="grandchild").chapterCount,5);
  assert.equal(result.positions.b.y,1);assert.equal(result.positions.grandchild.y,2);
  assert.ok(result.edges.some(edge=>edge.from==="main"&&edge.to==="b"));assert.ok(result.edges.some(edge=>edge.from==="b"&&edge.to==="grandchild"));
  assert.equal(result.nodes.find(x=>x.id==="rewrite").chapterCount,0);
  assert.equal(result.nodes.find(x=>x.id==="rewrite").forkChapter,0);
  assert.equal(Object.keys(result.positions).length,5);
  assert.ok(result.width>=320);
});
test("细纲入口不再引用已删除撤销函数，四个入口共享一个分支面板", () => {
  assert.doesNotMatch(source,/canUndoChapterOutlineAi|undoChapterOutlineAi/);
  assert.equal((source.match(/<branch-panel /g)||[]).length,1);
  assert.ok(source.split('@click="toggleBranchPanel($event,').length>=5);
  assert.doesNotMatch(source,/showTreeView|treeExpandedBranches|toggleTreeBranch|const treeData/);
});
