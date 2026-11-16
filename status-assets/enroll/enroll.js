(() => {
  // The invitation is transported in the URL fragment. Browsers do not
  // transmit fragments in HTTP requests, server logs or Referer headers.
  const secret=window.location.hash.slice(1);
  window.history.replaceState(null,"",window.location.pathname);
  if(!/^[A-Za-z0-9_-]{43}$/.test(secret))return;
  const activate=document.getElementById("activate");
  document.getElementById("not-found").hidden=true;
  activate.hidden=false;
  const button=document.getElementById("approve");
  button.addEventListener("click",async()=>{
    button.disabled=true;
    const result=document.getElementById("result");
    result.textContent="Approving browser…";
    try{
      const response=await fetch("/api/admin-enroll",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({token:secret})
      });
      if(!response.ok)throw Error("Invalid or expired invitation. Request a new private link.");
      const body=await response.json();
      if(body.ok!==true)throw Error("Activation was not completed.");
      window.location.replace("/admin/");
    }catch(error){
      result.textContent=error.message||"Activation failed.";
      button.disabled=false;
    }
  });
})();