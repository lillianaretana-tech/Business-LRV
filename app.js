(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const state = {
    profile: null,
    results: [],
    selected: null,
    favorites: JSON.parse(localStorage.getItem("bva-favorites") || "[]"),
    compare: [],
    tasks: JSON.parse(localStorage.getItem("bva-tasks") || "{}"),
    feedback: JSON.parse(localStorage.getItem("bva-feedback") || "[]")
  };

  function escape(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function money(amount) {
    return new Intl.NumberFormat("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  }

  function profileFromForm(form) {
    const data = new FormData(form);
    return {
      age: Number(data.get("age")),
      country: data.get("country").trim(),
      budget: Number(data.get("budget")),
      goal: Number(data.get("goal")),
      hours: Number(data.get("hours")),
      situation: data.get("situation"),
      education: data.get("education"),
      experience: data.get("experience").trim(),
      incomeMode: data.get("incomeMode"),
      format: data.get("format"),
      risk: data.get("risk"),
      sales: data.get("sales"),
      team: data.get("team"),
      personality: data.get("personality"),
      interests: data.get("interests").trim(),
      skills: data.getAll("skills"),
      devices: data.getAll("devices")
    };
  }

  function scoreBusiness(business, profile) {
    let score = 45;
    const reasons = [];
    const budgetRatio = profile.budget / business.budgetMin;
    if (budgetRatio >= 1) { score += 18; reasons.push("Cabe en tu presupuesto piloto"); }
    else { score -= 26; reasons.push("Necesita preventa o mas presupuesto"); }
    if (business.format.includes(profile.format) || profile.format === "both") { score += 9; reasons.push("Coincide con el formato deseado"); }
    const skillFit = business.skills.some((skill) => profile.skills.includes(skill));
    if (skillFit) { score += 13; reasons.push("Aprovecha una habilidad declarada"); }
    else { score -= 3; reasons.push("Requiere aprendizaje inicial"); }
    const missingDevice = business.devices.find((device) => !profile.devices.includes(device));
    if (missingDevice) { score -= 15; reasons.push("Falta herramienta esencial: " + missingDevice); }
    else { score += 6; }
    if (profile.hours >= business.hoursMin) { score += 7; reasons.push("Es viable con tu tiempo"); }
    else { score -= 12; reasons.push("Exige mas horas semanales"); }
    if (profile.risk === "low" && business.risk !== "low") score -= 10;
    if (profile.situation === "extra" && business.extra) score += 4;
    if (profile.goal > 600 && business.scalable) score += 4;
    if (profile.sales === "no" && business.id === "senior-companion") score += 3;
    return { score: Math.max(12, Math.min(96, score)), reasons };
  }

  function runAnalysis(profile) {
    state.profile = profile;
    state.results = window.BUSINESS_CATALOG.map((business) => ({ business, ...scoreBusiness(business, profile) }))
      .sort((a, b) => b.score - a.score);
    state.selected = state.results[0].business.id;
    localStorage.setItem("bva-profile", JSON.stringify(profile));
    showWorkspace();
  }

  function showWorkspace() {
    $("#radarView").classList.add("hidden");
    $("#onboardingPanel").classList.add("hidden");
    $("#workspace").classList.remove("hidden");
    const p = state.profile;
    $("#welcomeTitle").textContent = "Oportunidades para " + p.country;
    $("#profileInsight").textContent = "Con " + money(p.budget) + " y " + p.hours + " horas/semana, priorizamos validacion barata antes de invertir.";
    const viable = state.results.filter((item) => item.score >= 65).length;
    $("#metrics").innerHTML = [
      `<div class="metric"><strong>${viable}</strong><small>viables ahora</small></div>`,
      `<div class="metric"><strong>${state.results[0].score}</strong><small>mejor ajuste</small></div>`,
      `<div class="metric"><strong>${money(p.goal)}</strong><small>meta mensual</small></div>`
    ].join("");
    $("#trendFeed").innerHTML = window.BUSINESS_EVIDENCE.map((evidence) => `<article class="trend-item"><b>${evidence.source}</b><span>${evidence.use}</span></article>`).join("");
    switchView("radar");
    renderOpportunities();
    renderDetail();
  }

  function renderOpportunities() {
    $("#opportunityList").innerHTML = state.results.map(({ business, score }) => `
      <article class="op-card ${state.selected === business.id ? "active" : ""}" data-open="${business.id}" tabindex="0">
        <span class="op-score">${score}</span>
        <div>
          <h4>${business.name}</h4>
          <div class="badges">
            <span class="badge">${business.difficulty}</span>
            <span class="badge">Desde ${money(business.budgetMin)}</span>
            <span class="badge">${business.launch}</span>
          </div>
        </div>
        <button class="fav ${state.favorites.includes(business.id) ? "saved" : ""}" data-favorite="${business.id}" aria-label="Guardar">&#9733;</button>
      </article>`).join("");
  }

  function selectedResult() {
    return state.results.find((result) => result.business.id === state.selected);
  }

  function renderDetail(tabName) {
    const result = selectedResult();
    const b = result.business;
    const tab = tabName || "guide";
    const projected = b.revenue.units * (b.revenue.price - b.revenue.unitCost) - b.revenue.fixed;
    $("#detailPanel").innerHTML = `
      <div class="detail-top">
        <div><span class="fit">Ajuste ${result.score}/100</span><h3>${b.name}</h3><span class="badge">${b.category}</span></div>
        <div class="detail-actions">
          <button class="mini-button" data-add-compare="${b.id}">Comparar</button>
          <button class="mini-button" id="exportPlan">Exportar PDF</button>
        </div>
      </div>
      <div class="detail-grid">
        <div class="fact"><small>Inversion piloto</small><b>${money(b.budgetMin)}</b></div>
        <div class="fact"><small>Inicio</small><b>${b.launch}</b></div>
        <div class="fact"><small>Riesgo</small><b>${b.risk === "low" ? "Bajo" : "Medio"}</b></div>
        <div class="fact"><small>Escenario mensual</small><b>${money(projected)}</b></div>
      </div>
      <nav class="tabs" aria-label="Detalle del negocio">
        ${[["guide","Guia"],["costs","Costos"],["sales","Ventas"],["brand","Marca e IA"],["growth","Crecimiento"]].map(([key,label]) => `<button class="tab ${tab === key ? "active" : ""}" data-tab="${key}">${label}</button>`).join("")}
      </nav>
      <div class="detail-body">${detailSection(b, result, tab)}</div>`;
  }

  function detailSection(b, result, tab) {
    if (tab === "costs") return `
      <h4>Compra solo lo necesario para validar</h4>
      <ul class="tool-list">${b.investment.map((line) => `<li>${line}</li>`).join("")}</ul>
      <h4>Herramientas</h4><ul class="tool-list">${b.tools.map((tool) => `<li><strong>+</strong> ${tool}</li>`).join("")}</ul>
      <h4>Proveedores a verificar en ${escape(state.profile.country)}</h4><p>${b.suppliers}</p>
      ${b.recipe ? `<h4>${b.recipe.title}</h4><ul class="tool-list">${b.recipe.lines.map((line) => `<li>${line}</li>`).join("")}</ul><div class="warning">${b.recipe.safety}</div>` : ""}`;
    if (tab === "sales") return `
      <h4>Quien compra</h4><p>${b.clients}</p>
      <h4>Primeras ventas</h4>
      <ul class="step-list"><li><b>1</b><span>Habla con diez clientes probables y pregunta por problema, frecuencia y precio aceptable.</span></li><li><b>2</b><span>Crea una oferta piloto con cupos, imagen clara y condiciones transparentes en WhatsApp Business.</span></li><li><b>3</b><span>Publica demostraciones reales en grupos locales o video corto, pide referidos sin spam.</span></li><li><b>4</b><span>Registra costo, conversion y recompra; pausa lo que no deje margen.</span></li></ul>`;
    if (tab === "brand") return `
      <h4>Marca automatica inicial</h4>
      <p><strong>Nombres:</strong> ${b.branding.names.join(" / ")}<br><strong>Slogan:</strong> ${b.branding.slogan}<br><strong>Paleta:</strong> ${b.branding.colors}</p>
      <h4>IA y automatizacion util</h4><ul class="tool-list">${b.automationIdeas.map((idea) => `<li><strong>+</strong> ${idea}</li>`).join("")}</ul>
      <div class="warning">Nunca enviar informacion sensible de clientes a una IA sin consentimiento y controles adecuados.</div>`;
    if (tab === "growth") return `
      <h4>Ruta de crecimiento</h4><ul class="step-list">${b.growth.map((step, index) => `<li><b>${index + 1}</b><span>${step}</span></li>`).join("")}</ul>
      <h4>Errores a evitar</h4><ul class="tool-list">${b.errors.map((error) => `<li><strong>!</strong> ${error}</li>`).join("")}</ul>`;
    return `
      <p>${b.summary}</p>
      <h4>Por que merece una prueba</h4><p>${b.potential}</p>
      <p><strong>Tendencia:</strong> ${b.trend}</p>
      <h4>Por que encaja contigo</h4><ul class="tool-list">${result.reasons.map((reason) => `<li><strong>+</strong> ${reason}</li>`).join("")}</ul>
      <h4>Primeros pasos reales</h4><ul class="step-list">${b.process.map((step, index) => `<li><b>${index + 1}</b><span>${step}</span></li>`).join("")}</ul>
      <p><strong>Referencia de modelo:</strong> ${b.comparable}</p>`;
  }

  function renderRoadmap() {
    const b = selectedResult().business;
    const tasks = [
      "Definir cliente, problema y oferta piloto de " + b.name,
      "Consultar requisitos, permisos y precios en " + state.profile.country,
      "Hablar con 10 posibles compradores y anotar respuestas",
      "Cotizar tres opciones y calcular margen conservador",
      "Publicar preventa o piloto con cupos limitados",
      "Entregar primeras ventas y solicitar comentarios",
      "Revisar margen, tiempo y recompra antes de invertir mas"
    ];
    const completed = tasks.filter((_, index) => state.tasks[b.id + index]).length;
    $("#roadmapContent").innerHTML = `<section class="large-panel">
      <p class="eyebrow">MODO NEGOCIO GUIADO</p><h2>Plan de 30 dias: ${b.name}</h2>
      <p>Semana 1 valida demanda; semana 2 entrega un piloto; semana 3 mejora costos y presentacion; semana 4 decide continuar, cambiar o detener.</p>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.round(completed / tasks.length * 100)}%"></div></div>
      <strong>${completed} de ${tasks.length} tareas completadas</strong>
      ${tasks.map((task, index) => `<label class="task ${state.tasks[b.id + index] ? "done" : ""}"><input data-task="${b.id + index}" type="checkbox" ${state.tasks[b.id + index] ? "checked" : ""}><span>${task}</span></label>`).join("")}
      <h3>Plan de 90 dias</h3>
      <p>Mes 1: probar con dinero limitado. Mes 2: buscar repeticion y resenas. Mes 3: invertir solamente si margen, demanda y operacion se sostienen.</p>
    </section>`;
  }

  function renderSimulator() {
    const b = selectedResult().business;
    $("#simulatorContent").innerHTML = `<section class="large-panel">
      <p class="eyebrow">SIMULADOR PRUDENTE</p><h2>${b.name}</h2>
      <p>Cambia los valores segun cotizaciones reales. No es una promesa de ingresos.</p>
      <div class="calculator">
        <label>Ventas mensuales<input id="units" type="number" min="0" value="${b.revenue.units}"></label>
        <label>Precio por venta (USD)<input id="price" type="number" min="0" step=".01" value="${b.revenue.price}"></label>
        <label>Costo por venta (USD)<input id="unitCost" type="number" min="0" step=".01" value="${b.revenue.unitCost}"></label>
        <label>Gastos fijos (USD)<input id="fixed" type="number" min="0" step=".01" value="${b.revenue.fixed}"></label>
        <label>Inversion inicial (USD)<input id="investment" type="number" min="0" value="${b.budgetMin}"></label>
      </div>
      <div class="projection" id="projection"></div>
    </section>`;
    calculateProjection();
  }

  function calculateProjection() {
    if (!$("#units")) return;
    const units = Number($("#units").value);
    const price = Number($("#price").value);
    const cost = Number($("#unitCost").value);
    const fixed = Number($("#fixed").value);
    const investment = Number($("#investment").value);
    const sales = units * price;
    const profit = sales - units * cost - fixed;
    const months = profit > 0 ? investment / profit : null;
    $("#projection").innerHTML = `<div><small>Ventas</small><strong>${money(sales)}</strong></div><div><small>Ganancia estimada</small><strong>${money(profit)}</strong></div><div><small>Margen</small><strong>${sales ? Math.round(profit / sales * 100) : 0}%</strong></div><div><small>Recuperar inversion</small><strong>${months ? months.toFixed(1) + " meses" : "No viable"}</strong></div>`;
  }

  function renderMentor() {
    const b = selectedResult().business;
    $("#mentorContent").innerHTML = `<div class="mentor-layout">
      <section class="large-panel"><p class="eyebrow">MENTOR IA</p><h2>Asistente responsable</h2><p>En la version conectada, el mentor consultara tendencias y generara planes estructurados. En este MVP responde con la guia verificada del negocio seleccionado.</p><ul class="tool-list"><li><strong>+</strong> Pregunta por primeras ventas</li><li><strong>+</strong> Pregunta por costos o errores</li><li><strong>+</strong> Pregunta por IA y automatizacion</li></ul></section>
      <section class="chat"><div class="message ai">Estoy listo para guiar tu piloto de <strong>${b.name}</strong>. Que deseas resolver primero?</div><div id="messages"></div><form id="chatForm" class="chat-form"><input name="question" required placeholder="Ej. Como consigo mis primeros clientes?"><button class="primary">Enviar</button></form></section>
    </div>`;
  }

  function ratingOptions(name) {
    return [1, 2, 3, 4, 5].map((rating) => `<label><input required type="radio" name="${name}" value="${rating}">${rating}</label>`).join("");
  }

  function renderFeedback() {
    const previous = state.feedback.length;
    $("#feedbackContent").innerHTML = `<div class="feedback-layout">
      <section class="large-panel">
        <p class="eyebrow">PRUEBA CON 3-5 PERSONAS</p>
        <h2>Checklist de sesion</h2>
        <p>Duracion sugerida: 10 minutos por persona. Observa primero y pregunta despues.</p>
        <ol class="test-checklist">
          <li>Elige perfiles distintos: principiante, persona que busca ingreso extra y, si es posible, una persona mayor o emprendedora.</li>
          <li>Pide usar la app sin explicarla: completar perfil, revisar una idea y encontrar el siguiente paso.</li>
          <li>Observa donde duda, que palabras no entiende y si descubre el plan y el simulador.</li>
          <li>Pregunta: que recomendacion le parecio creible y que le impediria comenzar.</li>
          <li>Pide completar este formulario y registra una mejora concreta antes de la siguiente prueba.</li>
        </ol>
        <p class="testing-note">No intentes convencer a la persona. Una reaccion negativa o una idea descartada tambien es aprendizaje valido.</p>
      </section>
      <section class="large-panel">
        <p class="eyebrow">FEEDBACK RAPIDO</p>
        <h2>Ayudanos a mejorar</h2>
        <p>Responde pensando en lo que acabas de explorar. Tus respuestas se guardan solo en este dispositivo en el MVP.</p>
        ${previous ? `<p class="testing-note">Respuestas registradas en este dispositivo: ${previous}</p>` : ""}
        <form id="feedbackForm" class="feedback-form">
          <label>1. Que tan claro fue entender para que sirve la app?
            <span class="rating-row">${ratingOptions("clarity")}</span>
          </label>
          <label>2. Que tan utiles te parecieron las recomendaciones?
            <span class="rating-row">${ratingOptions("usefulness")}</span>
          </label>
          <label>3. Como te hizo sentir la experiencia?
            <select name="feeling" required>
              <option value="">Selecciona una opcion</option>
              <option>Motivado/a y con una ruta clara</option>
              <option>Interesado/a pero necesito mas confianza</option>
              <option>Abrumado/a por la informacion</option>
              <option>No me conecto con las ideas</option>
            </select>
          </label>
          <label>4. Que tan facil fue moverte y encontrar lo importante?
            <span class="rating-row">${ratingOptions("navigation")}</span>
          </label>
          <label>5. La mejor recomendacion te parecio realista para tu situacion?
            <select name="realistic" required>
              <option value="">Selecciona una opcion</option>
              <option>Si, la probaria</option>
              <option>Tal vez, necesito mas datos locales</option>
              <option>No, no encaja conmigo</option>
            </select>
          </label>
          <label>6. Usarias esta app para iniciar algo en los proximos 30 dias?
            <select name="intent" required>
              <option value="">Selecciona una opcion</option>
              <option>Si, empezaria una prueba</option>
              <option>Tal vez, con acompanamiento</option>
              <option>No por ahora</option>
            </select>
          </label>
          <label>7. Que cambiarias o que te falto?
            <textarea name="comment" placeholder="Una frase es suficiente"></textarea>
          </label>
          <button type="submit" class="primary">Guardar feedback</button>
        </form>
        <div id="feedbackThanks" class="feedback-success hidden" role="status"></div>
      </section>
    </div>`;
  }

  function mentorReply(question) {
    const b = selectedResult().business;
    const q = question.toLowerCase();
    if (q.includes("costo") || q.includes("invert")) return "Empieza con " + money(b.budgetMin) + " como piloto. Cotiza localmente y usa el simulador antes de comprar equipo.";
    if (q.includes("cliente") || q.includes("venta")) return "Habla primero con diez compradores posibles y ofrece cupos de prueba. Usa una oferta clara, precio y fecha de entrega; mide recompra.";
    if (q.includes("ia") || q.includes("automat")) return b.automationIdeas.join(". ") + ". Conserva siempre revision humana y privacidad.";
    if (q.includes("error") || q.includes("riesgo")) return "Evita esto: " + b.errors.join("; ") + ".";
    return "Tu siguiente accion segura es validar demanda y costos reales antes de invertir. Revisa la pestana Guia o formula una pregunta sobre costos, ventas, IA o riesgos.";
  }

  function switchView(view) {
    if (!state.profile && view !== "radar") return;
    $$(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
    ["radar", "roadmap", "simulator", "mentor", "feedback"].forEach((key) => $("#" + key + "Content").classList.toggle("hidden", key !== view));
    if (view === "roadmap") renderRoadmap();
    if (view === "simulator") renderSimulator();
    if (view === "mentor") renderMentor();
    if (view === "feedback") renderFeedback();
  }

  function showComparison() {
    const ids = state.compare.length > 1 ? state.compare.slice(-3) : state.results.slice(0, 3).map((item) => item.business.id);
    const items = ids.map((id) => state.results.find((result) => result.business.id === id));
    $("#detailPanel").innerHTML = `<div class="detail-top"><h3>Comparador de oportunidades</h3><button class="mini-button" id="closeComparison">Volver</button></div>
      <div class="tool-list">${items.map(({business,score}) => `<div class="fact" style="margin-bottom:10px"><strong>${business.name}</strong><p>Ajuste ${score}/100 | Desde ${money(business.budgetMin)} | ${business.launch} | Automatizacion ${business.automation}%</p></div>`).join("")}</div>
      <div class="warning">Compara con cotizaciones, demanda y requisitos legales locales antes de elegir.</div>`;
  }

  $("#startButton").addEventListener("click", () => $("#onboardingPanel").classList.remove("hidden"));
  $("#closeOnboarding").addEventListener("click", () => $("#onboardingPanel").classList.add("hidden"));
  $("#demoButton").addEventListener("click", () => runAnalysis({ age: 42, country: "Costa Rica", budget: 120, goal: 400, hours: 15, situation: "extra", education: "basic", experience: "Cocina familiar", incomeMode: "extra", format: "both", risk: "low", sales: "some", team: "alone", personality: "guided", interests: "comida y cuidado", skills: ["cooking", "care"], devices: ["phone", "internet"] }));
  $("#profileForm").addEventListener("submit", (event) => { event.preventDefault(); runAnalysis(profileFromForm(event.target)); });
  $("#themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    $("#themeToggle").textContent = document.body.classList.contains("dark") ? "Modo claro" : "Modo oscuro";
  });
  $$(".nav-link").forEach((link) => link.addEventListener("click", () => switchView(link.dataset.view)));
  $("#opportunityList").addEventListener("click", (event) => {
    const favorite = event.target.closest("[data-favorite]");
    if (favorite) {
      event.stopPropagation();
      const id = favorite.dataset.favorite;
      state.favorites = state.favorites.includes(id) ? state.favorites.filter((value) => value !== id) : state.favorites.concat(id);
      localStorage.setItem("bva-favorites", JSON.stringify(state.favorites));
      renderOpportunities();
      return;
    }
    const card = event.target.closest("[data-open]");
    if (card) { state.selected = card.dataset.open; renderOpportunities(); renderDetail(); }
  });
  $("#detailPanel").addEventListener("click", (event) => {
    if (event.target.dataset.tab) renderDetail(event.target.dataset.tab);
    if (event.target.dataset.addCompare) {
      if (!state.compare.includes(event.target.dataset.addCompare)) state.compare.push(event.target.dataset.addCompare);
      showComparison();
    }
    if (event.target.id === "closeComparison") renderDetail();
    if (event.target.id === "exportPlan") window.print();
  });
  $("#compareButton").addEventListener("click", showComparison);
  $("#roadmapContent").addEventListener("change", (event) => {
    if (!event.target.dataset.task) return;
    state.tasks[event.target.dataset.task] = event.target.checked;
    localStorage.setItem("bva-tasks", JSON.stringify(state.tasks));
    renderRoadmap();
  });
  $("#simulatorContent").addEventListener("input", calculateProjection);
  $("#mentorContent").addEventListener("submit", (event) => {
    if (event.target.id !== "chatForm") return;
    event.preventDefault();
    const input = event.target.elements.question;
    const question = input.value.trim();
    $("#messages").insertAdjacentHTML("beforeend", `<div class="message user">${escape(question)}</div><div class="message ai">${mentorReply(question)}</div>`);
    input.value = "";
  });
  $("#feedbackContent").addEventListener("submit", (event) => {
    if (event.target.id !== "feedbackForm") return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target).entries());
    values.business = selectedResult().business.name;
    values.recordedAt = new Date().toISOString();
    state.feedback.push(values);
    localStorage.setItem("bva-feedback", JSON.stringify(state.feedback));
    event.target.classList.add("hidden");
    $("#feedbackThanks").classList.remove("hidden");
    $("#feedbackThanks").innerHTML = "<strong>Gracias por probar Business Vision AI.</strong><br>Tu opinion fue guardada. Esta respuesta ayudara a decidir la siguiente mejora.";
  });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}());
