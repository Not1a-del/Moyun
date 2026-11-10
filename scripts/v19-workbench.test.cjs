const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname, "../source/moyun.single.html"), "utf8");
test("分支图统计包括分叉前正文，首章重写不继承正文，损坏的父级不会递归卡死", () => {
  const start = source.indexOf("    function buildBranchRouteMap(");
  const end = source.indexOf("    const branchRouteMap", start);
  const ctx = vm.createContext({});
  vm.runInContext(source.slice(start, end) + ";globalThis.route=buildBranchRouteMap;", ctx);
  const rows = [{id:"main",name:"主线"},{id:"b",forkIndex:1,forkFromChapterId:"c2"},{id:"rewrite",forkIndex:-1},{id:"cycle",parentId:"cycle",forkIndex:0}];
  const chapters = [{id:"c1"},{id:"c2"},{id:"c3"},{id:"b3",branchId:"b"}];
  const result = ctx.route(rows, chapters);
  assert.equal(result.nodes.find(x=>x.id==="b").chapterCount,3);
  assert.equal(result.nodes.find(x=>x.id==="rewrite").chapterCount,0);
  assert.equal(result.nodes.find(x=>x.id==="rewrite").forkChapter,0);
  assert.equal(Object.keys(result.positions).length,4);
  assert.ok(result.width>=320);
});
test("细纲入口不再引用已删除撤销函数，四个入口共享一个分支面板", () => {
  assert.doesNotMatch(source,/canUndoChapterOutlineAi|undoChapterOutlineAi/);
  assert.equal((source.match(/<branch-panel /g)||[]).length,1);
  assert.ok(source.split('@click="toggleBranchPanel($event,').length>=5);
  assert.doesNotMatch(source,/showTreeView|treeExpandedBranches|toggleTreeBranch|const treeData/);
});
