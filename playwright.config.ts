import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',fullyParallel:true,reporter:'list',
  use:{baseURL:'http://127.0.0.1:5173',channel:'chrome',trace:'retain-on-failure'},
  projects:[
    {name:'desktop',use:{viewport:{width:1512,height:1080}}},
    {name:'mobile',use:{viewport:{width:393,height:852},hasTouch:true,isMobile:true}},
  ],
  webServer:{command:'npm run dev -- --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:true},
});
