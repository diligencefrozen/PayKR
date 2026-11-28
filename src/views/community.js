import { el,button } from './dom.js';
import { getLocale } from '../i18n/registry.js';
import { communityId,communityRequest } from '../services/community.js';
import { communityConfig } from '../config/community.js';
const words={
  ko:{title:'매장 리뷰',question:'애플페이로 결제하셨나요?',success:'결제 성공',failure:'결제 실패',counts:'공개 결제 후기',comments:'이용 후기',nickname:'익명 닉네임',placeholder:'결제 경험이나 매장 이용 후기를 남겨 주세요.',submit:'리뷰 등록',pendingNotice:'리뷰가 등록되었습니다. 검토 후 공개됩니다.',error:'연결할 수 없습니다. 다시 시도해 주세요.',refresh:'새로고침',empty:'아직 공개된 리뷰가 없습니다. 첫 후기를 남겨 보세요.',invalid:'매장 식별 정보를 확인할 수 없어 리뷰를 등록할 수 없습니다.',unconfigured:'리뷰 서비스 연결 준비 중입니다.',rate:'요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',storage:'브라우저 저장소를 허용해야 익명 리뷰를 등록할 수 있습니다.',disclaimer:'이용자 후기는 실제 결제 가능 여부를 보장하지 않습니다.',mine:'내 결제 후기',pending:'검토 대기',published:'공개',loading:'불러오는 중…'},
  en:{title:'Store reviews',question:'Did you pay with Apple Pay?',success:'Payment succeeded',failure:'Payment failed',counts:'Published payment experiences',comments:'Visitor reviews',nickname:'Anonymous nickname',placeholder:'Share your payment or store experience.',submit:'Post review',pendingNotice:'Review submitted. Visible after moderation.',error:'Could not connect. Please retry.',refresh:'Refresh',empty:'No public reviews yet. Be the first to leave one.',invalid:'Store identification is unavailable.',unconfigured:'Review service setup in progress.',rate:'Too many requests. Try again shortly.',storage:'Browser storage is required to post anonymous reviews.',disclaimer:'User reviews do not guarantee payment acceptance.',mine:'Your payment experience',pending:'Pending',published:'Published',loading:'Loading…'}
};
export function renderCommunityPanel(record){
  const w=words[getLocale()==='ko'?'ko':'en'];
  const box=el('section',undefined,'paykr-community');box.append(el('h3',w.title));
  const id=communityId(record);
  const available=Boolean(id&&communityConfig.apiBase);
  if(!available)box.append(el('p',id?w.unconfigured:w.invalid,'community-notice'));
  const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const result=el('p',available?w.loading:'');const mine=el('p');const actions=el('div',undefined,'paykr-community-actions');
  const commentList=el('div',undefined,'paykr-community-list');let busy=false,revision=0;
  const failure=e=>status.textContent=e.message==='RATE_LIMIT'?w.rate:e.message==='STORAGE'?w.storage:w.error;
  async function load(){
    if(!available)return;
    const v=++revision;
    try{
      const data=await communityRequest(id);if(v!==revision)return;
      result.textContent=`${w.counts} · ${w.success} ${data.success} / ${w.failure} ${data.failure}`;
      mine.textContent=data.mine?`${w.mine}: ${w[data.mine.outcome==='success'?'success':'failure']} (${w[data.mine.status==='pending'?'pending':'published']})`:'';
      commentList.replaceChildren();if(!data.comments.length)commentList.append(el('p',w.empty));
      for(const item of data.comments){const row=el('article');row.append(el('strong',item.nickname),el('small',item.createdAt+(item.status==='pending'?' · '+w.pending:'')),el('p',item.body));commentList.append(row);}
    }catch(e){if(v===revision){result.textContent=w.error;failure(e);}}
  }
  async function submit(payload,done){
    if(!available||busy)return;busy=true;box.setAttribute('aria-busy','true');for(const b of box.querySelectorAll('button'))b.disabled=true;
    try{await communityRequest(id,payload);status.textContent=w.pendingNotice;done?.();await load();}
    catch(e){failure(e);}finally{busy=false;box.removeAttribute('aria-busy');for(const b of box.querySelectorAll('button'))b.disabled=false;}
  }
  actions.append(button(w.success,()=>submit({type:'payment',outcome:'success'})),button(w.failure,()=>submit({type:'payment',outcome:'failure'})));
  box.append(el('p',w.question),actions,result,mine,el('small',w.disclaimer),status);
  if(available)box.append(button(w.refresh,load));
  const form=el('form');const nick=el('input');nick.placeholder=w.nickname;nick.setAttribute('aria-label',w.nickname);nick.maxLength=40;nick.required=true;
  const body=el('textarea');body.placeholder=w.placeholder;body.setAttribute('aria-label',w.placeholder);body.maxLength=1000;body.required=true;
  const send=button(w.submit,()=>{});send.type='submit';form.append(nick,body,send);
  form.onsubmit=e=>{e.preventDefault();if(nick.value.trim()&&body.value.trim())submit({type:'comment',nickname:nick.value,body:body.value},()=>body.value='');};
  box.append(el('h3',w.comments),form,commentList);
  if(!available)for(const field of box.querySelectorAll('button,input,textarea'))field.disabled=true;
  else load();
  return box;
}
