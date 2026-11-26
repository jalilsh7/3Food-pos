export function asciiDigits(value:string){
  return value.replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632));
}
export function jalaliToIso(value:string):string|null{
  const match=asciiDigits(value).trim().match(/^(\d{4})[/-](\d{1,2})[-/](\d{1,2})$/);
  if(!match)return null;
  let jy=Number(match[1]); const jm=Number(match[2]),jd=Number(match[3]);
  if(jm<1||jm>12||jd<1||jd>31)return null;
  jy+=1595;
  let days=-355668+365*jy+Math.floor(jy/33)*8+Math.floor(((jy%33)+3)/4)+jd+(jm<7?(jm-1)*31:(jm-7)*30+186);
  let gy=400*Math.floor(days/146097);days%=146097;
  if(days>36524){gy+=100*Math.floor(--days/36524);days%=36524;if(days>=365)days++;}
  gy+=4*Math.floor(days/1461);days%=1461;
  if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365;}
  let gd=days+1;const leap=gy%4===0&&(gy%100!==0||gy%400===0);
  const monthDays=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];let gm=0;
  while(gm<12&&gd>monthDays[gm]){gd-=monthDays[gm];gm++;}
  if(gm>=12)return null;
  const iso=`${gy}-${String(gm+1).padStart(2,"0")}-${String(gd).padStart(2,"0")}`;
  const expected=`${jy-1595}/${String(jm).padStart(2,"0")}/${String(jd).padStart(2,"0")}`;
  if(asciiDigits(isoToJalali(iso)).replace(/\u200e/g,"")!==expected)return null;
  return iso;
}
export function isoToJalali(value:string){
  const parts=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(value+"T12:00:00Z"));
  const part=(type:string)=>parts.find(item=>item.type===type)?.value??"";
  return `${part("year")}/${part("month")}/${part("day")}`;
}
export function tehranDate(value: number | Date = Date.now()): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
