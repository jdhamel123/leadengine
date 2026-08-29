import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { api } from './platform-client';
import { DriverJob } from './DriverJob';
import { ContractorApply } from './ContractorApply';
import { ContractorPortal } from './ContractorPortal';
import { ContractorAdmin } from './ContractorAdmin';
import { MattressRescueStorefront } from './MattressRescueStorefront';
import { MattressQualification } from './MattressQualification';
import { OwnerCockpit } from './OwnerCockpit';
import ExceptionDashboard from './ExceptionDashboard';
import { PortableLogin } from './PortableLogin';
import { MigrationControl } from './MigrationControl';
import { PortableOperations } from './PortableOperations';
import { PortableHome } from './PortableHome';
import { DataMigration } from './DataMigration';
import { SystemHealth } from './SystemHealth';
import './index.css';

const h=window.location.hostname.toLowerCase().replace(/^www\./,'');const legacyPortfolioEnabled=import.meta.env.VITE_ENABLE_LEGACY_PORTFOLIO==='true';const key=`mm-view:${h}:${window.location.pathname}`;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');api.post('/api/analytics-event',{type:'pageview',host:h,path:window.location.pathname,referrer:document.referrer.slice(0,300)}).catch(()=>{});}createRoot(document.getElementById('root')!).render(
    <StrictMode>
        {window.location.hash==='#portable-login'?<PortableLogin/>:window.location.hash==='#migration'?<MigrationControl/>:window.location.hash==='#data-migration'?<DataMigration/>:window.location.hash==='#system-health'?<SystemHealth/>:window.location.hash.startsWith('#driver-job=')?<DriverJob/>:window.location.hash.startsWith('#contractor=')?<ContractorPortal/>:window.location.hash==='#contractor-apply'?<ContractorApply/>:window.location.hash==='#contractor-admin'?<ContractorAdmin/>:window.location.hash==='#mattress-suppliers'?<MattressQualification/>:window.location.hash==='#exceptions'?<ExceptionDashboard/>:window.location.hash==='#owner'?<OwnerCockpit/>:window.location.hash==='#control-center'?<PortableOperations/>:(h==='mattressrescue.com'?<MattressRescueStorefront/>:legacyPortfolioEnabled?<App/>:<PortableHome />)}
    </StrictMode>
);
