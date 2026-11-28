import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {qualityMatcher,qualityMerchant,duplicateCandidates} from '../src/models/merchant-quality.js';
import {parseCsv,audit} from '../scripts/merchants/audit.mjs';
const brands=JSON.parse(await readFile(new URL('../src/data/stores.json',import.meta.url)));
const q=qualityMatcher(brands);
for(const [name,category,id] of [['씨유 수원역점','편의점','store-2'],['지에스25수원점','편의점','store-1'],['스타벅스커피코리아 강남점','카페','store-8'],['뚜레쥬르','빵/도넛','store-65'],['현대아울렛 가산점','아울렛','store-40'],['이니스프리한성대점','화장품 소매업','store-49'],['맥도날드 강남점','버거','store-75'],['홈플러스 익스프레스 역삼점','슈퍼마켓','store-56']])assert.equal(q.match(name,category)?.id,id,name);
for(const [name,category] of [['현대아울렛볼빅 가산점','기타 의류 소매업'],['갤러리아알레그리 본점','남성 의류 소매업'],['스타필드마인드브릿지 코엑스점','기타 의류 소매업'],['세븐일레븐셀프빨래방 선정릉점','셀프 빨래방'],['세븐일레븐성내만화 거리점','만화방'],['아트박스','명함/간판/광고물 제작'],['롯데리아응암주 오거리점','피자'],['CUCKOO','편의점'],['스타벅스','편의점'],['코리아세븐','편의점'],['스트릿','백반/한정식']])assert.equal(q.match(name,category),null,name);
// Broad parent category must never override a conflicting detailed category.
assert.equal(q.match('세븐일레븐',{indsMclsNm:'편의점',indsSclsNm:'만화방'}),null);
const byCode=qualityMatcher(brands,{codeLabels:{TEST_CODE:'편의점'}});assert.equal(byCode.match('씨유',{indsSclsCd:'TEST_CODE'})?.id,'store-2');
const raw={bizesId:'MA01',bizesNm:'씨유',brchNm:'강남점',indsSclsNm:'편의점',lat:37.55,lon:127,rdnmAdr:'서울 강남구 1',ctprvnCd:'11'};
assert.equal(qualityMerchant(raw,q).row.brand_id,'store-2');assert.equal(qualityMerchant({...raw,lat:''},q).row,null);
assert.equal(qualityMerchant({...raw,brchNm:'셀프빨래방'},q).row,null);
const rows=parseCsv('id,brand_id,name,address,category,lat,lng\r\na,store-2,씨유,"서울, 테스트 1",편의점,37.55,127\r\nb,store-2,씨유,"서울, 테스트 1",편의점,37.55,127\r\nc,store-40,현대아울렛볼빅 가산점,서울,기타 의류 소매업,37.55,127\r\n');
const result=audit(rows,brands);assert.equal(result.summary.accepted,2);assert.equal(result.summary.review,1);assert.equal(duplicateCandidates(rows).length,1);assert.equal(result.duplicates[0].nearby,true);
console.log('PASS: v2 aliases, specific category, mall tenant guard, ambiguous names, code-label override, safe read-only audit and duplicate candidates');
