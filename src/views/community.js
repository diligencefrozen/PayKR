import { el,button } from './dom.js';
import { getLocale } from '../i18n/registry.js';
import { communityId,communityRequest } from '../services/community.js';
import { communityConfig } from '../config/community.js';
const words={ko:['이용자 제보','애플페이로 결제하셨나요?','결제 성공','결제 실패','검토된 제보','댓글','익명 닉네임','댓글을 입력해 주세요.','등록','가맹점 정보 오류 제보','폐업','이전','정보 오류','기타','상세 내용을 입력해 주세요.','검토 대기 중입니다. 승인 후 공개됩니다.','연결할 수 없습니다. 다시 시도해 주세요.','새로고침','공개 댓글이 없습니다.','공공데이터 가맹점에서만 제보할 수 있습니다.','커뮤니티 서비스 연결 준비 중','요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.','브라우저 저장소를 허용해야 익명 제보가 가능합니다.','익명 제보는 결제 보증이 아닙니다.','내 제보','검토 대기','공개','불러오는 중…'],en:['Community reports','Did you pay with Apple Pay?','Payment succeeded','Payment failed','Reviewed reports','Comments','Anonymous nickname','Write a comment.','Submit','Report incorrect store information','Closed','Moved','Incorrect information','Other','Describe the issue.','Pending review. Visible after approval.','Could not connect. Please retry.','Refresh','No public comments yet.','Reports are available only for public-data merchants.','Community service setup in progress','Too many requests. Try again shortly.','Browser storage is required for anonymous reports.','Anonymous reports do not guarantee acceptance.','Your report','Pending','Published','Loading…']};
export function renderCommunityPanel(record){
  const w=words[getLocale()==='ko'?'ko':'en']; const box=el('section',undefined,'paykr-community');box.append(el('h3',w[0]));
  const id=communityId(record);if(!id||!communityConfig.apiBase){
    const notice=el('p', !id ? (getLocale()==='ko'?'이 매장은 아직 제보 가능한 공공데이터 가맹점과 연결되지 않았습니다.':'This store is not yet linked to an eligible public-data merchant.') : w[20], 'community-notice');
    const disabled=el('div',undefined,'community-unavailable');
    const actions=el('div',undefined,'paykr-community-actions');
    for(const label of [w[2],w[3]]){const b=button(label,()=>{});b.disabled=true;actions.append(b);}
    const nick=el('input');nick.placeholder=w[6];nick.disabled=true;nick.setAttribute('aria-label',w[6]);
    const body=el('textarea');body.placeholder=w[7];body.disabled=true;body.setAttribute('aria-label',w[7]);
    const submit=button(w[8],()=>{});submit.disabled=true;
    const report=button(w[9],()=>{});report.disabled=true;
    disabled.append(el('p',w[1]),actions,el('h3',w[5]),nick,body,submit,report);
    box.append(notice,disabled);return box;
  }
  const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const result=el('p',w[27]);const mine=el('p');const actions=el('div',undefined,'paykr-community-actions');
  const commentList=el('div',undefined,'paykr-community-list');let busy=false, revision=0;
  const failure=e=>status.textContent=w[e.message==='RATE_LIMIT'?21:e.message==='STORAGE'?22:16];
  async function load(){const v=++revision;try{const data=await communityRequest(id);if(v!==revision)return;result.textContent=`${w[4]} · ${w[2]} ${data.success} / ${w[3]} ${data.failure}`;mine.textContent=data.mine?`${w[24]}: ${w[data.mine.outcome==='success'?2:3]} (${w[data.mine.status==='pending'?25:26]})`:'';commentList.replaceChildren();if(!data.comments.length)commentList.append(el('p',w[18]));for(const item of data.comments){const row=el('article');row.append(el('strong',item.nickname),el('small',item.createdAt+(item.status==='pending'?' · '+w[25]:'')),el('p',item.body));commentList.append(row);}}catch(e){if(v===revision){result.textContent=w[16];failure(e);}}}
  async function submit(payload,done){if(busy)return;busy=true;box.setAttribute('aria-busy','true');for(const b of box.querySelectorAll('button'))b.disabled=true;try{await communityRequest(id,payload);status.textContent=w[15];done?.();await load();}catch(e){failure(e);}finally{busy=false;box.removeAttribute('aria-busy');for(const b of box.querySelectorAll('button'))b.disabled=false;}}
  actions.append(button(w[2],()=>submit({type:'payment',outcome:'success'})),button(w[3],()=>submit({type:'payment',outcome:'failure'})));
  box.append(el('p',w[1]),actions,result,mine,el('small',w[23]),status,button(w[17],load));
  const form=el('form');const nick=el('input');nick.placeholder=w[6];nick.setAttribute('aria-label',w[6]);nick.maxLength=40;nick.required=true;
  const body=el('textarea');body.placeholder=w[7];body.setAttribute('aria-label',w[7]);body.maxLength=1000;body.required=true;
  const send=button(w[8],()=>{});send.type='submit';form.append(nick,body,send);form.onsubmit=e=>{e.preventDefault();if(nick.value.trim()&&body.value.trim())submit({type:'comment',nickname:nick.value,body:body.value},()=>body.value='');};
  box.append(el('h3',w[5]),form,commentList);
  const report=el('details');report.append(el('summary',w[9]));const rf=el('form');const select=el('select');select.setAttribute('aria-label',w[9]);['closed','moved','incorrect','other'].forEach((k,i)=>{const opt=el('option',w[10+i]);opt.value=k;select.append(opt);});const reason=el('textarea');reason.placeholder=w[14];reason.setAttribute('aria-label',w[14]);reason.required=true;reason.maxLength=1000;const rs=button(w[8],()=>{});rs.type='submit';rf.append(select,reason,rs);rf.onsubmit=e=>{e.preventDefault();if(reason.value.trim())submit({type:'merchant',kind:select.value,body:reason.value},()=>{reason.value='';report.open=false;});};report.append(rf);box.append(report);load();return box;
}
