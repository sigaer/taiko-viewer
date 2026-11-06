import test from 'node:test';
import assert from 'node:assert/strict';
import { generateForumThreadTitle } from '../server/utils/forum/thread-title.ts';
const title = (text, locale = 'zh') => generateForumThreadTitle([{ type: 'paragraph', text }], locale);

test('automatic title uses the first sentence and preserves short body text', () => {
  assert.equal(title('今天全良了！再练一首。'), '今天全良了！');
  assert.equal(title('初全良'), '初全良');
  assert.equal(title('First clear. More practice.'), 'First clear.');
  assert.equal(title('最初の段落\n次の段落', 'ja'), '最初の段落');
});
test('image-only and whitespace bodies use localized titles', () => {
  assert.equal(title('  '), '图片分享');
  assert.equal(generateForumThreadTitle([{type:'image', imageUrl:'/image.png'}], 'ja'), '画像共有');
});
test('automatic titles respect the existing limit without splitting graphemes', () => {
  for (const character of ['😀', '👨‍👩‍👧‍👦', 'か\u3099', '中']) {
    const result = title(character.repeat(150));
    assert.ok(result.length <= 120);
    assert.ok(result.endsWith('…'));
    assert.equal(result.slice(0, -1).split(character).join(''), '');
  }
});
