import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from '@appdeploy/client';
import App from './App';
import { PartnerCallOps } from './PartnerCallOps';
import { ControlCenter } from './ControlCenter';
import { DriverJob } from './DriverJob';
import { ProviderJob } from './ProviderJob';
import { ContractorApply } from './ContractorApply';
import { ContractorPortal } from './ContractorPortal';
import { ContractorAdmin } from './ContractorAdmin';
import { OwnerCockpit } from './OwnerCockpit';
import './index.css';

const h=window.location.hostname.toLowerCase().replace(/^www\./,'');const key=`mm-view:${h}:${window.location.pathname}`;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');api.post('/api/analytics-event',{type:'pageview',host:h,path:window.location.pathname,referrer:document.referrer.slice(0,300)}).catch(()=>{});}createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {window.location.hash.startsWith('#provider-job=')?<ProviderJob/>:window.location.hash.startsWith('#driver-job=')?<DriverJob/>:window.location.hash.startsWith('#contractor=')?<ContractorPortal/>:window.location.hash==='#contractor-apply'?<ContractorApply/>:window.location.hash==='#contractor-admin'?<ContractorAdmin/>:window.location.hash==='#owner'?<OwnerCockpit/>:window.location.hash==='#control-center'?<ControlCenter/>:window.location.hash==='#partner-calls'?<PartnerCallOps/>:<App />}
    </StrictMode>
);
