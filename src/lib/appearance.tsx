import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { phpApi, type AppearanceSettings } from "@/lib/api/php-client";
export const DEFAULT_APPEARANCE: AppearanceSettings = { primary:"#14532d",secondary:"#0f766e",mode:"light",fontFamily:"byekan",fontSize:15,cardRadius:16,buttonRadius:12,logoUrl:null };
type AppearanceContextValue={settings:AppearanceSettings;update:(patch:Partial<AppearanceSettings>)=>void;save:()=>Promise<void>;reset:()=>Promise<void>;uploadLogo:(file:File)=>Promise<void>;loading:boolean};
const AppearanceContext=createContext<AppearanceContextValue|null>(null);
function safeColor(value:string,fallback:string){return /^#[0-9a-f]{6}$/i.test(value)?value:fallback;}
function applyAppearance(s:AppearanceSettings){
 const root=document.documentElement,dark=s.mode==="dark";
 const fonts={byekan:'"IRANYekanWeb FarsiNum", Tahoma, sans-serif'};
 root.style.setProperty("--color-chili",safeColor(s.primary,DEFAULT_APPEARANCE.primary));root.style.setProperty("--color-leaf",safeColor(s.secondary,DEFAULT_APPEARANCE.secondary));
 root.style.setProperty("--color-bg",dark?"#111a16":"#f3f7f3");root.style.setProperty("--color-surface",dark?"#1b2821":"#ffffff");root.style.setProperty("--color-ink",dark?"#f0f6f1":"#17251d");
 root.style.setProperty("--color-muted",dark?"#a6b8ac":"#68786d");root.style.setProperty("--color-line",dark?"#34483b":"#e0e9e1");
 root.style.setProperty("--radius-card",`${Math.min(28,Math.max(8,s.cardRadius))}px`);root.style.setProperty("--radius-2xl",`${Math.min(28,Math.max(8,s.cardRadius))}px`);
 root.style.setProperty("--radius-xl",`${Math.min(24,Math.max(6,s.buttonRadius))}px`);root.style.setProperty("--font-sans",fonts[s.fontFamily]??fonts.byekan);
 root.style.setProperty("--app-font-size",`${Math.min(20,Math.max(13,s.fontSize))}px`);root.dataset.theme=dark?"dark":"light";
}
export function AppearanceProvider({children}:{children:ReactNode}){
 const [settings,setSettings]=useState(DEFAULT_APPEARANCE),[loading,setLoading]=useState(true),dirty=useRef(false);
 useEffect(()=>{applyAppearance(settings);},[settings]);
 useEffect(()=>{let active=true,inFlight=false;const refresh=async()=>{if(!active||inFlight||dirty.current||document.visibilityState==="hidden")return;inFlight=true;try{const r=await phpApi.getAppearance();if(active&&!dirty.current){const loaded={...DEFAULT_APPEARANCE,...r.settings};if(loaded.primary.toLowerCase()==="#c2410c")loaded.primary=DEFAULT_APPEARANCE.primary;if(loaded.secondary.toLowerCase()==="#1f6b4a")loaded.secondary=DEFAULT_APPEARANCE.secondary;setSettings(loaded);}}catch{/* Keep last known theme. */}finally{inFlight=false;if(active)setLoading(false);}};
 void refresh();const timer=window.setInterval(()=>void refresh(),15000);const visible=()=>{if(document.visibilityState==="visible")void refresh();};
 window.addEventListener("focus",visible);document.addEventListener("visibilitychange",visible);
 return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",visible);document.removeEventListener("visibilitychange",visible);};},[]);
 const update=(patch:Partial<AppearanceSettings>)=>{dirty.current=true;setSettings(s=>({...s,...patch}));};
 const save=async()=>{const r=await phpApi.saveAppearance(settings);dirty.current=false;setSettings({...DEFAULT_APPEARANCE,...r.settings});};
 const reset=async()=>{const r=await phpApi.resetAppearance();dirty.current=false;setSettings({...DEFAULT_APPEARANCE,...r.settings});};
 const uploadLogo=async(file:File)=>{if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw Error("لوگو باید PNG، JPG یا WebP باشد.");if(file.size<1||file.size>512*1024)throw Error("حجم لوگو باید حداکثر ۵۱۲ کیلوبایت باشد.");
 const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error("خواندن فایل لوگو انجام نشد."));reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(Error("فایل لوگو معتبر نیست."));reader.readAsDataURL(file);});
 const r=await phpApi.uploadAppearanceLogo(data.slice(data.indexOf(",")+1));update({logoUrl:r.logo_url});};
 const value={settings,update,save,reset,uploadLogo,loading};
 return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
export function useAppearance(){const value=useContext(AppearanceContext);if(!value)throw Error("useAppearance must be used inside AppearanceProvider");return value;}
