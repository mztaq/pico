(() => {
  const $ = id => document.getElementById(id);
  const services = {website: "Pico Website", mcp: "Pico MCP", oauth: "Pico OAuth"};
  const stages = ["investigating", "identified", "monitoring", "resolved"];
  const labels = {investigating: "Investigating", identified: "Identified", monitoring: "Monitoring", resolved: "Resolved"};
  const dateFormat = new Intl.DateTimeFormat(undefined, {day: "numeric", month: "short", year: "numeric"});
  const createDialog = $("create-dialog");
  const updateDialog = $("update-dialog");
  let incidents = [];
  let selected = null;
  let toastTimeout;

  async function request(path, options) {
    const response = await fetch(path, {credentials: "same-origin", cache: "no-store", ...options});
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 404 && !data) throw Error("Admin session expired. Sign in again.");
      throw Error(data?.error || "Request failed.");
    }
    if (!data) throw Error("Invalid server response.");
    return data;
  }

  function setMessage(id, message) {
    const element = $(id);
    element.textContent = message;
    element.hidden = !message;
  }

  function notify(message) {
    const element = $("toast");
    clearTimeout(toastTimeout);
    element.textContent = message;
    element.hidden = false;
    toastTimeout = setTimeout(() => { element.hidden = true; }, 3200);
  }

  function closeDialog(dialog) {
    if (dialog.dataset.busy === "true") return;
    dialog.close();
  }

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => closeDialog($(button.dataset.close)));
  });

  for (const dialog of [createDialog, updateDialog]) {
    dialog.addEventListener("cancel", event => {
      if (dialog.dataset.busy === "true") event.preventDefault();
    });
    dialog.addEventListener("click", event => {
      if (event.target === dialog) closeDialog(dialog);
    });
  }

  $("new-incident").addEventListener("click", () => {
    $("create-form").reset();
    setMessage("create-result", "");
    createDialog.showModal();
    $("service").focus();
  });

  function choose(incident) {
    selected = incident;
    $("selection").textContent = incident.title + " · " + (services[incident.serviceId] || "Pico");
    const stage = $("stage");
    for (const option of stage.options) {
      option.disabled = stages.indexOf(option.value) < stages.indexOf(incident.status);
    }
    stage.value = stages.includes(incident.status) ? incident.status : "investigating";
    $("update-message").value = "";
    setMessage("update-result", "");
    updateDialog.showModal();
    stage.focus();
  }

  function render() {
    const root = $("incidents");
    root.replaceChildren();
    if (!incidents.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "No incidents recorded.";
      root.append(empty);
      return;
    }

    for (const incident of incidents) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "incident-row";
      row.setAttribute("aria-label", "Update incident: " + (incident.title || "Incident"));

      const info = document.createElement("span");
      info.className = "incident-info";
      const title = document.createElement("strong");
      title.className = "incident-title";
      title.textContent = incident.title || services[incident.serviceId] || "Incident";
      const meta = document.createElement("span");
      meta.className = "incident-meta";
      const date = new Date(incident.startedAt);
      const when = Number.isFinite(date.getTime()) ? dateFormat.format(date) : "Date unavailable";
      meta.textContent = (services[incident.serviceId] || "Pico") + " · " + when;
      info.append(title, meta);

      const side = document.createElement("span");
      side.className = "incident-side";
      const status = stages.includes(incident.status) ? incident.status :
        (incident.resolvedAt ? "resolved" : "investigating");
      const stage = document.createElement("span");
      stage.className = "status-pill " + status;
      stage.textContent = labels[status];
      const arrow = document.createElement("span");
      arrow.className = "row-arrow";
      arrow.textContent = "›";
      arrow.setAttribute("aria-hidden", "true");
      side.append(stage, arrow);
      row.append(info, side);
      row.addEventListener("click", () => choose(incident));
      root.append(row);
    }
  }

  async function reload() {
    try {
      const data = await request("/admin/api/incidents");
      if (!Array.isArray(data.incidents)) throw Error("Unexpected incident data.");
      incidents = data.incidents;
      render();
    } catch (error) {
      const root = $("incidents");
      root.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "empty-state";
      const message = document.createElement("p");
      message.textContent = error.message || "Unable to load incidents.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "retry-button";
      retry.textContent = "Try again";
      retry.addEventListener("click", reload);
      empty.append(message, retry);
      root.append(empty);
    }
  }

  $("create-form").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("create-incident");
    button.disabled = true;
    createDialog.dataset.busy = "true";
    setMessage("create-result", "");
    try {
      await request("/admin/api/incidents", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          serviceId: $("service").value,
          title: $("incident-title").value,
          message: $("create-message").value
        })
      });
      createDialog.close();
      notify("Incident published.");
      await reload();
    } catch (error) {
      setMessage("create-result", error.message || "Unable to publish incident.");
    } finally {
      delete createDialog.dataset.busy;
      button.disabled = false;
    }
  });

  $("update-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!selected) return;
    const button = $("publish-update");
    button.disabled = true;
    updateDialog.dataset.busy = "true";
    setMessage("update-result", "");
    try {
      await request("/admin/api/updates", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          incidentId: selected.id,
          stage: $("stage").value,
          message: $("update-message").value
        })
      });
      updateDialog.close();
      selected = null;
      notify("Update published.");
      await reload();
    } catch (error) {
      setMessage("update-result", error.message || "Unable to publish update.");
    } finally {
      delete updateDialog.dataset.busy;
      button.disabled = false;
    }
  });

  $("logout").addEventListener("click", async () => {
    const button = $("logout");
    button.disabled = true;
    try {
      await request("/admin/api/logout", {method: "POST"});
      window.location.assign("/admin/");
    } catch {
      button.disabled = false;
      notify("Unable to sign out. Try again.");
    }
  });

  reload();
})();
