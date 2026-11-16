'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'source/moyun.single.html'), 'utf8');
const constants = source.slice(source.indexOf('const MOYUN_PROJECT_INTRO ='), source.indexOf('function deepClone(o)'));
const setup = source.slice(source.indexOf('    const projectIntro = MOYUN_PROJECT_INTRO;'), source.indexOf('    function openConfirm(cfg, cb)'));
const history = '114c9be c1f277 b0d000 350fa1 8abdf43 d82c533 c703975 3411176 e965e03 be72a7a b87cc10 0226e65 a5b0535 778c6e2 b79385d 6606aea 9ebde75 87e115e e931e9d'.split(' ');
const list = new Function(constants + ';return WEB_UPDATE_ANNOUNCEMENTS;')();

function app(seen = {}, width = 360, singleNotice = false) {
  const records = new Map(Object.entries(seen));
  const storage = {getItem:key=>records.get(key) ?? null,setItem:(key,value)=>records.set(key,value)};
  const testConstants = singleNotice ? constants.slice(0, constants.indexOf('const WEB_UPDATE_ANNOUNCEMENTS =')) + 'const WEB_UPDATE_ANNOUNCEMENTS = [' + JSON.stringify(list[0]) + '];const WEB_UPDATE_ANNOUNCEMENT = WEB_UPDATE_ANNOUNCEMENTS[0];' + constants.slice(constants.indexOf('const WEB_UPDATE_ANNOUNCEMENT_SEEN_KEY =')) : constants;
  const state = new Function('ref', 'computed', 'nextTick', 'localStorage', 'window', testConstants + setup + ';return {openWebUpdateAnnouncement,dismissWebUpdateAnnouncement,getPendingWebAnnouncement,viewEarlierAnnouncement,viewNewerAnnouncement,startWebAnnouncementSwipe,finishWebAnnouncementSwipe,webUpdateAnnouncement,webAnnouncementBrowseMode,webAnnouncementIndex,webAnnouncementScroll,webAnnouncementLive,showWebUpdateAnnouncement,isFirstRunGuide,canViewEarlierAnnouncement,canViewNewerAnnouncement};')(
    value=>({value}), getter=>({get value(){return getter();}}), callback=>callback?.(), storage, {innerWidth:width}
  );
  return {state,records};
}

test('1116 notice leads the list and historical notices retain their exact original objects', () => {
  assert.equal(list.length, history.length + 1);
  assert.equal(list[0].id, 'web-2026-11-16-1116-update');
  assert.equal(list[0].title, '1116更新');
  assert.equal(list[0].publishedAt, '2026-11-16');
  assert.doesNotMatch(JSON.stringify(list[0]), /v0\.0\.19/);
  assert.equal(new Set(list.map(item=>item.id)).size, list.length);
  history.forEach((commit,index) => {
    const original = execFileSync('git', ['-C',root,'show',commit+':source/moyun.single.html'], {encoding:'utf8',maxBuffer:12*1024*1024});
    const start = original.indexOf('const WEB_UPDATE_ANNOUNCEMENT = Object.freeze({');
    const end = original.indexOf(String.fromCharCode(10) + '});', start) + 4;
    assert.ok(start >= 0 && end > start, commit);
    const expected = new Function(original.slice(start,end) + ';return WEB_UPDATE_ANNOUNCEMENT;')();
    assert.deepEqual(list[index + 1], expected, commit);
  });
});

test('one available notice disables both directions without errors', () => {
  const {state:s} = app({},360,true);
  s.openWebUpdateAnnouncement(true);
  assert.equal(s.canViewEarlierAnnouncement.value,false);
  assert.equal(s.canViewNewerAnnouncement.value,false);
  s.viewEarlierAnnouncement();s.viewNewerAnnouncement();
  assert.equal(s.webAnnouncementIndex.value,0);
  assert.equal(s.webUpdateAnnouncement.value.id,list[0].id);
});

test('first browser sees guide without paging, then latest; reading old notices only marks latest seen', () => {
  const {state:s,records} = app();
  assert.equal(s.openWebUpdateAnnouncement(), true);
  assert.equal(s.isFirstRunGuide.value, true);
  s.viewEarlierAnnouncement();
  assert.equal(s.webAnnouncementIndex.value, 0);
  s.dismissWebUpdateAnnouncement();
  assert.equal(s.isFirstRunGuide.value, false);
  assert.equal(s.webUpdateAnnouncement.value.id, list[0].id);
  for(let i=0;i<list.length+2;i++)s.viewEarlierAnnouncement();
  assert.equal(s.webAnnouncementIndex.value, list.length-1);
  assert.equal(s.canViewEarlierAnnouncement.value, false);
  s.dismissWebUpdateAnnouncement();
  assert.equal(records.get('moyun_web_update_announcement_seen'), list[0].id);
  assert.equal(s.getPendingWebAnnouncement(), null);
});

test('browse starts latest, preserves read status, resets scroll, and announces page changes', () => {
  const {state:s,records} = app({'moyun_web_update_announcement_seen':'older-unread-id'});
  s.openWebUpdateAnnouncement(true);
  assert.equal(s.webAnnouncementBrowseMode.value, true);
  assert.equal(s.canViewNewerAnnouncement.value, false);
  s.webAnnouncementScroll.value = {scrollTop:240};
  s.viewEarlierAnnouncement();
  assert.equal(s.webAnnouncementScroll.value.scrollTop, 0);
  assert.equal(s.webAnnouncementLive.value, '公告 2/'+list.length+'：'+list[1].title);
  s.dismissWebUpdateAnnouncement();
  assert.equal(records.get('moyun_web_update_announcement_seen'), 'older-unread-id');
  s.openWebUpdateAnnouncement(true);
  assert.equal(s.webAnnouncementIndex.value, 0);
  assert.equal(s.webUpdateAnnouncement.value.id, list[0].id);
});

test('swipe requires horizontal distance and ignores vertical or desktop gestures', () => {
  const swipe = (s,x,y) => {s.startWebAnnouncementSwipe({touches:[{clientX:100,clientY:100}]});s.finishWebAnnouncementSwipe({changedTouches:[{clientX:100+x,clientY:100+y}]});};
  const {state:s} = app();
  s.openWebUpdateAnnouncement(true);
  swipe(s,49,0); assert.equal(s.webAnnouncementIndex.value,0);
  swipe(s,60,40); assert.equal(s.webAnnouncementIndex.value,0);
  swipe(s,50,10); assert.equal(s.webAnnouncementIndex.value,1);
  swipe(s,-50,0); assert.equal(s.webAnnouncementIndex.value,0);
  const {state:desktop} = app({},1280);
  desktop.openWebUpdateAnnouncement(true); swipe(desktop,90,0);
  assert.equal(desktop.webAnnouncementIndex.value,0);
});
