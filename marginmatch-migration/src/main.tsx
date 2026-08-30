import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
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
import { RevenueLab } from './RevenueLab';
import { ProfitFactory } from './ProfitFactory';
import { DeadQuoteRecovery } from './DeadQuoteRecovery';
import { PastCustomerReactivation } from './PastCustomerReactivation';
import './index.css';

const h=window.location.hostname.toLowerCase().replace(/^www\./,'');
const key=`mm-view:${h}:${window.location.pathname}`;
if(!sessionStorage.getItem(key)){
  sessionStorage.setItem(key,'1');
  api.post('/api/analytics-event',{type:'pageview',host:h,path:window.location.pathname,referrer:document.referrer.slice(0,300)}).catch(()=>{});
}

function RoutedApp(){
  const[hash,setHash]=useState(window.location.hash);
  useEffect(()=>{
    const onHash=()=>setHash(window.location.hash);
    window.addEventListener('hashchange',onHash);
    return()=>window.removeEventListener('hashchange',onHash);
  },[]);
  return hash==='#portable-login'?<PortableLogin/>:
    hash==='#migration'?<MigrationControl/>:
    hash==='#data-migration'?<DataMigration/>:
    hash==='#system-health'?<SystemHealth/>:
    hash==='#revenue-lab'?<RevenueLab/>:
    hash==='#profit-factory'?<ProfitFactory/>:
    hash==='#dead-quotes'?<DeadQuoteRecovery/>:
    hash==='#reactivation'?<PastCustomerReactivation/>:
    hash.startsWith('#driver-job=')?<DriverJob/>:
    hash.startsWith('#contractor=')?<ContractorPortal/>:
    hash==='#contractor-apply'?<ContractorApply/>:
    hash==='#contractor-admin'?<ContractorAdmin/>:
    hash==='#mattress-suppliers'?<MattressQualification/>:
    hash==='#exceptions'?<ExceptionDashboard/>:
    hash==='#owner'?<OwnerCockpit/>:
    hash==='#control-center'?<PortableOperations/>:
    h==='mattressrescue.com'?<MattressRescueStorefront onOps={()=>{window.location.hash='#control-center'}}/>:<PortableHome/>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><RoutedApp/></StrictMode>
);
