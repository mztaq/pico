(() => {
  const $=id=>document.getElementById(id);
  const services={website:"Pico Website",mcp:"Pico MCP",oauth:"Pico OAuth"};
  const stages=["investigating","identified","monitoring","resolved"];
  const labels={investigating:"Investigating",identified:"Identified",monitoring:"Monitoring",resolved:"Resolved"};
  let incidents=[],selected=null,loading=false;
  function note(id,text,ok){const element=$(id);element.textContent=text;element.className="notice "+(ok?"ok":"fail")}
  async function request(path,options){
    const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...options});
    let body;
    try{body=await response.json()}catch{throw Error("Unable to read server response")}
    if(!response.ok)throw Error(body.error||"Request failed");
    return body;
  }
  function choose(incident){
    selected=incident;
    $("selection").textContent=incident.title+" · "+(services[incident.serviceId]||"Pico");
    $("update-form").hidden=false;
    const stage=$("stage");
    for(const option of stage.options){
      option.disabled=stages.indexOf(option.value)<stages.indexOf(incident.status);
    }
    stage.value=incident.status;
    $("update-message").value="";
    note("update-result","",true);
    draw();
  }
  function draw(){
    const root=$("incidents");root.replaceChildren();
    if(!incidents.length){const empty=document.createElement("div");empty.className="picker-empty";empty.textContent="No incidents";root.append(empty);return;}
    incidents.forEach(i=>{
      const button=document.createElement("button");button.type="button";button.className="pick"+(selected&&selected.id===i.id?" active":"");
      const left=document.createElement("span"),name=document.createElement("strong"),small=document.createElement("small");
      const status=document.createElement("span");
      name.textContent=i.title;
      small.textContent=(services[i.serviceId]||"Pico")+" · "+new Date(i.startedAt).toLocaleDateString();
      status.className="status"+(i.status==="resolved"?" resolved":"");
      status.textContent=labels[i.status]||"Unknown";
      left.append(name,small);button.append(left,status);
      button.addEventListener("click",()=>choose(i));
      root.append(button);
    });
  }
  async function reload(preferred){
    if(loading)return;
    loading=true;
    try{
      const result=await request("/admin/api/incidents");
      incidents=Array.isArray(result.incidents)?result.incidents:[];
      if(preferred){selected=incidents.find(i=>i.id===preferred)||null;}
      else if(selected){selected=incidents.find(i=>i.id===selected.id)||null;}
      if(selected)choose(selected);
      else{$("update-form").hidden=true;$("selection").textContent="Select an incident above.";draw()}
    }catch(error){
      const div=document.createElement("div");div.className="picker-empty";
      div.textContent="Access denied or admin setup incomplete.";
      $("incidents").replaceChildren(div);
      $("update-form").hidden=true;
    }finally{loading=false}
  }
  $("create-form").addEventListener("submit",async event=>{
    event.preventDefault();
    if(!confirm("Publish this incident to the public status page?"))return;
    const button=$("create-incident");button.disabled=true;
    try{
      const result=await request("/admin/api/incidents",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({serviceId:$("service").value,title:$("title").value,message:$("create-message").value})
      });
      $("create-form").reset();note("create-result","Incident published.",true);
      await reload(result.id);
    }catch(error){note("create-result",error.message,false)}
    finally{button.disabled=false}
  });
  $("update-form").addEventListener("submit",async event=>{
    event.preventDefault();
    if(!selected)return;
    if(!confirm("Publish this update publicly?"))return;
    const button=$("publish-update");button.disabled=true;
    const id=selected.id;
    try{
      await request("/admin/api/updates",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({incidentId:id,stage:$("stage").value,message:$("update-message").value})});
      await reload(id);
      note("update-result","Update published.",true);
    }catch(error){note("update-result",error.message,false)}
    finally{button.disabled=false}
  });
  reload();
})();
