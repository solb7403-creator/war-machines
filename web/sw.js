/* LUNAR war alerts (Session 7, owner decision 12): the website's service worker. It only shows the alert a push carries (every push
   is a visible notification: iOS and iPadOS revoke the permission of a site that sends silent pushes) and opens the War Map when
   the pilot taps it. No caching, no background work, no data kept. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{};}catch(_){d={body:e.data?e.data.text():''};}
 const title=String(d.title||'LUNAR · WAR ALERT').slice(0,80),body=String(d.body||'A fight you can still join is on the War Map.').slice(0,400);
 e.waitUntil(self.registration.showNotification(title,{body,icon:'/icon-180.png',badge:'/favicon-32.png',tag:String(d.tag||'lunar-war'),renotify:true,data:{url:String(d.url||'/web/play.html?war=1')}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();const url=new URL(e.notification.data?.url||'/web/play.html?war=1',self.location.origin);if(url.origin!==self.location.origin)return;
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if(c.url.startsWith(self.location.origin+'/web/')&&'focus' in c){c.postMessage({lunar:'war-map'});return c.focus();}}return self.clients.openWindow(url.href);}));});
